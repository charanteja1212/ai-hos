import { describe, it, expect } from 'vitest'
import {
  isFeatureEnabled,
  getEffectiveLimits,
  getTierInfo,
  TIER_FEATURES,
  TIER_LIMITS,
  type TierFeatures,
  type TierLimits,
} from '@/lib/platform/features'

describe('isFeatureEnabled', () => {
  it('should return value from features object when present', () => {
    const features: Partial<TierFeatures> = { lab_module: true }
    expect(isFeatureEnabled(features, 'lab_module')).toBe(true)
  })

  it('should return false from features when explicitly disabled', () => {
    const features: Partial<TierFeatures> = { lab_module: false }
    expect(isFeatureEnabled(features, 'lab_module')).toBe(false)
  })

  it('should fall back to basic tier when features is null', () => {
    // basic tier: whatsapp_bot = true, lab_module = false
    expect(isFeatureEnabled(null, 'whatsapp_bot')).toBe(true)
    expect(isFeatureEnabled(null, 'lab_module')).toBe(false)
  })

  it('should fall back to specified tier when feature not in object', () => {
    const features: Partial<TierFeatures> = { whatsapp_bot: true }
    // lab_module not in features, fall back to medium tier (lab_module = true)
    expect(isFeatureEnabled(features, 'lab_module', 'medium')).toBe(true)
  })

  it('should fall back to enterprise tier when specified', () => {
    expect(isFeatureEnabled(null, 'ipd_module', 'enterprise')).toBe(true)
    expect(isFeatureEnabled(null, 'ipd_module', 'basic')).toBe(false)
  })

  it('should handle empty features object', () => {
    // All features fall back to basic tier
    expect(isFeatureEnabled({}, 'whatsapp_bot')).toBe(true) // basic has whatsapp
    expect(isFeatureEnabled({}, 'abdm_integration')).toBe(false) // basic doesn't
  })
})

describe('getEffectiveLimits', () => {
  it('should return basic tier limits when limits is null', () => {
    const result = getEffectiveLimits(null)
    expect(result).toEqual(TIER_LIMITS.basic)
    expect(result.max_doctors).toBe(3)
    expect(result.max_branches).toBe(1)
  })

  it('should override specific limits while keeping defaults', () => {
    const result = getEffectiveLimits({ max_doctors: 10 })
    expect(result.max_doctors).toBe(10) // overridden
    expect(result.max_branches).toBe(1) // default basic
    expect(result.max_staff).toBe(5)    // default basic
  })

  it('should use specified fallback tier', () => {
    const result = getEffectiveLimits(null, 'medium')
    expect(result).toEqual(TIER_LIMITS.medium)
    expect(result.max_doctors).toBe(15)
    expect(result.max_branches).toBe(2)
  })

  it('should handle enterprise tier', () => {
    const result = getEffectiveLimits(null, 'enterprise')
    expect(result.max_doctors).toBe(999)
    expect(result.max_branches).toBe(999)
    expect(result.max_patients).toBe(999999)
  })

  it('should override with zero values (not treated as null)', () => {
    const result = getEffectiveLimits({ max_doctors: 0 }, 'enterprise')
    expect(result.max_doctors).toBe(0) // explicitly set to 0, not falling back
  })

  it('should handle partial override with enterprise fallback', () => {
    const result = getEffectiveLimits(
      { max_doctors: 50, max_appointments_per_day: 500 },
      'enterprise'
    )
    expect(result.max_doctors).toBe(50)
    expect(result.max_appointments_per_day).toBe(500)
    expect(result.max_branches).toBe(999) // enterprise default
  })
})

describe('getTierInfo', () => {
  it('should return basic tier info', () => {
    const info = getTierInfo('basic')
    expect(info.name).toBe('Basic')
    expect(info.color).toBe('green')
    expect(info.description).toContain('Solo Doctor')
  })

  it('should return medium tier info', () => {
    const info = getTierInfo('medium')
    expect(info.name).toBe('Medium')
    expect(info.color).toBe('blue')
    expect(info.description).toContain('Multi-Doctor')
  })

  it('should return enterprise tier info', () => {
    const info = getTierInfo('enterprise')
    expect(info.name).toBe('Enterprise')
    expect(info.color).toBe('purple')
    expect(info.description).toContain('Multi-Branch')
  })

  it('should include price range for each tier', () => {
    expect(getTierInfo('basic').price).toBeDefined()
    expect(getTierInfo('medium').price).toBeDefined()
    expect(getTierInfo('enterprise').price).toBeDefined()
  })
})

describe('Tier presets consistency', () => {
  it('should have all features enabled for enterprise', () => {
    const enterprise = TIER_FEATURES.enterprise
    for (const [key, value] of Object.entries(enterprise)) {
      expect(value, `enterprise.${key} should be true`).toBe(true)
    }
  })

  it('should have basic as most restrictive tier', () => {
    const basic = TIER_FEATURES.basic
    const enabledCount = Object.values(basic).filter(v => v).length
    const medium = TIER_FEATURES.medium
    const mediumEnabled = Object.values(medium).filter(v => v).length
    expect(enabledCount).toBeLessThan(mediumEnabled)
  })

  it('should have ascending limits from basic to enterprise', () => {
    expect(TIER_LIMITS.basic.max_doctors).toBeLessThan(TIER_LIMITS.medium.max_doctors)
    expect(TIER_LIMITS.medium.max_doctors).toBeLessThan(TIER_LIMITS.enterprise.max_doctors)
    expect(TIER_LIMITS.basic.max_patients).toBeLessThan(TIER_LIMITS.medium.max_patients)
    expect(TIER_LIMITS.medium.max_patients).toBeLessThan(TIER_LIMITS.enterprise.max_patients)
  })

  it('should have same keys across all tiers', () => {
    const basicKeys = Object.keys(TIER_FEATURES.basic).sort()
    const mediumKeys = Object.keys(TIER_FEATURES.medium).sort()
    const enterpriseKeys = Object.keys(TIER_FEATURES.enterprise).sort()
    expect(basicKeys).toEqual(mediumKeys)
    expect(mediumKeys).toEqual(enterpriseKeys)
  })
})
