import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase before importing the service
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}))

vi.mock('@/lib/queue/queues', () => ({
  scheduleReminders: vi.fn().mockResolvedValue(undefined),
  cancelReminders: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

import {
  getISTDate,
  getISTTime,
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  getDayName,
  trimTime,
} from '@/lib/booking/service'

// ─── Time Utility Tests ──────────────────────────────────────────────────────

describe('getISTDate', () => {
  it('should return a date in YYYY-MM-DD format', () => {
    const result = getISTDate()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('should return a different date with offset', () => {
    const today = getISTDate(0)
    const tomorrow = getISTDate(1)
    // They should differ (except extremely rare midnight edge case)
    expect(tomorrow).not.toBe(today)
  })

  it('should return a past date with negative offset', () => {
    const today = getISTDate(0)
    const yesterday = getISTDate(-1)
    expect(yesterday < today).toBe(true)
  })
})

describe('getISTTime', () => {
  it('should return time in HH:MM format', () => {
    const result = getISTTime()
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('should return a string of length 5', () => {
    expect(getISTTime().length).toBe(5)
  })
})

describe('timeToMinutes', () => {
  it('should convert 00:00 to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0)
  })

  it('should convert 01:00 to 60', () => {
    expect(timeToMinutes('01:00')).toBe(60)
  })

  it('should convert 09:30 to 570', () => {
    expect(timeToMinutes('09:30')).toBe(570)
  })

  it('should convert 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('should convert 12:00 to 720', () => {
    expect(timeToMinutes('12:00')).toBe(720)
  })
})

describe('minutesToTime', () => {
  it('should convert 0 to 00:00', () => {
    expect(minutesToTime(0)).toBe('00:00')
  })

  it('should convert 60 to 01:00', () => {
    expect(minutesToTime(60)).toBe('01:00')
  })

  it('should convert 570 to 09:30', () => {
    expect(minutesToTime(570)).toBe('09:30')
  })

  it('should convert 1439 to 23:59', () => {
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('should pad single-digit hours and minutes', () => {
    expect(minutesToTime(65)).toBe('01:05')
  })

  it('should roundtrip with timeToMinutes', () => {
    const times = ['00:00', '09:30', '12:00', '14:45', '23:59']
    for (const t of times) {
      expect(minutesToTime(timeToMinutes(t))).toBe(t)
    }
  })
})

describe('getDayOfWeek', () => {
  it('should return 0 for a known Sunday', () => {
    // 2026-03-15 is a Sunday
    expect(getDayOfWeek('2026-03-15')).toBe(0)
  })

  it('should return 1 for a known Monday', () => {
    // 2026-03-16 is a Monday
    expect(getDayOfWeek('2026-03-16')).toBe(1)
  })

  it('should return a number between 0 and 6', () => {
    const result = getDayOfWeek('2026-03-19')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(6)
  })
})

describe('getDayName', () => {
  it('should return sunday for a known Sunday', () => {
    expect(getDayName('2026-03-15')).toBe('sunday')
  })

  it('should return monday for a known Monday', () => {
    expect(getDayName('2026-03-16')).toBe('monday')
  })

  it('should return a lowercase day name', () => {
    const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const result = getDayName('2026-03-19')
    expect(validDays).toContain(result)
  })
})

describe('trimTime', () => {
  it('should return falsy input as-is', () => {
    expect(trimTime('')).toBe('')
  })

  it('should trim HH:MM:SS to HH:MM', () => {
    expect(trimTime('14:30:00')).toBe('14:30')
  })

  it('should keep HH:MM unchanged', () => {
    expect(trimTime('09:30')).toBe('09:30')
  })

  it('should convert 2:30 PM to 14:30', () => {
    expect(trimTime('2:30 PM')).toBe('14:30')
  })

  it('should convert 12:00 PM to 12:00', () => {
    expect(trimTime('12:00 PM')).toBe('12:00')
  })

  it('should convert 12:00 AM to 00:00', () => {
    expect(trimTime('12:00 AM')).toBe('00:00')
  })

  it('should convert 9:15 AM to 09:15', () => {
    expect(trimTime('9:15 AM')).toBe('09:15')
  })

  it('should handle case-insensitive AM/PM', () => {
    expect(trimTime('3:45 pm')).toBe('15:45')
    expect(trimTime('3:45 Pm')).toBe('15:45')
  })

  it('should handle HH:MM:SS with AM/PM', () => {
    expect(trimTime('2:30:00 PM')).toBe('14:30')
  })
})
