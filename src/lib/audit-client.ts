import { createBrowserClient } from "@/lib/supabase/client"

/**
 * Client-side audit logger — use in client components for admin CRUD operations.
 * Fire-and-forget — never throws.
 */
export async function logAuditClient(entry: {
  action: "create" | "update" | "delete" | "status_change"
  entityType: string
  entityId: string
  actorEmail: string
  actorRole: string
  tenantId?: string | null
  details?: Record<string, unknown>
}) {
  try {
    const supabase = createBrowserClient()
    await supabase.from("audit_logs").insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      actor_email: entry.actorEmail,
      actor_role: entry.actorRole,
      tenant_id: entry.tenantId || null,
      details: entry.details || null,
    })
  } catch {
    // Never break the main flow
  }
}
