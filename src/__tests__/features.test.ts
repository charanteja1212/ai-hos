import { describe, it, expect } from "vitest"
import {
  TIER_FEATURES,
  TIER_LIMITS,
  isFeatureEnabled,
  getEffectiveLimits,
  getTierInfo,
  type Tier,
  type TierFeatures,
} from "@/lib/platform/features"

describe("Tier System", () => {
  describe("TIER_FEATURES presets", () => {
    it("basic tier has whatsapp_bot enabled", () => {
      expect(TIER_FEATURES.basic.whatsapp_bot).toBe(true)
    })

    it("basic tier has all advanced features disabled", () => {
      expect(TIER_FEATURES.basic.lab_module).toBe(false)
      expect(TIER_FEATURES.basic.pharmacy_module).toBe(false)
      expect(TIER_FEATURES.basic.ipd_module).toBe(false)
      expect(TIER_FEATURES.basic.multi_branch).toBe(false)
      expect(TIER_FEATURES.basic.ai_agents).toBe(false)
    })

    it("medium tier enables lab + pharmacy but not IPD", () => {
      expect(TIER_FEATURES.medium.lab_module).toBe(true)
      expect(TIER_FEATURES.medium.pharmacy_module).toBe(true)
      expect(TIER_FEATURES.medium.ipd_module).toBe(false)
    })

    it("enterprise tier has all features enabled", () => {
      const features = TIER_FEATURES.enterprise
      for (const key of Object.keys(features) as (keyof TierFeatures)[]) {
        expect(features[key]).toBe(true)
      }
    })
  })

  describe("TIER_LIMITS presets", () => {
    it("basic tier has strict limits", () => {
      expect(TIER_LIMITS.basic.max_doctors).toBe(3)
      expect(TIER_LIMITS.basic.max_branches).toBe(1)
      expect(TIER_LIMITS.basic.max_staff).toBe(5)
    })

    it("medium tier has moderate limits", () => {
      expect(TIER_LIMITS.medium.max_doctors).toBe(15)
      expect(TIER_LIMITS.medium.max_branches).toBe(2)
    })

    it("enterprise tier has effectively unlimited limits", () => {
      expect(TIER_LIMITS.enterprise.max_doctors).toBe(999)
      expect(TIER_LIMITS.enterprise.max_branches).toBe(999)
    })

    it("tiers are progressively more generous", () => {
      expect(TIER_LIMITS.medium.max_doctors).toBeGreaterThan(TIER_LIMITS.basic.max_doctors)
      expect(TIER_LIMITS.enterprise.max_doctors).toBeGreaterThan(TIER_LIMITS.medium.max_doctors)
    })
  })

  describe("isFeatureEnabled", () => {
    it("returns feature value when present in override", () => {
      expect(isFeatureEnabled({ lab_module: true }, "lab_module", "basic")).toBe(true)
      expect(isFeatureEnabled({ lab_module: false }, "lab_module", "enterprise")).toBe(false)
    })

    it("falls back to tier preset when feature not in override", () => {
      expect(isFeatureEnabled({}, "whatsapp_bot", "basic")).toBe(true)
      expect(isFeatureEnabled({}, "lab_module", "basic")).toBe(false)
      expect(isFeatureEnabled({}, "lab_module", "medium")).toBe(true)
    })

    it("falls back to basic tier when no override provided", () => {
      expect(isFeatureEnabled(null, "whatsapp_bot")).toBe(true)
      expect(isFeatureEnabled(null, "lab_module")).toBe(false)
    })
  })

  describe("getEffectiveLimits", () => {
    it("returns tier defaults when no overrides", () => {
      const limits = getEffectiveLimits(null, "basic")
      expect(limits).toEqual(TIER_LIMITS.basic)
    })

    it("merges partial overrides with tier defaults", () => {
      const limits = getEffectiveLimits({ max_doctors: 10 }, "basic")
      expect(limits.max_doctors).toBe(10)
      expect(limits.max_branches).toBe(TIER_LIMITS.basic.max_branches)
    })

    it("defaults to basic tier when no fallback specified", () => {
      const limits = getEffectiveLimits(null)
      expect(limits).toEqual(TIER_LIMITS.basic)
    })
  })

  describe("getTierInfo", () => {
    it("returns correct display info for each tier", () => {
      const tiers: Tier[] = ["basic", "medium", "enterprise"]
      for (const tier of tiers) {
        const info = getTierInfo(tier)
        expect(info).toHaveProperty("name")
        expect(info).toHaveProperty("price")
        expect(info).toHaveProperty("description")
        expect(info).toHaveProperty("color")
      }
    })

    it("basic tier is labeled as Solo Doctor / Small Clinic", () => {
      const info = getTierInfo("basic")
      expect(info.name).toBe("Basic")
      expect(info.description).toContain("Solo Doctor")
    })

    it("enterprise has purple color", () => {
      expect(getTierInfo("enterprise").color).toBe("purple")
    })
  })
})
