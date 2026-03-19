import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createRouteLogger } from "@/lib/logger"
import { isRateLimited } from "@/lib/rate-limit"

const log = createRouteLogger("auth/tenants")

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 30 requests per 5 minutes per IP (public endpoint)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (await isRateLimited(`tenants:${ip}`, 30, 300000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get("clientId")
    const supabase = createServerClient()

    // If clientId provided, return branches for that client (used by login form)
    if (clientId) {
      const { data, error } = await supabase
        .from("tenants")
        .select("tenant_id, hospital_name, city, branch_code, status")
        .eq("client_id", clientId)
        .eq("status", "active")

      if (error) {
        log.error({ err: error, clientId }, "Failed to fetch branches")
        return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 })
      }

      return NextResponse.json(data || [])
    }

    // List all active clients with branch counts (used by login page — public data)
    const { data: clientRows, error: clientError } = await supabase
      .from("clients")
      .select("client_id, name, slug, logo_url, status")
      .eq("status", "active")

    if (clientError) {
      log.error({ err: clientError }, "Failed to fetch clients")
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
    }

    if (!clientRows || clientRows.length === 0) {
      return NextResponse.json([])
    }

    const { data: branchRows } = await supabase
      .from("tenants")
      .select("client_id, tenant_id")
      .eq("status", "active")

    const countMap: Record<string, number> = {}
    if (branchRows) {
      for (const b of branchRows) {
        countMap[b.client_id] = (countMap[b.client_id] || 0) + 1
      }
    }

    const result = clientRows.map((c) => ({
      ...c,
      branch_count: countMap[c.client_id] || 0,
    }))

    return NextResponse.json(result)
  } catch (err) {
    log.error({ err }, "Tenants API error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
