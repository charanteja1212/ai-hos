"use client"

import { useFeatures } from "@/components/providers/features-context"
import { getTierInfo } from "@/lib/platform/features"
import type { TierFeatures } from "@/lib/platform/features"
import { Lock, ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FeatureGateProps {
  /** The feature key to check */
  feature: keyof TierFeatures
  /** Human-readable name for the feature */
  featureName: string
  /** Content to render when feature is enabled */
  children: React.ReactNode
}

/**
 * Wraps page content — shows upgrade prompt if feature is disabled for this client's tier.
 */
export function FeatureGate({ feature, featureName, children }: FeatureGateProps) {
  const { hasFeature, tier, loading } = useFeatures()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (hasFeature(feature)) {
    return <>{children}</>
  }

  const tierInfo = getTierInfo(tier)
  // Find the minimum tier that has this feature
  const requiredTier = feature === "ipd_module" || feature === "abdm_integration" || feature === "iot_gateway" || feature === "white_label"
    ? "enterprise"
    : "medium"
  const requiredTierInfo = getTierInfo(requiredTier)

  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          {featureName}
        </h2>
        <p className="text-muted-foreground mb-6">
          This module is available on the{" "}
          <span className="font-semibold text-foreground">{requiredTierInfo.name}</span>{" "}
          plan and above. You are currently on the{" "}
          <span className="font-semibold text-foreground">{tierInfo.name}</span> plan.
        </p>

        <div className="rounded-xl border border-border bg-muted/20 p-4 mb-6 text-left">
          <p className="text-sm font-medium text-foreground mb-1">
            {requiredTierInfo.name} Plan — Rs {requiredTierInfo.price}/month
          </p>
          <p className="text-xs text-muted-foreground">
            {requiredTierInfo.description}
          </p>
        </div>

        <Button variant="default" className="gap-2">
          <ArrowUpCircle className="w-4 h-4" />
          Contact Sales to Upgrade
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Contact your platform administrator to upgrade your plan.
        </p>
      </div>
    </div>
  )
}
