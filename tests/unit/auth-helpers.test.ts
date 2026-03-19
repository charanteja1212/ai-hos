import { describe, it, expect, vi } from 'vitest'

// Mock the auth module to avoid next-auth / next/server import errors
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

// Mock next/navigation to avoid redirect errors
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { isSuperAdmin, isClientAdmin, isBranchAdmin } from '@/lib/auth/helpers'

// Minimal SessionUser mock matching the interface
function mockUser(role: string) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role,
    tenant_id: 'tenant-1',
    client_id: 'client-1',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('isSuperAdmin', () => {
  it('should return true for SUPER_ADMIN', () => {
    expect(isSuperAdmin(mockUser('SUPER_ADMIN'))).toBe(true)
  })

  it('should return false for CLIENT_ADMIN', () => {
    expect(isSuperAdmin(mockUser('CLIENT_ADMIN'))).toBe(false)
  })

  it('should return false for DOCTOR', () => {
    expect(isSuperAdmin(mockUser('DOCTOR'))).toBe(false)
  })

  it('should return false for all non-super roles', () => {
    const roles = ['CLIENT_ADMIN', 'BRANCH_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTION', 'LAB_TECH', 'PHARMACIST', 'PATIENT']
    for (const role of roles) {
      expect(isSuperAdmin(mockUser(role))).toBe(false)
    }
  })
})

describe('isClientAdmin', () => {
  it('should return true for SUPER_ADMIN', () => {
    expect(isClientAdmin(mockUser('SUPER_ADMIN'))).toBe(true)
  })

  it('should return true for CLIENT_ADMIN', () => {
    expect(isClientAdmin(mockUser('CLIENT_ADMIN'))).toBe(true)
  })

  it('should return false for BRANCH_ADMIN', () => {
    expect(isClientAdmin(mockUser('BRANCH_ADMIN'))).toBe(false)
  })

  it('should return false for DOCTOR', () => {
    expect(isClientAdmin(mockUser('DOCTOR'))).toBe(false)
  })

  it('should return false for non-admin roles', () => {
    const roles = ['BRANCH_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTION', 'LAB_TECH', 'PHARMACIST', 'PATIENT']
    for (const role of roles) {
      expect(isClientAdmin(mockUser(role))).toBe(false)
    }
  })
})

describe('isBranchAdmin', () => {
  it('should return true for SUPER_ADMIN', () => {
    expect(isBranchAdmin(mockUser('SUPER_ADMIN'))).toBe(true)
  })

  it('should return true for CLIENT_ADMIN', () => {
    expect(isBranchAdmin(mockUser('CLIENT_ADMIN'))).toBe(true)
  })

  it('should return true for BRANCH_ADMIN', () => {
    expect(isBranchAdmin(mockUser('BRANCH_ADMIN'))).toBe(true)
  })

  it('should return true for ADMIN', () => {
    expect(isBranchAdmin(mockUser('ADMIN'))).toBe(true)
  })

  it('should return false for DOCTOR', () => {
    expect(isBranchAdmin(mockUser('DOCTOR'))).toBe(false)
  })

  it('should return false for RECEPTION', () => {
    expect(isBranchAdmin(mockUser('RECEPTION'))).toBe(false)
  })

  it('should return false for non-admin roles', () => {
    const roles = ['DOCTOR', 'RECEPTION', 'LAB_TECH', 'PHARMACIST', 'PATIENT']
    for (const role of roles) {
      expect(isBranchAdmin(mockUser(role))).toBe(false)
    }
  })

  it('should represent correct admin hierarchy', () => {
    // SUPER_ADMIN > CLIENT_ADMIN > BRANCH_ADMIN / ADMIN > staff
    expect(isBranchAdmin(mockUser('SUPER_ADMIN'))).toBe(true)
    expect(isClientAdmin(mockUser('SUPER_ADMIN'))).toBe(true)
    expect(isSuperAdmin(mockUser('SUPER_ADMIN'))).toBe(true)

    expect(isBranchAdmin(mockUser('CLIENT_ADMIN'))).toBe(true)
    expect(isClientAdmin(mockUser('CLIENT_ADMIN'))).toBe(true)
    expect(isSuperAdmin(mockUser('CLIENT_ADMIN'))).toBe(false)

    expect(isBranchAdmin(mockUser('BRANCH_ADMIN'))).toBe(true)
    expect(isClientAdmin(mockUser('BRANCH_ADMIN'))).toBe(false)
    expect(isSuperAdmin(mockUser('BRANCH_ADMIN'))).toBe(false)
  })
})
