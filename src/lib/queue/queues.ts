/**
 * BullMQ Queue Definitions — replaces ALL n8n scheduled workflows
 *
 * Queues:
 *   - reminderQueue: 24h + 2h appointment reminders via WhatsApp
 *   - notificationQueue: WhatsApp + SMS dispatch
 *   - cleanupQueue: Expired locks, unpaid bookings
 *   - reportQueue: Nightly revenue reports to admin
 */

import { Queue } from "bullmq"
import { getRedisConnection } from "./connection"

// Lazy-init queues (avoid connecting to Redis during build/SSR)
let _reminderQueue: Queue | null = null
let _notificationQueue: Queue | null = null
let _cleanupQueue: Queue | null = null
let _reportQueue: Queue | null = null

export function getReminderQueue(): Queue {
  if (!_reminderQueue) {
    _reminderQueue = new Queue("reminder", {
      connection: getRedisConnection() as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 60000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
    })
  }
  return _reminderQueue
}

export function getNotificationQueue(): Queue {
  if (!_notificationQueue) {
    _notificationQueue = new Queue("notification", {
      connection: getRedisConnection() as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
    })
  }
  return _notificationQueue
}

export function getCleanupQueue(): Queue {
  if (!_cleanupQueue) {
    _cleanupQueue = new Queue("cleanup", {
      connection: getRedisConnection() as never,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    })
  }
  return _cleanupQueue
}

export function getReportQueue(): Queue {
  if (!_reportQueue) {
    _reportQueue = new Queue("report", {
      connection: getRedisConnection() as never,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    })
  }
  return _reportQueue
}

/**
 * Schedule a reminder for an appointment.
 * Called when a booking is created.
 * Queues two jobs: 24h before and 2h before.
 */
export async function scheduleReminders(appointment: {
  booking_id: string
  patient_phone: string
  patient_name: string
  doctor_name: string
  specialty: string
  date: string
  time: string
  tenant_id: string
  hospital_name: string
}) {
  const queue = getReminderQueue()

  // Calculate appointment datetime in IST
  const appointmentDate = new Date(`${appointment.date}T${appointment.time}:00+05:30`)
  const now = Date.now()

  // 24h reminder
  const reminder24h = appointmentDate.getTime() - 24 * 60 * 60 * 1000
  if (reminder24h > now + 60000) {
    await queue.add(
      "reminder-24h",
      { ...appointment, hoursUntil: 24 },
      {
        delay: reminder24h - now,
        jobId: `reminder-24h-${appointment.booking_id}`,
      }
    )
  }

  // 2h reminder
  const reminder2h = appointmentDate.getTime() - 2 * 60 * 60 * 1000
  if (reminder2h > now + 60000) {
    await queue.add(
      "reminder-2h",
      { ...appointment, hoursUntil: 2 },
      {
        delay: reminder2h - now,
        jobId: `reminder-2h-${appointment.booking_id}`,
      }
    )
  }
}

/**
 * Cancel scheduled reminders when an appointment is cancelled.
 */
export async function cancelReminders(bookingId: string) {
  const queue = getReminderQueue()
  try {
    const job24 = await queue.getJob(`reminder-24h-${bookingId}`)
    if (job24) await job24.remove()
    const job2 = await queue.getJob(`reminder-2h-${bookingId}`)
    if (job2) await job2.remove()
  } catch {
    // Jobs may have already been processed or not exist
  }
}

/**
 * Initialize repeatable cleanup jobs (called once on server start).
 */
export async function initRepeatableJobs() {
  const cleanupQueue = getCleanupQueue()
  const reportQueue = getReportQueue()

  // Cleanup expired unpaid bookings — every hour
  await cleanupQueue.add(
    "cleanup-expired-unpaid",
    {},
    {
      repeat: { pattern: "0 * * * *" },
      jobId: "cleanup-expired-unpaid",
    }
  )

  // Slot lock cleanup — every 2 minutes (replaces n8n VrzHF8t9CxVlnUlu)
  await cleanupQueue.add(
    "cleanup-slot-locks",
    {},
    {
      repeat: { pattern: "*/2 * * * *" },
      jobId: "cleanup-slot-locks",
    }
  )

  // OP Pass expiry — daily at midnight IST (6:30 PM UTC previous day)
  await cleanupQueue.add(
    "expire-op-passes",
    {},
    {
      repeat: { pattern: "30 18 * * *" },
      jobId: "expire-op-passes",
    }
  )

  // Nightly revenue report — every day at 7 AM IST (1:30 AM UTC)
  await reportQueue.add(
    "daily-revenue-report",
    {},
    {
      repeat: { pattern: "30 1 * * *" },
      jobId: "daily-revenue-report",
    }
  )

  console.log("[queue] Repeatable jobs initialized")
}
