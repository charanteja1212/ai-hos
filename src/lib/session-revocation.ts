/**
 * Session revocation / token blacklisting.
 * Uses the same Redis + in-memory fallback pattern as cache.ts.
 * Provides revoke/check for individual sessions and bulk user revocation.
 */

import type IORedis from "ioredis"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"

const log = logger.child({ module: "session-revocation" })

const DEFAULT_TTL = 86400 // 24 hours

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

// ─── In-Memory Fallback ─────────────────────────────────────────────────────

// value = expiry timestamp (ms)
const revokedSessions = new Map<string, number>()
const revokedUsers = new Map<string, number>()

// Clean expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, expiresAt] of revokedSessions) {
    if (now > expiresAt) revokedSessions.delete(key)
  }
  for (const [key, expiresAt] of revokedUsers) {
    if (now > expiresAt) revokedUsers.delete(key)
  }
}, 5 * 60 * 1000)

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Add a session token to the blacklist.
 */
export async function revokeSession(sessionToken: string, expiresInSeconds: number = DEFAULT_TTL): Promise<void> {
  const r = getRedis()
  if (r) {
    try {
      await r.set(`revoked:session:${sessionToken}`, "1", "EX", expiresInSeconds)
    } catch {
      // Redis error — fall through to memory
    }
  }

  revokedSessions.set(sessionToken, Date.now() + expiresInSeconds * 1000)
  log.info({ tokenPrefix: sessionToken.slice(0, 8) }, "Session revoked")
}

/**
 * Check if a session token has been revoked.
 */
export async function isSessionRevoked(sessionToken: string): Promise<boolean> {
  const r = getRedis()
  if (r) {
    try {
      const val = await r.get(`revoked:session:${sessionToken}`)
      if (val) return true
    } catch {
      // Redis error — fall through to memory
    }
  }

  const expiresAt = revokedSessions.get(sessionToken)
  if (expiresAt && Date.now() < expiresAt) return true

  // Clean up expired entry
  if (expiresAt) revokedSessions.delete(sessionToken)
  return false
}

/**
 * Revoke all sessions for a user (bulk revocation).
 */
export async function revokeAllUserSessions(userId: string, expiresInSeconds: number = DEFAULT_TTL): Promise<void> {
  const r = getRedis()
  if (r) {
    try {
      await r.set(`revoked:user:${userId}`, "1", "EX", expiresInSeconds)
    } catch {
      // Redis error — fall through to memory
    }
  }

  revokedUsers.set(userId, Date.now() + expiresInSeconds * 1000)
  log.info({ userId }, "All user sessions revoked")
}

/**
 * Check if all sessions for a user have been revoked.
 */
export async function isUserRevoked(userId: string): Promise<boolean> {
  const r = getRedis()
  if (r) {
    try {
      const val = await r.get(`revoked:user:${userId}`)
      if (val) return true
    } catch {
      // Redis error — fall through to memory
    }
  }

  const expiresAt = revokedUsers.get(userId)
  if (expiresAt && Date.now() < expiresAt) return true

  // Clean up expired entry
  if (expiresAt) revokedUsers.delete(userId)
  return false
}

// ─── Force Logout Helper ────────────────────────────────────────────────────

/**
 * Force-logout a user: revokes all their sessions and logs to audit.
 * Fire-and-forget audit — never throws from audit failure.
 */
export async function forceLogout(userId: string, reason: string): Promise<void> {
  await revokeAllUserSessions(userId)

  log.warn({ userId, reason }, "Force logout triggered")

  // Audit log — fire-and-forget
  logAudit({
    action: "status_change",
    entityType: "session",
    entityId: userId,
    actorEmail: "system",
    actorRole: "system",
    details: { event: "force_logout", reason },
  })
}
