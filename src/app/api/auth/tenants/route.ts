import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId")
  const supabase = createServerClient()

  // If clientId provided, return branches for that client (used by login form)
  if (clientId) {
    const { data } = await supabase
      .from("tenants")
      .select("tenant_id, hospital_name, city, branch_code, status")
      .eq("client_id", clientId)
      .eq("status", "active")

    return NextResponse.json(data || [])
  }

  // List all active clients with branch counts (used by login page — public data)
  const { data: clientRows } = await supabase
    .from("clients")
    .select("client_id, name, slug, logo_url, status")
    .eq("status", "active")

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
}
