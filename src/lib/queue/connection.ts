/**
 * Redis Connection — shared by all BullMQ queues and workers
 */

import IORedis from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

let connection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        return Math.min(times * 200, 5000)
      },
    })

    connection.on("error", (err) => {
      console.error("[redis] Connection error:", err.message)
    })

    connection.on("connect", () => {
      console.log("[redis] Connected to", REDIS_URL.replace(/\/\/.*@/, "//***@"))
    })
  }

  return connection
}

/** Graceful shutdown */
export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit()
    connection = null
  }
}
