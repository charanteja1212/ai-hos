import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Environment Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should pass with all required env vars', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key'
    process.env.AUTH_SECRET = 'test-secret'
    process.env.SUPABASE_JWT_SECRET = 'test-jwt'

    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).not.toThrow()
  })

  it('should return typed env on success', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key'
    process.env.AUTH_SECRET = 'test-secret'
    process.env.SUPABASE_JWT_SECRET = 'test-jwt'

    const { validateEnv } = await import('@/lib/env')
    const env = validateEnv()
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-key')
  })

  it('should throw in production when required vars are missing', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production'
    // Clear all required vars
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.AUTH_SECRET
    delete process.env.SUPABASE_JWT_SECRET

    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).toThrow()
  })

  it('should not throw in development when required vars are missing', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'development'
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.AUTH_SECRET
    delete process.env.SUPABASE_JWT_SECRET

    const { validateEnv } = await import('@/lib/env')
    // In development, validateEnv logs errors but does not throw
    expect(() => validateEnv()).not.toThrow()
  })

  it('should reject invalid SUPABASE_URL format', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key'
    process.env.AUTH_SECRET = 'test-secret'
    process.env.SUPABASE_JWT_SECRET = 'test-jwt'

    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).toThrow()
  })
})
