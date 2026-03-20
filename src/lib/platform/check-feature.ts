/**
 * Server-side feature check for API routes.
 * Returns null if feature is allowed, or an error Response if blocked.
 * Also checks subscription expiry — expired subscriptions are downgraded to basic.
 */

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { TIER_FEATURES, isFeatureEnabled } from "./features"
import type { Tier, TierFeatures } from "./features"

/** Grace period after subscription expires (in days) */
const GRACE_PERIOD_DAYS = 7

/**
 * Check if a feature is enabled for a given client.
 * Use in API routes to prevent unauthorized access to gated features.
 *
 * Also checks subscription_end date:
 * - If expired beyond grace period, treats as "basic" tier
 * - If within grace period, allows but logs warning
 *
 * @returns null if feature is enabled, NextResponse with 403 if not
 */
export async function requireFeature(
  clientId: string | undefined | null,
  feature: keyof TierFeatures
): Promise<NextResponse | null> {
  // No client context = allow (super admin, system calls)
  if (!clientId) return null

  const supabase = createServerClient()

  const { data: config } = await supabase
    .from("client_configs")
    .select("tier, features, subscription_end")
    .eq("client_id", clientId)
    .single()

  let tier: Tier = (config?.tier as Tier) || "basic"
  const features = config?.features || TIER_FEATURES[tier]

  // Check subscription expiry
  if (config?.subscription_end) {
    const endDate = new Date(config.subscription_end)
    const now = new Date()
    const daysPastExpiry = Math.ceil((now.getTime() - endDate.getTime()) / (24 * 60 * 60 * 1000))

    if (daysPastExpiry > GRACE_PERIOD_DAYS) {
      // Past grace period — downgrade to basic
      tier = "basic"
      const basicAllowed = isFeatureEnabled(TIER_FEATURES.basic, feature, "basic")
      if (!basicAllowed) {
        return NextResponse.json(
          {
            error: `Your subscription expired on ${endDate.toLocaleDateString("en-IN")}. This feature requires an active plan. Please renew to continue using it.`,
            code: "SUBSCRIPTION_EXPIRED",
          },
          { status: 403 }
        )
      }
      return null
    }
    // Within grace period — allow but the UI should show a warning
  }

  if (isFeatureEnabled(features, feature, tier)) {
    return null
  }

  return NextResponse.json(
    { error: `This feature requires a plan upgrade. Current plan: ${tier}` },
    { status: 403 }
  )
}

/**
 * Check subscription status for a client.
 * Used by UI to show expiry warnings.
 */
export async function getSubscriptionStatus(clientId: string): Promise<{
  tier: Tier
  isExpired: boolean
  isInGracePeriod: boolean
  daysRemaining: number | null
  subscriptionEnd: string | null
}> {
  const supabase = createServerClient()

  const { data: config } = await supabase
    .from("client_configs")
    .select("tier, subscription_end")
    .eq("client_id", clientId)
    .single()

  const tier: Tier = (config?.tier as Tier) || "basic"
  const subEnd = config?.subscription_end || null

  if (!subEnd) {
    return { tier, isExpired: false, isInGracePeriod: false, daysRemaining: null, subscriptionEnd: null }
  }

  const endDate = new Date(subEnd)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

  return {
    tier,
    isExpired: daysUntilExpiry < 0,
    isInGracePeriod: daysUntilExpiry < 0 && Math.abs(daysUntilExpiry) <= GRACE_PERIOD_DAYS,
    daysRemaining: daysUntilExpiry,
    subscriptionEnd: subEnd,
  }
}
