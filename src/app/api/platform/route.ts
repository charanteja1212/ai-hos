import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { apiGuard, isGuardError } from "@/lib/auth/api-guard"
import { logAudit } from "@/lib/audit"

// GET /api/platform — fetch platform data (requires SUPER_ADMIN)
export async function GET(req: Request) {
  const guard = await apiGuard({ allowedRoles: ["SUPER_ADMIN"] })
  if (isGuardError(guard)) return guard

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get("scope") || "dashboard"
  const supabase = createServerClient()

  if (scope === "dashboard") {
    const [clientsRes, branchesRes, doctorsRes, patientsRes] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("tenants").select("tenant_id, client_id, hospital_name, city, status, whatsapp_phone_id"),
      supabase.from("doctors").select("doctor_id", { count: "exact", head: true }),
      supabase.from("patients").select("phone", { count: "exact", head: true }),
    ])

    return NextResponse.json({
      clients: clientsRes.data || [],
      branches: branchesRes.data || [],
      doctorCount: doctorsRes.count || 0,
      patientCount: patientsRes.count || 0,
    })
  }

  if (scope === "clients") {
    const [clientsRes, branchesRes] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("tenants").select("tenant_id, client_id, hospital_name, city, status, whatsapp_phone_id"),
    ])

    return NextResponse.json({
      clients: clientsRes.data || [],
      branches: branchesRes.data || [],
    })
  }

  if (scope === "client") {
    const clientId = searchParams.get("clientId")
    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 })
    }

    const [clientRes, branchesRes] = await Promise.all([
      supabase.from("clients").select("*").eq("client_id", clientId).single(),
      supabase.from("tenants").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    ])

    return NextResponse.json({
      client: clientRes.data || null,
      branches: branchesRes.data || [],
    })
  }

  if (scope === "health-ping") {
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  }

  if (scope === "n8n-health") {
    const n8nUrl = process.env.N8N_API_URL || "https://ainewworld.in"
    const n8nKey = process.env.N8N_API_KEY || ""
    try {
      const res = await fetch(`${n8nUrl}/api/v1/workflows?limit=1&active=true`, {
        headers: { "X-N8N-API-KEY": n8nKey },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        // Count active workflows
        const countRes = await fetch(`${n8nUrl}/api/v1/workflows?active=true&limit=200`, {
          headers: { "X-N8N-API-KEY": n8nKey },
          signal: AbortSignal.timeout(8000),
        })
        const countData = countRes.ok ? await countRes.json() : null
        return NextResponse.json({
          healthy: true,
          activeWorkflows: countData?.data?.length || "?",
        })
      }
      return NextResponse.json({ healthy: false, error: `HTTP ${res.status}` })
    } catch (e) {
      return NextResponse.json({ healthy: false, error: e instanceof Error ? e.message : "Unreachable" })
    }
  }

  if (scope === "whatsapp-routing") {
    const [routesRes, branchesRes, clientsRes] = await Promise.all([
      supabase.from("wa_phone_routing").select("*").order("created_at", { ascending: false }),
      supabase.from("tenants").select("tenant_id, hospital_name, client_id, wa_token").eq("status", "active"),
      supabase.from("clients").select("client_id, name").eq("status", "active"),
    ])
    return NextResponse.json({
      routes: routesRes.data || [],
      branches: branchesRes.data || [],
      clients: clientsRes.data || [],
    })
  }

  return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
}

