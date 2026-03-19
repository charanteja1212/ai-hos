/**
 * Redis query cache with in-memory fallback.
 * Uses the same Redis connection pattern as rate-limit.ts.
 * Provides get/set/invalidate for common query results.
 */

import type IORedis from "ioredis"

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

// ─── In-Memory Fallback Cache ───────────────────────────────────────────────

const memCache = new Map<string, { data: string; expiresAt: number }>()

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memCache) {
    if (now > entry.expiresAt) memCache.delete(key)
  }
}, 5 * 60 * 1000)

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get cached value by key.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis()
  if (r) {
    try {
      const val = await r.get(`cache:${key}`)
      if (val) return JSON.parse(val)
    } catch {
      // Redis error — fall through to memory
    }
  }

  const mem = memCache.get(key)
  if (mem && Date.now() < mem.expiresAt) {
    return JSON.parse(mem.data)
  }
  return null
}

/**
 * Set cached value with TTL in seconds.
 */
export async function cacheSet<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
  const json = JSON.stringify(data)

  const r = getRedis()
  if (r) {
    try {
      await r.set(`cache:${key}`, json, "EX", ttlSeconds)
    } catch {
      // Redis error — fall through to memory
    }
  }

  memCache.set(key, { data: json, expiresAt: Date.now() + ttlSeconds * 1000 })
}

/**
 * Invalidate cache by key.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  memCache.delete(key)
  const r = getRedis()
  if (r) {
    try { await r.del(`cache:${key}`) } catch { /* ignore */ }
  }
}

/**
 * Invalidate all cache entries matching a prefix.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  // Memory cache
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key)
  }
  // Redis cache
  const r = getRedis()
  if (r) {
    try {
      const keys = await r.keys(`cache:${prefix}*`)
      if (keys.length > 0) await r.del(...keys)
    } catch { /* ignore */ }
  }
}
