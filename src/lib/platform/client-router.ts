/**
 * Client Router — resolves client from WhatsApp phone_number_id or subdomain
 *
 * For per-client Supabase (future):
 *   1. Look up wa_phone_routing → get client_id
 *   2. Look up agent_router → get client's Supabase URL + key
 *   3. Create Supabase client for that specific client
 *
 * Current (shared DB):
 *   All clients share one Supabase. Tenant isolation via tenant_id filters.
 *   This router resolves which tenant_id to use.
 */

import { createServerClient } from "@/lib/supabase/server"

interface ClientRoute {
  clientId: string
  tenantId: string
  hospitalName: string
  waAccessToken?: string
  waPhoneNumberId?: string
}

/**
 * Resolve client from WhatsApp phone_number_id
 * Used by WhatsApp webhook to route messages to correct tenant
 */
export async function resolveClientByPhoneNumberId(
  phoneNumberId: string
): Promise<ClientRoute | null> {
  const supabase = createServerClient()

  // First try wa_phone_routing table (new multi-tenant)
  const { data: routing } = await supabase
    .from("wa_phone_routing")
    .select("client_id, branch_id, wa_access_token")
    .eq("phone_number_id", phoneNumberId)
    .eq("status", "active")
    .single()

  if (routing) {
    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("tenant_id, hospital_name, client_id")
      .eq("tenant_id", routing.branch_id || "")
      .single()

    return {
      clientId: routing.client_id,
      tenantId: tenant?.tenant_id || routing.branch_id || "",
      hospitalName: tenant?.hospital_name || "",
      waAccessToken: routing.wa_access_token,
      waPhoneNumberId: phoneNumberId,
    }
  }

  // Fallback: check tenants table directly (legacy single-tenant)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("tenant_id, hospital_name, client_id, wa_token, whatsapp_phone_id")
    .eq("whatsapp_phone_id", phoneNumberId)
    .single()

  if (tenant) {
    return {
      clientId: tenant.client_id || "",
      tenantId: tenant.tenant_id,
      hospitalName: tenant.hospital_name,
      waAccessToken: tenant.wa_token || undefined,
      waPhoneNumberId: tenant.whatsapp_phone_id || undefined,
    }
  }

  return null
}

/**
 * Resolve client from subdomain (e.g., sunshine.ai-hos.in)
 */
export async function resolveClientBySubdomain(
  subdomain: string
): Promise<ClientRoute | null> {
  const supabase = createServerClient()

  const { data: config } = await supabase
    .from("client_configs")
    .select("client_id, tier")
    .eq("subdomain", subdomain)
    .single()

  if (!config) return null

  // Get the primary tenant for this client
  const { data: tenant } = await supabase
    .from("tenants")
    .select("tenant_id, hospital_name, wa_token, whatsapp_phone_id")
    .eq("client_id", config.client_id)
    .eq("status", "active")
    .limit(1)
    .single()

  return {
    clientId: config.client_id,
    tenantId: tenant?.tenant_id || "",
    hospitalName: tenant?.hospital_name || "",
    waAccessToken: tenant?.wa_token || undefined,
    waPhoneNumberId: tenant?.whatsapp_phone_id || undefined,
  }
}

/**
 * Get feature flags for a client
 */
export async function getClientFeatures(clientId: string) {
  const supabase = createServerClient()

  const { data: config } = await supabase
    .from("client_configs")
    .select("tier, features, limits")
    .eq("client_id", clientId)
    .single()

  if (!config) {
    // Default to basic tier
    const { TIER_FEATURES, TIER_LIMITS } = await import("./features")
    return {
      tier: "basic" as const,
      features: TIER_FEATURES.basic,
      limits: TIER_LIMITS.basic,
    }
  }

  return {
    tier: config.tier as "basic" | "medium" | "enterprise",
    features: config.features,
    limits: config.limits,
  }
}
