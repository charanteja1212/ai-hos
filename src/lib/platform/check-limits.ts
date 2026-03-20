/**
 * Server-side tier limit enforcement.
 * Checks if adding a new doctor/staff/branch would exceed the plan limits.
 */

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { TIER_LIMITS, getEffectiveLimits } from "./features"
import type { Tier } from "./features"

interface LimitCheckResult {
  allowed: boolean
  current: number
  max: number
  tier: Tier
}

/**
 * Check if a client can add more doctors.
 * Returns null if allowed, or a 403 NextResponse if limit reached.
 */
export async function checkDoctorLimit(
  clientId: string | undefined | null
): Promise<NextResponse | null> {
  if (!clientId) return null

  const result = await checkLimit(clientId, "doctors", "max_doctors")
  if (result.allowed) return null

  return NextResponse.json(
    {
      error: `Doctor limit reached. Your ${result.tier} plan allows ${result.max} doctors (currently ${result.current}). Please upgrade to add more.`,
      code: "LIMIT_REACHED",
      current: result.current,
      max: result.max,
      tier: result.tier,
    },
    { status: 403 }
  )
}

/**
 * Check if a client can add more staff members.
 */
export async function checkStaffLimit(
  clientId: string | undefined | null
): Promise<NextResponse | null> {
  if (!clientId) return null

  const result = await checkLimit(clientId, "staff", "max_staff")
  if (result.allowed) return null

  return NextResponse.json(
    {
      error: `Staff limit reached. Your ${result.tier} plan allows ${result.max} staff (currently ${result.current}). Please upgrade to add more.`,
      code: "LIMIT_REACHED",
      current: result.current,
      max: result.max,
      tier: result.tier,
    },
    { status: 403 }
  )
}

/**
 * Check if a client can add more branches.
 */
export async function checkBranchLimit(
  clientId: string | undefined | null
): Promise<NextResponse | null> {
  if (!clientId) return null

  const result = await checkLimit(clientId, "tenants", "max_branches")
  if (result.allowed) return null

  return NextResponse.json(
    {
      error: `Branch limit reached. Your ${result.tier} plan allows ${result.max} branches (currently ${result.current}). Please upgrade to add more.`,
      code: "LIMIT_REACHED",
      current: result.current,
      max: result.max,
      tier: result.tier,
    },
    { status: 403 }
  )
}

/**
 * Generic limit checker — counts rows and compares against tier limit.
 */
async function checkLimit(
  clientId: string,
  table: string,
  limitField: keyof typeof TIER_LIMITS.basic
): Promise<LimitCheckResult> {
  const supabase = createServerClient()

  const [configRes, countRes] = await Promise.all([
    supabase
      .from("client_configs")
      .select("tier, limits")
      .eq("client_id", clientId)
      .single(),
    supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("status", "inactive"),
  ])

  const tier: Tier = (configRes.data?.tier as Tier) || "basic"
  const limits = getEffectiveLimits(configRes.data?.limits, tier)
  const current = countRes.count || 0
  const max = limits[limitField]

  return {
    allowed: current < max,
    current,
    max,
    tier,
  }
}

/**
 * Client-friendly limit check — returns usage info without blocking.
 * Use in UI to show warnings when approaching limits.
 */
export async function getUsageSummary(clientId: string) {
  const supabase = createServerClient()

  const [configRes, doctorCount, staffCount, branchCount] = await Promise.all([
    supabase.from("client_configs").select("tier, limits").eq("client_id", clientId).single(),
    supabase.from("doctors").select("*", { count: "exact", head: true }).eq("client_id", clientId).neq("status", "inactive"),
    supabase.from("staff").select("*", { count: "exact", head: true }).eq("client_id", clientId).neq("status", "inactive"),
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("client_id", clientId).neq("status", "inactive"),
  ])

  const tier: Tier = (configRes.data?.tier as Tier) || "basic"
  const limits = getEffectiveLimits(configRes.data?.limits, tier)

  return {
    tier,
    doctors: { current: doctorCount.count || 0, max: limits.max_doctors, pct: Math.round(((doctorCount.count || 0) / limits.max_doctors) * 100) },
    staff: { current: staffCount.count || 0, max: limits.max_staff, pct: Math.round(((staffCount.count || 0) / limits.max_staff) * 100) },
    branches: { current: branchCount.count || 0, max: limits.max_branches, pct: Math.round(((branchCount.count || 0) / limits.max_branches) * 100) },
  }
}
