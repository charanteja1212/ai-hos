import { describe, it, expect } from 'vitest'
import { humanizeStatus, formatPhone, getInitials, formatCurrency } from '@/lib/utils/format'

describe('humanizeStatus', () => {
  it('should return mapped status label', () => {
    expect(humanizeStatus('confirmed')).toBe('Confirmed')
    expect(humanizeStatus('pending_payment')).toBe('Pending Payment')
    expect(humanizeStatus('no_show')).toBe('No Show')
    expect(humanizeStatus('checked_in')).toBe('Checked In')
    expect(humanizeStatus('in_consultation')).toBe('In Consultation')
  })

  it('should return all known statuses', () => {
    const knownStatuses = [
      'confirmed', 'completed', 'cancelled', 'pending', 'pending_payment',
      'no_show', 'checked_in', 'in_consultation', 'admitted', 'discharged',
      'transferred', 'waiting', 'active', 'done', 'dispensed', 'collected',
      'processing', 'ready',
    ]
    for (const status of knownStatuses) {
      const result = humanizeStatus(status)
      expect(result).toBeTruthy()
      // Should NOT contain underscores
      expect(result).not.toContain('_')
    }
  })

  it('should fallback to title-case for unknown status', () => {
    expect(humanizeStatus('some_custom_status')).toBe('Some Custom Status')
  })

  it('should return "Unknown" for null', () => {
    expect(humanizeStatus(null)).toBe('Unknown')
  })

  it('should return "Unknown" for undefined', () => {
    expect(humanizeStatus(undefined)).toBe('Unknown')
  })

  it('should return "Unknown" for empty string', () => {
    expect(humanizeStatus('')).toBe('Unknown')
  })
})

describe('formatPhone', () => {
  it('should format 10-digit Indian phone', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210')
  })

  it('should format 12-digit phone starting with 91', () => {
    expect(formatPhone('919876543210')).toBe('+91 98765 43210')
  })

  it('should return "-" for null', () => {
    expect(formatPhone(null)).toBe('-')
  })

  it('should return "-" for undefined', () => {
    expect(formatPhone(undefined)).toBe('-')
  })

  it('should return "-" for empty string', () => {
    expect(formatPhone('')).toBe('-')
  })

  it('should return original for non-standard format', () => {
    expect(formatPhone('12345')).toBe('12345')
  })

  it('should handle phone with + prefix', () => {
    // +919876543210 → digits = 919876543210 → 12 digits starting with 91
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210')
  })
})

describe('getInitials', () => {
  it('should return first two initials', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('should return single initial for single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('should return max two initials for long names', () => {
    expect(getInitials('John Michael Doe Smith')).toBe('JM')
  })

  it('should uppercase the initials', () => {
    expect(getInitials('john doe')).toBe('JD')
  })

  it('should return "?" for null', () => {
    expect(getInitials(null)).toBe('?')
  })

  it('should return "?" for undefined', () => {
    expect(getInitials(undefined)).toBe('?')
  })

  it('should return "?" for empty string', () => {
    expect(getInitials('')).toBe('?')
  })
})

describe('formatCurrency', () => {
  it('should format positive amount with rupee symbol', () => {
    const result = formatCurrency(500)
    expect(result).toContain('500')
    expect(result).toContain('₹')
  })

  it('should format large amount with Indian locale grouping', () => {
    const result = formatCurrency(100000)
    expect(result).toContain('₹')
    expect(result).toContain('1,00,000')
  })

  it('should return ₹0 for null', () => {
    expect(formatCurrency(null)).toBe('₹0')
  })

  it('should return ₹0 for undefined', () => {
    expect(formatCurrency(undefined)).toBe('₹0')
  })

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('₹0')
  })
})
