import { createServerClient } from "@/lib/supabase/server"
import type { SessionUser, UserRole } from "@/types/auth"

interface BuildSessionParams {
  role: string
  entityTable: string
  entityId: string
  tenantId?: string | null
  clientId?: string | null
  email?: string
}

/**
 * Shared helper to build a SessionUser from user_credentials data.
 * Used by both PIN login (options.ts) and password login.
 */
export async function buildSessionUser(
  params: BuildSessionParams
): Promise<(SessionUser & { id: string }) | null> {
  const supabase = createServerClient()
  const { role, entityTable, entityId, tenantId, clientId, email } = params

  // ====== SUPER_ADMIN ======
  if (entityTable === "platform_admins") {
    const { data: admin } = await supabase
      .from("platform_admins")
      .select("admin_id, name")
      .eq("admin_id", entityId)
      .eq("status", "active")
      .single()

    if (!admin) return null

    return {
      id: admin.admin_id,
      name: admin.name,
      role: "SUPER_ADMIN",
      tenantId: "",
      hospitalName: "AI-HOS Platform",
      clientId: "",
      clientName: "",
      email,
    }
  }

  // ====== CLIENT_ADMIN ======
  if (entityTable === "clients") {
    const { data: client } = await supabase
      .from("clients")
      .select("client_id, name")
      .eq("client_id", entityId)
      .eq("status", "active")
      .single()

    if (!client) return null

    // Get first branch as default
    const { data: firstBranch } = await supabase
      .from("tenants")
      .select("tenant_id, hospital_name")
      .eq("client_id", entityId)
      .limit(1)
      .single()

    return {
      id: `client-admin-${entityId}`,
      name: client.name + " Admin",
      role: "CLIENT_ADMIN",
      tenantId: firstBranch?.tenant_id || "",
      hospitalName: firstBranch?.hospital_name || client.name,
      clientId: client.client_id,
      clientName: client.name,
      email,
    }
  }

  // ====== DOCTOR ======
  if (entityTable === "doctors") {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("doctor_id, name, specialty, tenant_id")
      .eq("doctor_id", entityId)
      .single()

    if (!doctor) return null

    const resolvedTenantId = tenantId || doctor.tenant_id || ""

    // Fetch tenant + client info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("hospital_name, client_id")
      .eq("tenant_id", resolvedTenantId)
      .single()

    let resolvedClientName = ""
    const resolvedClientId = clientId || tenant?.client_id || ""
    if (resolvedClientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("client_id", resolvedClientId)
        .single()
      resolvedClientName = client?.name || ""
    }

    return {
      id: doctor.doctor_id,
      name: doctor.name,
      role: "DOCTOR",
      tenantId: resolvedTenantId,
      hospitalName: tenant?.hospital_name || "",
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      doctorId: doctor.doctor_id,
      specialty: doctor.specialty,
      email,
    }
  }

  // ====== STAFF (LAB_TECH, PHARMACIST, RECEPTION, BRANCH_ADMIN, ADMIN) ======
  if (entityTable === "staff") {
    const { data: staff } = await supabase
      .from("staff")
      .select("staff_id, name, role, tenant_id")
      .eq("staff_id", entityId)
      .eq("status", "active")
      .single()

    if (!staff) return null

    const resolvedTenantId = tenantId || staff.tenant_id || ""

    const { data: tenant } = await supabase
      .from("tenants")
      .select("hospital_name, client_id")
      .eq("tenant_id", resolvedTenantId)
      .single()

    let resolvedClientName = ""
    const resolvedClientId = clientId || tenant?.client_id || ""
    if (resolvedClientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("client_id", resolvedClientId)
        .single()
      resolvedClientName = client?.name || ""
    }

    return {
      id: staff.staff_id,
      name: staff.name,
      role: (role || staff.role) as UserRole,
      tenantId: resolvedTenantId,
      hospitalName: tenant?.hospital_name || "",
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      email,
    }
  }

  // ====== BRANCH ADMIN (from tenants table — admin login via password) ======
  if (entityTable === "tenants") {
    const resolvedTenantId = tenantId || entityId

    const { data: tenant } = await supabase
      .from("tenants")
      .select("tenant_id, hospital_name, client_id")
      .eq("tenant_id", resolvedTenantId)
      .single()

    if (!tenant) return null

    let resolvedClientName = ""
    const resolvedClientId = clientId || tenant.client_id || ""
    if (resolvedClientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("client_id", resolvedClientId)
        .single()
      resolvedClientName = client?.name || ""
    }

    const effectiveRole: UserRole =
      role === "ADMIN" ? "BRANCH_ADMIN" : (role as UserRole)

    return {
      id: `admin-${resolvedTenantId}`,
      name: tenant.hospital_name + " Admin",
      role: effectiveRole,
      tenantId: resolvedTenantId,
      hospitalName: tenant.hospital_name,
      clientId: resolvedClientId,
      clientName: resolvedClientName,
      email,
    }
  }

  return null
}
