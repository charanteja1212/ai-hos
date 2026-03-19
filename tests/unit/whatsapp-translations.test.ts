import { describe, it, expect } from 'vitest'
import { msg, t, MSGS, T } from '@/lib/whatsapp/translations'

describe('msg (translated messages)', () => {
  it('should return English message by default', () => {
    const result = msg('welcome', null, { hospital: 'City Hospital', bot: 'HealthBot' })
    expect(result).toContain('City Hospital')
    expect(result).toContain('HealthBot')
  })

  it('should return Hindi message', () => {
    const result = msg('welcome', 'hi', { hospital: 'City Hospital' })
    expect(result).toContain('City Hospital')
    expect(result).toContain('स्वागत')
  })

  it('should return Telugu message', () => {
    const result = msg('welcome', 'te', { hospital: 'City Hospital' })
    expect(result).toContain('City Hospital')
    expect(result).toContain('స్వాగతం')
  })

  it('should substitute multiple variables', () => {
    const result = msg('menu_greeting_known', 'en', { hospital: 'Test Hospital', name: 'John' })
    expect(result).toContain('Test Hospital')
    expect(result).toContain('John')
  })

  it('should return key for unknown message key', () => {
    expect(msg('nonexistent_key', 'en')).toBe('nonexistent_key')
  })

  it('should fall back to English for missing translation', () => {
    // All keys have 'en' — test behavior for null language
    const result = msg('welcome', null)
    expect(result).toContain('Welcome')
  })

  it('should handle missing variable gracefully (empty string)', () => {
    const result = msg('welcome', 'en', { hospital: 'Test' })
    // {bot} variable not provided — should become empty string
    expect(result).toContain('Test')
    expect(result).not.toContain('{hospital}')
  })

  it('should handle no vars parameter', () => {
    const result = msg('menu_greeting', 'en')
    // {hospital} not substituted — stays as literal
    expect(result).toContain('{hospital}')
  })
})

describe('t (UI labels)', () => {
  it('should return English label', () => {
    expect(t('select_option', 'en')).toContain('Please select')
  })

  it('should return Hindi label', () => {
    expect(t('select_option', 'hi')).toContain('कृपया')
  })

  it('should return Telugu label', () => {
    expect(t('select_option', 'te')).toContain('దయచేసి')
  })

  it('should return key for unknown key', () => {
    expect(t('nonexistent', 'en')).toBe('nonexistent')
  })

  it('should fall back to English for null language', () => {
    expect(t('select_option', null)).toContain('Please select')
  })
})

describe('MSGS constant', () => {
  it('should have all three languages for each message', () => {
    for (const [key, entry] of Object.entries(MSGS)) {
      expect(entry.en, `${key} missing 'en'`).toBeDefined()
      expect(entry.hi, `${key} missing 'hi'`).toBeDefined()
      expect(entry.te, `${key} missing 'te'`).toBeDefined()
    }
  })

  it('should have key message types defined', () => {
    expect(MSGS.welcome).toBeDefined()
    expect(MSGS.menu_greeting).toBeDefined()
    expect(MSGS.live_agent_connected).toBeDefined()
    expect(MSGS.live_agent_ended).toBeDefined()
  })
})

describe('T constant', () => {
  it('should have all three languages for each label', () => {
    for (const [key, entry] of Object.entries(T)) {
      expect(entry.en, `${key} missing 'en'`).toBeDefined()
      expect(entry.hi, `${key} missing 'hi'`).toBeDefined()
      expect(entry.te, `${key} missing 'te'`).toBeDefined()
    }
  })
})
