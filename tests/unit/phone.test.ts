import { describe, it, expect } from 'vitest'
import { normalizePhone, phoneVariants } from '@/lib/utils/phone'

describe('normalizePhone', () => {
  it('should return 10-digit number as-is', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })

  it('should strip 91 prefix from 12-digit number', () => {
    expect(normalizePhone('919876543210')).toBe('9876543210')
  })

  it('should strip non-digit characters', () => {
    expect(normalizePhone('+91-98765-43210')).toBe('9876543210')
  })

  it('should strip spaces', () => {
    expect(normalizePhone('91 98765 43210')).toBe('9876543210')
  })

  it('should strip parentheses and dashes', () => {
    expect(normalizePhone('(91) 9876-543210')).toBe('9876543210')
  })

  it('should return short number as-is (fallback)', () => {
    expect(normalizePhone('12345')).toBe('12345')
  })

  it('should return 11-digit number as-is (not 10 or 12 starting with 91)', () => {
    expect(normalizePhone('12345678901')).toBe('12345678901')
  })

  it('should handle empty string', () => {
    expect(normalizePhone('')).toBe('')
  })

  it('should handle number with only non-digit chars', () => {
    expect(normalizePhone('+++---')).toBe('')
  })

  it('should not strip 91 from 12-digit number not starting with 91', () => {
    expect(normalizePhone('129876543210')).toBe('129876543210')
  })

  it('should handle 10-digit with formatting', () => {
    expect(normalizePhone('987-654-3210')).toBe('9876543210')
  })
})

describe('phoneVariants', () => {
  it('should return [10-digit, 91+10-digit] for 10-digit input', () => {
    expect(phoneVariants('9876543210')).toEqual(['9876543210', '919876543210'])
  })

  it('should return [10-digit, 91+10-digit] for 12-digit 91-prefixed input', () => {
    expect(phoneVariants('919876543210')).toEqual(['9876543210', '919876543210'])
  })

  it('should return [10-digit, 91+10-digit] for formatted input', () => {
    expect(phoneVariants('+91 98765 43210')).toEqual(['9876543210', '919876543210'])
  })

  it('should return single-element array for non-10-digit result', () => {
    expect(phoneVariants('12345')).toEqual(['12345'])
  })

  it('should return single-element array for 11-digit number', () => {
    expect(phoneVariants('12345678901')).toEqual(['12345678901'])
  })

  it('should handle empty string', () => {
    expect(phoneVariants('')).toEqual([''])
  })
})
