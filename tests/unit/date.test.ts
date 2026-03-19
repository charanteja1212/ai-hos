import { describe, it, expect } from 'vitest'
import { formatDate, formatTime, formatDateTime } from '@/lib/utils/date'

describe('formatDate', () => {
  it('should format YYYY-MM-DD to dd MMM yyyy', () => {
    expect(formatDate('2026-03-19')).toBe('19 Mar 2026')
  })

  it('should format first day of year', () => {
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026')
  })

  it('should format last day of year', () => {
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
  })

  it('should handle leap year date', () => {
    expect(formatDate('2024-02-29')).toBe('29 Feb 2024')
  })
})

describe('formatTime', () => {
  it('should convert 09:30 to 9:30 AM', () => {
    expect(formatTime('09:30')).toBe('9:30 AM')
  })

  it('should convert 13:00 to 1:00 PM', () => {
    expect(formatTime('13:00')).toBe('1:00 PM')
  })

  it('should convert 00:00 to 12:00 AM', () => {
    expect(formatTime('00:00')).toBe('12:00 AM')
  })

  it('should convert 12:00 to 12:00 PM', () => {
    expect(formatTime('12:00')).toBe('12:00 PM')
  })

  it('should convert 23:59 to 11:59 PM', () => {
    expect(formatTime('23:59')).toBe('11:59 PM')
  })

  it('should pass through already-formatted 12h time', () => {
    expect(formatTime('10:30 AM')).toBe('10:30 AM')
  })

  it('should pass through PM time as-is', () => {
    expect(formatTime('3:00 PM')).toBe('3:00 PM')
  })

  it('should handle HH:mm:ss format (ignores seconds)', () => {
    expect(formatTime('14:30:00')).toBe('2:30 PM')
  })

  it('should handle time with leading space', () => {
    expect(formatTime(' 10:30 AM')).toBe('10:30 AM')
  })
})

describe('formatDateTime', () => {
  it('should combine date and time formatting', () => {
    expect(formatDateTime('2026-03-19', '14:30')).toBe('19 Mar 2026 at 2:30 PM')
  })

  it('should handle morning time', () => {
    expect(formatDateTime('2026-01-01', '09:00')).toBe('01 Jan 2026 at 9:00 AM')
  })

  it('should handle already-formatted time', () => {
    expect(formatDateTime('2026-06-15', '3:00 PM')).toBe('15 Jun 2026 at 3:00 PM')
  })
})
