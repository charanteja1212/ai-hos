import { describe, it, expect } from 'vitest'
import { phoneSchema, dateSchema, timeSchema, waActionSchema, sendOtpSchema } from '@/lib/validations/api-schemas'

describe('API Validation Schemas', () => {
  describe('phoneSchema', () => {
    it('should accept valid 10-digit phone', () => {
      expect(phoneSchema.safeParse('9876543210').success).toBe(true)
    })

    it('should accept valid 12-digit phone with country code', () => {
      expect(phoneSchema.safeParse('919876543210').success).toBe(true)
    })

    it('should reject short phone number', () => {
      expect(phoneSchema.safeParse('12345').success).toBe(false)
    })

    it('should reject phone with letters', () => {
      expect(phoneSchema.safeParse('98765abc10').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(phoneSchema.safeParse('').success).toBe(false)
    })

    it('should accept 11-digit phone', () => {
      expect(phoneSchema.safeParse('12345678901').success).toBe(true)
    })
  })

  describe('dateSchema', () => {
    it('should accept YYYY-MM-DD format', () => {
      expect(dateSchema.safeParse('2026-03-19').success).toBe(true)
    })

    it('should reject DD-MM-YYYY format', () => {
      expect(dateSchema.safeParse('19-03-2026').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(dateSchema.safeParse('').success).toBe(false)
    })

    it('should reject date with slashes', () => {
      expect(dateSchema.safeParse('2026/03/19').success).toBe(false)
    })

    it('should accept any valid-format date string', () => {
      expect(dateSchema.safeParse('2000-01-01').success).toBe(true)
      expect(dateSchema.safeParse('2099-12-31').success).toBe(true)
    })
  })

  describe('timeSchema', () => {
    it('should accept 09:30', () => {
      expect(timeSchema.safeParse('09:30').success).toBe(true)
    })

    it('should accept 23:59', () => {
      expect(timeSchema.safeParse('23:59').success).toBe(true)
    })

    it('should accept 00:00', () => {
      expect(timeSchema.safeParse('00:00').success).toBe(true)
    })

    it('should reject 25:00', () => {
      expect(timeSchema.safeParse('25:00').success).toBe(false)
    })

    it('should reject time with seconds', () => {
      expect(timeSchema.safeParse('09:30:00').success).toBe(false)
    })

    it('should reject empty string', () => {
      expect(timeSchema.safeParse('').success).toBe(false)
    })

    it('should reject 24:00', () => {
      expect(timeSchema.safeParse('24:00').success).toBe(false)
    })
  })

  describe('waActionSchema', () => {
    it('should accept valid action with token', () => {
      const result = waActionSchema.safeParse({ token: 'abc123', action: 'lookup_patient' })
      expect(result.success).toBe(true)
    })

    it('should accept all valid actions', () => {
      const validActions = [
        'lookup_patient', 'save_patient', 'list_specialties',
        'check_availability', 'book_appointment', 'list_appointments',
        'cancel_appointment', 'reschedule_appointment', 'list_prescriptions',
      ]
      for (const action of validActions) {
        const result = waActionSchema.safeParse({ token: 'test-token', action })
        expect(result.success).toBe(true)
      }
    })

    it('should reject missing token', () => {
      const result = waActionSchema.safeParse({ action: 'lookup_patient' })
      expect(result.success).toBe(false)
    })

    it('should reject empty token', () => {
      const result = waActionSchema.safeParse({ token: '', action: 'lookup_patient' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid action', () => {
      const result = waActionSchema.safeParse({ token: 'abc', action: 'hack_database' })
      expect(result.success).toBe(false)
    })

    it('should reject missing action', () => {
      const result = waActionSchema.safeParse({ token: 'abc123' })
      expect(result.success).toBe(false)
    })

    it('should allow extra fields (passthrough)', () => {
      const result = waActionSchema.safeParse({
        token: 'abc',
        action: 'book_appointment',
        doctor_id: 'doc-1',
        patient_name: 'John',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('sendOtpSchema', () => {
    it('should accept valid phone', () => {
      expect(sendOtpSchema.safeParse({ phone: '9876543210' }).success).toBe(true)
    })

    it('should reject empty phone', () => {
      expect(sendOtpSchema.safeParse({ phone: '' }).success).toBe(false)
    })

    it('should reject missing phone field', () => {
      expect(sendOtpSchema.safeParse({}).success).toBe(false)
    })
  })
})
