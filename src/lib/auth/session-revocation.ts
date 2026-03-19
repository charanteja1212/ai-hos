/**
 * Session revocation — Redis-backed token blacklisting with in-memory fallback.
 * Uses the same Redis connection pattern as rate-limit.ts.
 * Call revokeSession() on logout to blacklist the token.
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

// ─── In-Memory Fallback (single-instance only) ─────────────────────────────

const revokedTokens = new Set<string>()

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Revoke a session token (call on logout).
 * Token is blacklisted for 24 hours (matching session max age).
 */
export async function revokeSession(sessionToken: string): Promise<void> {
  revokedTokens.add(sessionToken)

  const r = getRedis()
  if (r) {
    try {
      await r.set(`revoked:${sessionToken}`, "1", "EX", 86400) // 24h
    } catch {
      // Redis error — fall through to memory
    }
  }
}

/**
 * Check if a session token has been revoked.
 */
export async function isSessionRevoked(sessionToken: string): Promise<boolean> {
  if (revokedTokens.has(sessionToken)) return true

  const r = getRedis()
  if (r) {
    try {
      const result = await r.get(`revoked:${sessionToken}`)
      return result === "1"
    } catch {
      // Redis error — fall through
    }
  }
  return false
}

/**
 * Revoke all sessions for a user (force logout everywhere).
 */
export async function revokeAllUserSessions(userEmail: string): Promise<void> {
  const r = getRedis()
  if (r) {
    try {
      await r.set(`user-revoked:${userEmail}`, Date.now().toString(), "EX", 86400)
    } catch { /* ignore */ }
  }
}

/**
 * Check if user's sessions were bulk-revoked after a given timestamp.
 */
export async function isUserSessionsRevoked(
  userEmail: string,
  sessionCreatedAt: number
): Promise<boolean> {
  const r = getRedis()
  if (r) {
    try {
      const revokedAt = await r.get(`user-revoked:${userEmail}`)
      if (revokedAt && parseInt(revokedAt) > sessionCreatedAt) return true
    } catch {
      // Redis error — fall through
    }
  }
  return false
}
