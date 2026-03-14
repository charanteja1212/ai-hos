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
      // Follow-up reminder (1 day before follow-up date)
      if (job.name === "follow-up-reminder") {
        const { patient_phone, patient_name, doctor_name, follow_up_date, booking_id, hospital_name, tenant_id } = job.data
        console.log(`[reminder] Sending follow-up reminder for ${booking_id}, date: ${follow_up_date}`)

        const followDate = new Date(follow_up_date + "T00:00:00+05:30")
        const dateStr = followDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

        const message = `*${hospital_name || "Hospital"}*\n\n` +
          `Dear ${patient_name || "Patient"},\n\n` +
          `This is a reminder that you have a follow-up appointment scheduled with Dr. ${doctor_name} on *${dateStr}*.\n\n` +
          `Please book your follow-up appointment through this chat by sending "Hi" and selecting "Book for Self".\n\n` +
          `If you've already booked or no longer need the follow-up, you can ignore this message.\n\n` +
          `Regards,\n${hospital_name || "Hospital"}`

        const result = await sendText(patient_phone, message)

        const supabase = createServerClient()
        await supabase.from("reminders").upsert({
          booking_id,
          type: "follow-up",
          sent: result.success ? "yes" : "failed",
          sent_at: new Date().toISOString(),
        }, { onConflict: "booking_id,type" })

        return result
      }

      // Regular appointment reminders (24h / 2h)
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
      // Feedback request — sent 30 min after consultation
      if (job.name === "feedback-request") {
        const { patient_phone, patient_name, doctor_name, booking_id, hospital_name } = job.data

        // Check if feedback already exists
        const supabase = createServerClient()
        const { data: existing } = await supabase
          .from("feedback")
          .select("id")
          .eq("booking_id", booking_id)
          .maybeSingle()

        if (existing) {
          console.log(`[notification] Feedback already exists for ${booking_id}, skipping`)
          return { skipped: true }
        }

        // Set session state to FEEDBACK_RATING so next message triggers feedback flow
        const phone = patient_phone.replace(/\D/g, "")
        await supabase
          .from("chat_sessions")
          .update({
            booking_state: {
              state: "FEEDBACK_RATING",
              data: {
                feedbackBookingId: booking_id,
                feedbackDoctorId: job.data.doctor_id || "",
                feedbackDoctorName: doctor_name || "",
                feedbackSpecialty: job.data.specialty || "",
                patientName: patient_name || "",
              },
            },
          })
          .eq("phone", phone)
          .eq("tenant_id", job.data.tenant_id || "T001")

        // Send feedback request via sendReply to get interactive buttons
        const { sendReply } = await import("@/lib/whatsapp/send-reply")
        const { getTenantWhatsAppConfig } = await import("@/lib/whatsapp/sender")
        const waConfig = await getTenantWhatsAppConfig(job.data.tenant_id || "T001", supabase)

        const feedbackMsg = `*${hospital_name || "Hospital"}*\n\nDear ${patient_name || "Patient"},\n\nThank you for visiting us today! We hope your consultation with Dr. ${doctor_name} was helpful.\n\nWe'd love to hear your feedback. Please rate your experience:\n[BUTTONS:rating]`

        return await sendReply({
          senderPhone: patient_phone,
          messageId: "",
          aiReply: feedbackMsg,
          language: "en",
          waToken: waConfig.accessToken || "",
          waApiUrl: `https://graph.facebook.com/v21.0/${waConfig.phoneNumberId}/messages`,
          tenantConfig: {},
        })
      }

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
          .lt("booked_at", twoHoursAgo)
          .select("booking_id")

        const count = data?.length || 0
        if (error) {
          console.error("[cleanup] Expired unpaid error:", error.message)
        } else if (count > 0) {
          console.log(`[cleanup] Cancelled ${count} expired unpaid appointments`)
        }

        return { cleaned: count }
      }

      // Slot lock cleanup — every 2 min (replaces n8n VrzHF8t9CxVlnUlu)
      if (job.name === "cleanup-slot-locks") {
        const now = new Date().toISOString()
        const errors: string[] = []

        // 1. Delete expired slot locks
        const { data: deletedLocks, error: lockErr } = await supabase
          .from("slot_locks")
          .delete()
          .lt("expires_at", now)
          .select("booking_id")

        if (lockErr) errors.push(`slot_locks: ${lockErr.message}`)

        // 2. Expire stale pending_payment appointments with expired locks
        const { data: expiredAppts, error: apptErr } = await supabase
          .from("appointments")
          .update({ status: "expired", payment_status: "expired" })
          .eq("status", "pending_payment")
          .lt("locked_until", now)
          .select("booking_id")

        if (apptErr) errors.push(`appointments: ${apptErr.message}`)

        const locksDeleted = deletedLocks?.length || 0
        const apptsExpired = expiredAppts?.length || 0

        if (locksDeleted > 0 || apptsExpired > 0) {
          console.log(`[cleanup] Slot locks: ${locksDeleted} deleted, ${apptsExpired} appointments expired`)
        }
        if (errors.length > 0) {
          console.error("[cleanup] Slot lock errors:", errors.join("; "))
        }

        return { deleted_locks: locksDeleted, expired_appointments: apptsExpired, errors }
      }

      // OP Pass expiry — daily midnight IST (replaces n8n MgEgaT6F7xmCEzss)
      if (job.name === "expire-op-passes") {
        // Calculate today in IST
        const istMs = Date.now() + 5.5 * 3600000
        const istDate = new Date(istMs)
        const todayIST = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, "0")}-${String(istDate.getUTCDate()).padStart(2, "0")}`

        const { data: expired, error } = await supabase
          .from("op_passes")
          .update({ status: "EXPIRED" })
          .eq("status", "ACTIVE")
          .lt("expiry_date", todayIST)
          .select("op_pass_id")

        const count = expired?.length || 0
        if (error) {
          console.error("[cleanup] OP pass expiry error:", error.message)
        }

        // Send admin alert
        const adminPhone = process.env.ADMIN_ALERT_PHONE
        if (adminPhone && (count > 0 || error)) {
          const msg = [
            `*OP Pass Expiry Report*`,
            ``,
            `Date: ${todayIST}`,
            `Expired Passes: ${count}`,
            error ? `Error: ${error.message}` : "",
          ].filter(Boolean).join("\n")

          await sendText(adminPhone, msg).catch(() => {})
        }

        if (count > 0) {
          console.log(`[cleanup] Expired ${count} OP passes (date: ${todayIST})`)
        }

        return { expired_passes: count, date: todayIST }
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