// POST /api/platform — create/update client or branch (requires SUPER_ADMIN)
export async function POST(req: Request) {
  const guard = await apiGuard({ allowedRoles: ["SUPER_ADMIN"] })
  if (isGuardError(guard)) return guard

  const body = await req.json()
  const { action, ...payload } = body
  const supabase = createServerClient()

  if (action === "createClient") {
    // Extract tier info before inserting (tier is stored in client_configs, not clients)
    const tier = payload.tier || "basic"
    delete payload.tier
    delete payload.features
    delete payload.limits

    const { error } = await supabase.from("clients").insert(payload)
    if (error) {
      console.error("[platform] createClient error:", error.message)
      return NextResponse.json({ error: "Failed to create client. Check for duplicate values." }, { status: 400 })
    }

    // Auto-create client_configs with tier/features/limits
    const { TIER_FEATURES, TIER_LIMITS } = await import("@/lib/platform/features")
    const validTier = (["basic", "medium", "enterprise"].includes(tier) ? tier : "basic") as "basic" | "medium" | "enterprise"
    await supabase.from("client_configs").upsert({
      client_id: payload.client_id,
      tier: validTier,
      features: TIER_FEATURES[validTier],
      limits: TIER_LIMITS[validTier],
    }, { onConflict: "client_id" })

    logAudit({ action: "create", entityType: "client", entityId: payload.client_id || payload.slug || "unknown", actorEmail: guard.user.email || "system", actorRole: guard.user.role || "SUPER_ADMIN", details: { name: payload.name, tier: validTier } })
    return NextResponse.json({ success: true })
  }

  if (action === "createBranch") {
    // Auto-compute wa_api_url if whatsapp_phone_id provided
    if (payload.whatsapp_phone_id && !payload.wa_api_url) {
      payload.wa_api_url = `https://graph.facebook.com/v21.0/${payload.whatsapp_phone_id}/messages`
    }
    const { error } = await supabase.from("tenants").insert(payload)
    if (error) {
      console.error("[platform] createBranch error:", error.message)
      return NextResponse.json({ error: "Failed to create branch. Check for duplicate values." }, { status: 400 })
    }
    logAudit({ action: "create", entityType: "tenant", entityId: payload.tenant_id || "unknown", actorEmail: guard.user.email || "system", actorRole: guard.user.role || "SUPER_ADMIN", tenantId: payload.tenant_id, details: { hospital_name: payload.hospital_name } })
    return NextResponse.json({ success: true })
  }

  if (action === "updateBranch") {
    const { tenant_id, ...updates } = payload
    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }
    // Auto-compute wa_api_url if whatsapp_phone_id provided
    if (updates.whatsapp_phone_id && !updates.wa_api_url) {
      updates.wa_api_url = `https://graph.facebook.com/v21.0/${updates.whatsapp_phone_id}/messages`
    }
    const { error } = await supabase
      .from("tenants")
      .update(updates)
      .eq("tenant_id", tenant_id)
    if (error) {
      console.error("[platform] updateBranch error:", error.message)
      return NextResponse.json({ error: "Failed to update branch." }, { status: 400 })
    }
    logAudit({ action: "update", entityType: "tenant", entityId: tenant_id, actorEmail: guard.user.email || "system", actorRole: guard.user.role || "SUPER_ADMIN", tenantId: tenant_id, details: updates })
    return NextResponse.json({ success: true })
  }

  if (action === "saveWhatsAppRoute") {
    const { phone_number_id, client_id, branch_id, wa_access_token, wa_display_name, edit } = payload
    if (!phone_number_id || !client_id || !wa_access_token) {
      return NextResponse.json({ error: "phone_number_id, client_id, and wa_access_token are required" }, { status: 400 })
    }

    const routePayload = {
      phone_number_id,
      client_id,
      branch_id: branch_id || null,
      wa_access_token,
      wa_display_name: wa_display_name || null,
      status: "active",
    }

    // 1. Save route (insert or update)
    if (edit) {
      const { error } = await supabase
        .from("wa_phone_routing")
        .update(routePayload)
        .eq("phone_number_id", phone_number_id)
      if (error) {
        return NextResponse.json({ error: "Failed to update route: " + error.message }, { status: 400 })
      }
    } else {
      const { error } = await supabase.from("wa_phone_routing").upsert(routePayload, { onConflict: "phone_number_id" })
      if (error) {
        return NextResponse.json({ error: "Failed to create route: " + error.message }, { status: 400 })
      }
    }

    // 2. Auto-update tenant WhatsApp config
    if (branch_id) {
      const waApiUrl = `https://graph.facebook.com/v21.0/${phone_number_id}/messages`
      const { error: tenantErr } = await supabase
        .from("tenants")
        .update({
          whatsapp_phone_id: phone_number_id,
          wa_token: wa_access_token,
          wa_api_url: waApiUrl,
        })
        .eq("tenant_id", branch_id)
      if (tenantErr) {
        console.error("[platform] saveWhatsAppRoute tenant update error:", tenantErr.message)
        return NextResponse.json({ error: "Route saved but tenant update failed: " + tenantErr.message }, { status: 400 })
      }
    }

    logAudit({ action: edit ? "update" : "create", entityType: "wa_route", entityId: phone_number_id, actorEmail: guard.user.email || "system", actorRole: guard.user.role || "SUPER_ADMIN", tenantId: branch_id || undefined, details: { client_id, branch_id, wa_display_name } })
    return NextResponse.json({ success: true })
  }

  if (action === "deleteWhatsAppRoute") {
    const { phone_number_id } = payload
    if (!phone_number_id) {
      return NextResponse.json({ error: "phone_number_id required" }, { status: 400 })
    }
    const { error } = await supabase.from("wa_phone_routing").delete().eq("phone_number_id", phone_number_id)
    if (error) {
      return NextResponse.json({ error: "Failed to delete: " + error.message }, { status: 400 })
    }
    logAudit({ action: "delete", entityType: "wa_route", entityId: phone_number_id, actorEmail: guard.user.email || "system", actorRole: guard.user.role || "SUPER_ADMIN" })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
