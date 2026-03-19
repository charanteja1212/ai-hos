import { createServerClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger.child({ module: "audit" })

interface AuditLogEntry {
  action: "create" | "update" | "delete" | "login" | "status_change"
  entityType: string
  entityId: string
  actorEmail: string
  actorRole: string
  tenantId?: string | null
  details?: Record<string, unknown>
}

/**
 * Log an audit event. Fire-and-forget — never throws.
 */
export async function logAudit(entry: AuditLogEntry) {
  try {
    const supabase = createServerClient()
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
    // Never let audit logging break the main flow
    log.error({ action: entry.action, entityType: entry.entityType, entityId: entry.entityId }, "Failed to log audit event")
  }
}
