/**
 * Server-side feature check for API routes.
 * Returns null if feature is allowed, or an error Response if blocked.
 */

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { TIER_FEATURES, isFeatureEnabled } from "./features"
import type { Tier, TierFeatures } from "./features"

/**
 * Check if a feature is enabled for a given client.
 * Use in API routes to prevent unauthorized access to gated features.
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
    .select("tier, features")
    .eq("client_id", clientId)
    .single()

  const tier: Tier = (config?.tier as Tier) || "basic"
  const features = config?.features || TIER_FEATURES[tier]

  if (isFeatureEnabled(features, feature, tier)) {
    return null
  }

  return NextResponse.json(
    { error: `This feature requires a plan upgrade. Current plan: ${tier}` },
    { status: 403 }
  )
}
