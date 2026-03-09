"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { SessionUser } from "@/types/auth"
import type { Tier, TierFeatures, TierLimits } from "@/lib/platform/features"
import { TIER_FEATURES, TIER_LIMITS, isFeatureEnabled, getEffectiveLimits } from "@/lib/platform/features"

interface FeaturesContextValue {
  tier: Tier
  features: Partial<TierFeatures>
  limits: TierLimits
  loading: boolean
  /** Check if a specific feature is enabled */
  hasFeature: (feature: keyof TierFeatures) => boolean
}

const FeaturesContext = createContext<FeaturesContextValue | null>(null)

export function FeaturesProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [tier, setTier] = useState<Tier>("basic")
  const [features, setFeatures] = useState<Partial<TierFeatures>>(TIER_FEATURES.basic)
  const [limits, setLimits] = useState<TierLimits>(TIER_LIMITS.basic)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // SUPER_ADMIN always gets enterprise
    if (user.role === "SUPER_ADMIN") {
      setTier("enterprise")
      setFeatures(TIER_FEATURES.enterprise)
      setLimits(TIER_LIMITS.enterprise)
      setLoading(false)
      return
    }

    // PATIENT doesn't need feature gating (they see what their hospital exposes)
    if (user.role === "PATIENT") {
      setTier("enterprise")
      setFeatures(TIER_FEATURES.enterprise)
      setLimits(TIER_LIMITS.enterprise)
      setLoading(false)
      return
    }

    const clientId = user.clientId
    if (!clientId) {
      setLoading(false)
      return
    }

    const supabase = createBrowserClient()
    supabase
      .from("client_configs")
      .select("tier, features, limits")
      .eq("client_id", clientId)
      .single()
      .then(({ data }) => {
        if (data) {
          const t = (data.tier as Tier) || "basic"
          setTier(t)
          setFeatures(data.features || TIER_FEATURES[t])
          setLimits(getEffectiveLimits(data.limits, t))
        }
        setLoading(false)
      })
  }, [user.clientId, user.role])

  const hasFeature = (feature: keyof TierFeatures): boolean => {
    return isFeatureEnabled(features, feature, tier)
  }

  return (
    <FeaturesContext.Provider value={{ tier, features, limits, loading, hasFeature }}>
      {children}
    </FeaturesContext.Provider>
  )
}

export function useFeatures(): FeaturesContextValue {
  const ctx = useContext(FeaturesContext)
  if (!ctx) {
    // Fallback for pages not wrapped (public pages)
    return {
      tier: "basic",
      features: TIER_FEATURES.basic,
      limits: TIER_LIMITS.basic,
      loading: false,
      hasFeature: (f) => TIER_FEATURES.basic[f],
    }
  }
  return ctx
}
