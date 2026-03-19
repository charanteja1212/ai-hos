import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock ioredis so require("ioredis") inside rate-limit.ts won't fail
vi.mock('ioredis', () => {
  return { default: vi.fn() }
})

// We need to reset modules between tests to clear the in-memory store
describe('Rate Limiter (in-memory fallback)', () => {
  let isRateLimited: typeof import('@/lib/rate-limit').isRateLimited
  let resetRateLimit: typeof import('@/lib/rate-limit').resetRateLimit

  beforeEach(async () => {
    // Delete REDIS_URL so it uses in-memory fallback
    delete process.env.REDIS_URL
    // Reset module to get clean memStore
    vi.resetModules()
    const mod = await import('@/lib/rate-limit')
    isRateLimited = mod.isRateLimited
    resetRateLimit = mod.resetRateLimit
  })

  it('should allow requests under the limit', async () => {
    const result = await isRateLimited('test-user', 5, 60000)
    expect(result).toBe(false)
  })

  it('should block after exceeding max attempts', async () => {
    // Max 3 attempts
    expect(await isRateLimited('user-1', 3, 60000)).toBe(false) // 1
    expect(await isRateLimited('user-1', 3, 60000)).toBe(false) // 2
    expect(await isRateLimited('user-1', 3, 60000)).toBe(false) // 3
    expect(await isRateLimited('user-1', 3, 60000)).toBe(true)  // 4 → blocked
  })

  it('should track different identifiers separately', async () => {
    expect(await isRateLimited('ip-1', 2, 60000)).toBe(false) // ip-1: 1
    expect(await isRateLimited('ip-2', 2, 60000)).toBe(false) // ip-2: 1
    expect(await isRateLimited('ip-1', 2, 60000)).toBe(false) // ip-1: 2
    expect(await isRateLimited('ip-1', 2, 60000)).toBe(true)  // ip-1: 3 → blocked
    expect(await isRateLimited('ip-2', 2, 60000)).toBe(false) // ip-2: 2
  })

  it('should reset after window expires', async () => {
    // Use a very short window (50ms) so we can test with real timers
    expect(await isRateLimited('expire-test', 1, 50)).toBe(false) // 1
    expect(await isRateLimited('expire-test', 1, 50)).toBe(true)  // 2 → blocked

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 60))

    expect(await isRateLimited('expire-test', 1, 50)).toBe(false) // window reset → 1
  })

  it('should reset rate limit manually', async () => {
    expect(await isRateLimited('reset-test', 1, 60000)).toBe(false) // 1
    expect(await isRateLimited('reset-test', 1, 60000)).toBe(true)  // 2 → blocked

    await resetRateLimit('reset-test')

    expect(await isRateLimited('reset-test', 1, 60000)).toBe(false) // reset → 1
  })

  it('should handle max=1 as single request allowed', async () => {
    expect(await isRateLimited('single', 1, 60000)).toBe(false)
    expect(await isRateLimited('single', 1, 60000)).toBe(true)
  })

  it('should handle concurrent identifiers', async () => {
    // Simulate rate limiting multiple IPs simultaneously
    const results = await Promise.all([
      isRateLimited('concurrent-a', 2, 60000),
      isRateLimited('concurrent-b', 2, 60000),
      isRateLimited('concurrent-c', 2, 60000),
    ])
    expect(results).toEqual([false, false, false])
  })
})
