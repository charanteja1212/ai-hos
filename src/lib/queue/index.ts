/**
 * Queue System — Entry point
 *
 * Import this in instrumentation.ts to auto-start workers on server boot.
 * Exports queue functions for use in API routes.
 */

export { getReminderQueue, getNotificationQueue, getCleanupQueue, getReportQueue, scheduleReminders, cancelReminders, initRepeatableJobs } from "./queues"
export { startWorkers } from "./workers"
export { getRedisConnection, closeRedis } from "./connection"
