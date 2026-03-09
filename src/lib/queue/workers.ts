/**
 * BullMQ Workers — process all background jobs
 *
 * Workers:
 *   - reminderWorker: Send 24h/2h WhatsApp reminders
 *   - notificationWorker: Generic WhatsApp/SMS dispatch
 *   - cleanupWorker: Expired locks, unpaid bookings, old OTPs
 *   - reportWorker: Nightly revenue reports
 */

import { Worker, Job } from "bullmq"
import { getRedisConnection } from "./connection"
import { sendReminder, sendText } from "@/lib/whatsapp/sender"
import { createServerClient } from "@/lib/supabase/server"

let workersStarted = false

// ─── Reminder Worker ──────────────────────────────────────────────────────────

function createReminderWorker() {
  return new Worker(
    "reminder",
    async (job: Job) => {
      const {
        patient_phone,
        patient_name,
        doctor_name,
        date,
        time,
        booking_id,
        hospital_name,
        hoursUntil,
      } = job.data

      console.log(`[reminder] Sending ${hoursUntil}h reminder for ${booking_id}`)

      // Check appointment still exists and is confirmed
      const supabase = createServerClient()
      const { data: appt } = await supabase
        .from("appointments")
        .select("status")
        .eq("booking_id", booking_id)
        .single()

      if (!appt || appt.status !== "confirmed") {
        console.log(`[reminder] Skipping ${booking_id} — status: ${appt?.status || "not found"}`)
        return { skipped: true, reason: "not confirmed" }
      }

      const result = await sendReminder(patient_phone, {
        patientName: patient_name,
        doctorName: doctor_name,
        date,
        time,
        bookingId: booking_id,
        hospitalName: hospital_name,
        hoursUntil,
      })

      // Log reminder status
      await supabase.from("reminders").upsert({
        booking_id,
        type: `${hoursUntil}h`,
        sent: result.success ? "yes" : "failed",
        sent_at: new Date().toISOString(),
      }, { onConflict: "booking_id,type" })

      return result
    },
    {
      connection: getRedisConnection() as never,
      concurrency: 5,
    }
  )
}

// ─── Notification Worker ──────────────────────────────────────────────────────

function createNotificationWorker() {
  return new Worker(
    "notification",
    async (job: Job) => {
      const { phone, message, type } = job.data

      if (type === "whatsapp" || !type) {
        return await sendText(phone, message)
      }

      // SMS fallback (future: integrate Twilio/MSG91)
      console.log(`[notification] SMS not implemented yet — phone: ${phone}`)
      return { success: false, error: "SMS not configured" }
    },
    {
      connection: getRedisConnection() as never,
      concurrency: 10,
    }
  )
}

// ─── Cleanup Worker ───────────────────────────────────────────────────────────

function createCleanupWorker() {
  return new Worker(
    "cleanup",
    async (job: Job) => {
      const supabase = createServerClient()

      if (job.name === "cleanup-expired-unpaid") {
        // Cancel appointments pending payment for > 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("status", "pending_payment")
          .lt("created_at", twoHoursAgo)
          .select("booking_id")

        const count = data?.length || 0
        if (error) {
          console.error("[cleanup] Expired unpaid error:", error.message)
        } else if (count > 0) {
          console.log(`[cleanup] Cancelled ${count} expired unpaid appointments`)
        }

        return { cleaned: count }
      }

      return { skipped: true }
    },
    {
      connection: getRedisConnection() as never,
      concurrency: 1,
    }
  )
}

// ─── Report Worker ────────────────────────────────────────────────────────────

function createReportWorker() {
  return new Worker(
    "report",
    async (job: Job) => {
      if (job.name === "daily-revenue-report") {
        const supabase = createServerClient()
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

        // Get all tenants
        const { data: tenants } = await supabase
          .from("tenants")
          .select("tenant_id, hospital_name, admin_phone")
          .eq("status", "active")

        for (const tenant of tenants || []) {
          // Count appointments
          const { count: apptCount } = await supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenant.tenant_id)
            .eq("date", yesterday)

          // Sum revenue
          const { data: invoices } = await supabase
            .from("invoices")
            .select("total")
            .eq("tenant_id", tenant.tenant_id)
            .gte("created_at", `${yesterday}T00:00:00`)
            .lt("created_at", `${yesterday}T23:59:59`)
            .eq("payment_status", "paid")

          const revenue = (invoices || []).reduce((sum, inv) => sum + (inv.total || 0), 0)

          if (tenant.admin_phone) {
            const report = [
              `*${tenant.hospital_name}*`,
              `*Daily Operations Report*`,
              ``,
              `Date: ${yesterday}`,
              ``,
              `Total Appointments: ${apptCount || 0}`,
              `Total Revenue: Rs ${revenue.toLocaleString("en-IN")}`,
              ``,
              `This is an automated report. For detailed analytics, please visit the admin dashboard.`,
            ].join("\n")

            await sendText(tenant.admin_phone, report).catch(() => {})
          }
        }

        return { success: true, tenants: tenants?.length || 0 }
      }

      return { skipped: true }
    },
    {
      connection: getRedisConnection() as never,
      concurrency: 1,
    }
  )
}

// ─── Start All Workers ────────────────────────────────────────────────────────

export function startWorkers() {
  if (workersStarted) return

  try {
    const reminderW = createReminderWorker()
    const notificationW = createNotificationWorker()
    const cleanupW = createCleanupWorker()
    const reportW = createReportWorker()

    // Error handlers
    for (const worker of [reminderW, notificationW, cleanupW, reportW]) {
      worker.on("failed", (job, err) => {
        console.error(`[${worker.name}] Job ${job?.name} failed:`, err.message)
        // Send WhatsApp alert to admin for critical failures
        const adminPhone = process.env.ADMIN_ALERT_PHONE
        if (adminPhone) {
          sendText(adminPhone, `*System Alert — AI-HOS*\n\nA background job has failed.\n\nWorker: ${worker.name}\nJob: ${job?.name}\nError: ${err.message}\n\nPlease review the system logs for details.`).catch(() => {})
        }
      })

      worker.on("completed", (job) => {
        if (job.name !== "cleanup-expired-unpaid" && job.name !== "daily-revenue-report") {
          // Don't log repeatable jobs completion
          console.log(`[${worker.name}] Job ${job.name} completed`)
        }
      })
    }

    workersStarted = true
    console.log("[queue] All workers started: reminder, notification, cleanup, report")
  } catch (err) {
    console.error("[queue] Failed to start workers:", err)
  }
}
