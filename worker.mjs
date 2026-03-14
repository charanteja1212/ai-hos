/**
 * Standalone BullMQ Worker Process
 *
 * Runs all background job workers (reminder, notification, cleanup, report)
 * in a separate process from the Next.js app server.
 *
 * Usage: node worker.mjs
 * Requires: REDIS_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY env vars
 */

import { Worker, Queue } from "bullmq"
import IORedis from "ioredis"
import { createClient } from "@supabase/supabase-js"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[worker] SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
  process.exit(1)
}

const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log("[worker] Connecting to Redis:", REDIS_URL.replace(/\/\/.*@/, "//***@"))

// ─── WhatsApp Sender (simplified — calls the app's API) ─────────────────────

const WA_API_URL = process.env.WA_API_URL || "https://graph.facebook.com/v21.0"

async function sendWhatsAppText(phone, message, tenantConfig) {
  if (!tenantConfig?.wa_token || !tenantConfig?.whatsapp_phone_id) {
    console.log(`[worker] No WhatsApp config for sending to ${phone}`)
    return { success: false, error: "No WhatsApp config" }
  }

  try {
    const resp = await fetch(`${WA_API_URL}/${tenantConfig.whatsapp_phone_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tenantConfig.wa_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.startsWith("91") ? phone : `91${phone}`,
        type: "text",
        text: { body: message },
      }),
    })
    return { success: resp.ok }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function getTenantConfig(tenantId) {
  const { data } = await supabase
    .from("tenants")
    .select("wa_token, whatsapp_phone_id, hospital_name, admin_phone")
    .eq("tenant_id", tenantId)
    .single()
  return data
}

// ─── Reminder Worker ────────────────────────────────────────────────────────

new Worker(
  "reminder",
  async (job) => {
    const { patient_phone, patient_name, doctor_name, date, time, booking_id, hospital_name, hoursUntil, tenant_id } = job.data

    console.log(`[reminder] Sending ${hoursUntil}h reminder for ${booking_id}`)

    const { data: appt } = await supabase
      .from("appointments")
      .select("status")
      .eq("booking_id", booking_id)
      .single()

    if (!appt || appt.status !== "confirmed") {
      console.log(`[reminder] Skipping ${booking_id} — status: ${appt?.status || "not found"}`)
      return { skipped: true }
    }

    const config = await getTenantConfig(tenant_id)
    const msg = `*Appointment Reminder*\n\nHi ${patient_name}, this is a reminder for your appointment:\n\nDoctor: Dr. ${doctor_name}\nDate: ${date}\nTime: ${time}\nHospital: ${hospital_name}\n\nPlease arrive 15 minutes early.`

    const result = await sendWhatsAppText(patient_phone, msg, config)

    await supabase.from("reminders").upsert({
      booking_id,
      type: `${hoursUntil}h`,
      sent: result.success ? "yes" : "failed",
      sent_at: new Date().toISOString(),
    }, { onConflict: "booking_id,type" })

    return result
  },
  { connection: redis, concurrency: 5 }
)

// ─── Notification Worker ────────────────────────────────────────────────────

new Worker(
  "notification",
  async (job) => {
    const { phone, message, tenant_id } = job.data
    const config = tenant_id ? await getTenantConfig(tenant_id) : null
    if (config) {
      return await sendWhatsAppText(phone, message, config)
    }
    console.log(`[notification] No tenant config for ${phone}`)
    return { success: false, error: "No tenant config" }
  },
  { connection: redis, concurrency: 10 }
)

// ─── Cleanup Worker ─────────────────────────────────────────────────────────

new Worker(
  "cleanup",
  async (job) => {
    if (job.name === "cleanup-expired-unpaid") {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("status", "pending_payment")
        .lt("created_at", twoHoursAgo)
        .select("booking_id")

      const count = data?.length || 0
      if (error) console.error("[cleanup] Error:", error.message)
      else if (count > 0) console.log(`[cleanup] Cancelled ${count} expired unpaid appointments`)
      return { cleaned: count }
    }

    if (job.name === "cleanup-slot-locks") {
      const now = new Date().toISOString()
      const { data: deletedLocks } = await supabase
        .from("slot_locks")
        .delete()
        .lt("expires_at", now)
        .select("booking_id")

      const { data: expiredAppts } = await supabase
        .from("appointments")
        .update({ status: "expired", payment_status: "expired" })
        .eq("status", "pending_payment")
        .lt("locked_until", now)
        .select("booking_id")

      const locks = deletedLocks?.length || 0
      const appts = expiredAppts?.length || 0
      if (locks > 0 || appts > 0) {
        console.log(`[cleanup] Locks: ${locks} deleted, ${appts} appointments expired`)
      }
      return { deleted_locks: locks, expired_appointments: appts }
    }

    if (job.name === "expire-op-passes") {
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
      if (error) console.error("[cleanup] OP pass error:", error.message)
      if (count > 0) console.log(`[cleanup] Expired ${count} OP passes`)
      return { expired_passes: count }
    }

    return { skipped: true }
  },
  { connection: redis, concurrency: 1 }
)

// ─── Report Worker ──────────────────────────────────────────────────────────

new Worker(
  "report",
  async (job) => {
    if (job.name === "daily-revenue-report") {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

      const { data: tenants } = await supabase
        .from("tenants")
        .select("tenant_id, hospital_name, admin_phone, wa_token, whatsapp_phone_id")
        .eq("status", "active")

      for (const tenant of tenants || []) {
        const { count: apptCount } = await supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.tenant_id)
          .eq("date", yesterday)

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
            `Total Appointments: ${apptCount || 0}`,
            `Total Revenue: Rs ${revenue.toLocaleString("en-IN")}`,
          ].join("\n")

          await sendWhatsAppText(tenant.admin_phone, report, tenant).catch(() => {})
        }
      }

      return { success: true, tenants: tenants?.length || 0 }
    }
    return { skipped: true }
  },
  { connection: redis, concurrency: 1 }
)

// ─── Schedule Repeatable Jobs ───────────────────────────────────────────────

async function initRepeatableJobs() {
  const cleanupQueue = new Queue("cleanup", { connection: redis })
  const reportQueue = new Queue("report", { connection: redis })

  await cleanupQueue.add("cleanup-expired-unpaid", {}, {
    repeat: { pattern: "0 * * * *" },
    jobId: "cleanup-expired-unpaid",
  })

  await cleanupQueue.add("cleanup-slot-locks", {}, {
    repeat: { pattern: "*/2 * * * *" },
    jobId: "cleanup-slot-locks",
  })

  await cleanupQueue.add("expire-op-passes", {}, {
    repeat: { pattern: "30 18 * * *" },
    jobId: "expire-op-passes",
  })

  await reportQueue.add("daily-revenue-report", {}, {
    repeat: { pattern: "30 1 * * *" },
    jobId: "daily-revenue-report",
  })

  console.log("[worker] Repeatable jobs initialized")
}

// ─── Start ──────────────────────────────────────────────────────────────────

redis.on("connect", async () => {
  console.log("[worker] Redis connected")
  await initRepeatableJobs()
  console.log("[worker] All workers running: reminder, notification, cleanup, report")
})

redis.on("error", (err) => {
  console.error("[worker] Redis error:", err.message)
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[worker] Shutting down...")
  await redis.quit()
  process.exit(0)
})

process.on("SIGINT", async () => {
  console.log("[worker] Shutting down...")
  await redis.quit()
  process.exit(0)
})
