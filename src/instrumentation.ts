/**
 * Next.js Instrumentation — runs once on server startup
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Initializes BullMQ workers and repeatable jobs.
 */

export async function register() {
  // Only run on server (not edge runtime, not during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const redisUrl = process.env.REDIS_URL

    // If workers run in a separate container, skip starting them here
    if (process.env.WORKER_MODE === "separate") {
      console.log("[instrumentation] WORKER_MODE=separate — workers run in dedicated container")
      return
    }

    if (redisUrl) {
      try {
        const { startWorkers, initRepeatableJobs } = await import("@/lib/queue")
        startWorkers()
        await initRepeatableJobs()
        console.log("[instrumentation] BullMQ workers + repeatable jobs started")
      } catch (err) {
        console.error("[instrumentation] Failed to start queue system:", err)
        // Don't crash the server — queues are non-critical
      }
    } else {
      console.log("[instrumentation] REDIS_URL not set — queue system disabled (dev mode)")
    }
  }
}
