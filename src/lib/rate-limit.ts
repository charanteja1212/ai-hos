/**
 * Rate limiter — Redis-backed with in-memory fallback.
 * Uses Redis INCR + PEXPIRE for atomic sliding window counting.
 * Falls back to in-memory Map if Redis is unavailable.
 */

import type IORedis from "ioredis"

// ─── In-Memory Fallback ─────────────────────────────────────────────────────

interface RateLimitEntry {
  attempts: number
  windowStart: number
}

const memStore = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memStore) {
    if (now - entry.windowStart > 15 * 60 * 1000) {
      memStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

function memCheck(id: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = memStore.get(id)
  if (!entry || now - entry.windowStart > windowMs) {
    memStore.set(id, { attempts: 1, windowStart: now })
    return false
  }
  if (entry.attempts >= max) return true
  entry.attempts++
  return false
}

// ─── Redis Client (lazy singleton) ──────────────────────────────────────────

let redis: IORedis | null = null
let redisOk = false

function getRedis(): IORedis | null {
  if (redis) return redisOk ? redis : null
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis")
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times: number) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
    }) as IORedis
    redis.connect().then(() => { redisOk = true }).catch(() => { redisOk = false })
    redis.on("error", () => { redisOk = false })
    redis.on("connect", () => { redisOk = true })
    return redisOk ? redis : null
  } catch {
    return null
  }
}

// ─── Public API (async, backwards-compatible signature) ─────────────────────

/**
 * Check if an identifier has exceeded the rate limit.
 * @returns true if rate limited (should block), false if allowed
 */
export async function isRateLimited(
  identifier: string,
  maxAttempts: number,
  windowMs: number = 15 * 60 * 1000
): Promise<boolean> {
  const r = getRedis()
  if (r) {
    try {
      const key = `rl:${identifier}`
      const count = await r.incr(key)
      if (count === 1) await r.pexpire(key, windowMs)
      return count > maxAttempts
    } catch {
      // Redis error — fall back
    }
  }
  return memCheck(identifier, maxAttempts, windowMs)
}

/**
 * Reset rate limit for an identifier (e.g., after successful login).
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  memStore.delete(identifier)
  const r = getRedis()
  if (r) {
    try { await r.del(`rl:${identifier}`) } catch { /* ignore */ }
  }
}
