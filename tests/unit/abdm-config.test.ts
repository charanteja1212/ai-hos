import { describe, it, expect } from 'vitest'
import {
  formatAbhaNumber,
  isValidAbhaNumber,
  isValidAbhaAddress,
  getEndpoints,
  ABDM_ENDPOINTS,
  HEALTH_INFO_TYPES,
  CONSENT_PURPOSES,
} from '@/lib/abdm/config'

describe('formatAbhaNumber', () => {
  it('should format 14-digit number with dashes', () => {
    expect(formatAbhaNumber('12345678901234')).toBe('12-3456-7890-1234')
  })

  it('should handle already-dashed input by stripping and reformatting', () => {
    expect(formatAbhaNumber('12-3456-7890-1234')).toBe('12-3456-7890-1234')
  })

  it('should return raw string if not 14 digits', () => {
    expect(formatAbhaNumber('12345')).toBe('12345')
    expect(formatAbhaNumber('123456789012345')).toBe('123456789012345') // 15 digits
  })

  it('should strip non-digit chars before formatting', () => {
    expect(formatAbhaNumber('12 3456 7890 1234')).toBe('12-3456-7890-1234')
  })

  it('should handle empty string', () => {
    expect(formatAbhaNumber('')).toBe('')
  })
})

describe('isValidAbhaNumber', () => {
  it('should accept 14-digit number', () => {
    expect(isValidAbhaNumber('12345678901234')).toBe(true)
  })

  it('should accept formatted ABHA number', () => {
    expect(isValidAbhaNumber('12-3456-7890-1234')).toBe(true)
  })

  it('should reject short number', () => {
    expect(isValidAbhaNumber('12345')).toBe(false)
  })

  it('should reject 15-digit number', () => {
    expect(isValidAbhaNumber('123456789012345')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidAbhaNumber('')).toBe(false)
  })
})

describe('isValidAbhaAddress', () => {
  it('should accept valid abdm address', () => {
    expect(isValidAbhaAddress('username@abdm')).toBe(true)
  })

  it('should accept sandbox address', () => {
    expect(isValidAbhaAddress('testuser@sbx')).toBe(true)
  })

  it('should accept address with dots and underscores', () => {
    expect(isValidAbhaAddress('john.doe_123@abdm')).toBe(true)
  })

  it('should reject address without domain', () => {
    expect(isValidAbhaAddress('username')).toBe(false)
  })

  it('should reject address with wrong domain', () => {
    expect(isValidAbhaAddress('username@gmail.com')).toBe(false)
    expect(isValidAbhaAddress('username@nha')).toBe(false)
  })

  it('should reject address with spaces', () => {
    expect(isValidAbhaAddress('user name@abdm')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidAbhaAddress('')).toBe(false)
  })

  it('should reject special chars in username', () => {
    expect(isValidAbhaAddress('user@name@abdm')).toBe(false)
    expect(isValidAbhaAddress('user!name@abdm')).toBe(false)
  })
})

describe('getEndpoints', () => {
  it('should return sandbox endpoints', () => {
    const endpoints = getEndpoints('sandbox')
    expect(endpoints.gateway).toContain('dev.abdm.gov.in')
    expect(endpoints.abha).toContain('abhasbx')
    expect(endpoints).toEqual(ABDM_ENDPOINTS.sandbox)
  })

  it('should return production endpoints', () => {
    const endpoints = getEndpoints('production')
    expect(endpoints.gateway).toContain('live.abdm.gov.in')
    expect(endpoints.abha).toContain('abha.abdm.gov.in')
    expect(endpoints).toEqual(ABDM_ENDPOINTS.production)
  })
})

describe('Constants', () => {
  it('should have expected health info types', () => {
    const values = HEALTH_INFO_TYPES.map(t => t.value)
    expect(values).toContain('OPConsultation')
    expect(values).toContain('Prescription')
    expect(values).toContain('DischargeSummary')
    expect(values).toContain('DiagnosticReport')
    expect(HEALTH_INFO_TYPES.length).toBeGreaterThanOrEqual(7)
  })

  it('should have expected consent purposes', () => {
    const codes = CONSENT_PURPOSES.map(p => p.code)
    expect(codes).toContain('CAREMGT')
    expect(codes).toContain('BTGACCESS')
    expect(codes).toContain('HPAYMT')
    expect(CONSENT_PURPOSES.length).toBe(5)
  })
})
