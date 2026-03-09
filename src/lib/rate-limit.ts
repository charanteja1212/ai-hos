/**
 * In-memory rate limiter for login attempts and OTP verification.
 * Uses sliding window approach. Entries auto-expire.
 *
 * For production at scale, replace with Redis-based implementation.
 */

interface RateLimitEntry {
  attempts: number
  windowStart: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now - entry.windowStart > 15 * 60 * 1000) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check if an identifier has exceeded the rate limit.
 * @param identifier - unique key (e.g., "pin:T001:DOC001", "otp:919876543210")
 * @param maxAttempts - max allowed attempts in the window
 * @param windowMs - time window in milliseconds (default: 15 minutes)
 * @returns true if rate limited (should block), false if allowed
 */
export function isRateLimited(
  identifier: string,
  maxAttempts: number,
  windowMs: number = 15 * 60 * 1000
): boolean {
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || now - entry.windowStart > windowMs) {
    // New window — record first attempt
    store.set(identifier, { attempts: 1, windowStart: now })
    return false
  }

  if (entry.attempts >= maxAttempts) {
    return true // Rate limited
  }

  entry.attempts++
  return false
}

/**
 * Reset rate limit for an identifier (e.g., after successful login).
 */
export function resetRateLimit(identifier: string): void {
  store.delete(identifier)
}
