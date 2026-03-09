import { createBrowserClient } from "@/lib/supabase/client"

interface CreateNotificationParams {
  tenantId: string
  type: string
  title: string
  message: string
  targetRole: string
  targetUserId?: string
  referenceId?: string
  referenceType?: string
}

export function createNotification(params: CreateNotificationParams) {
  const supabase = createBrowserClient()
  supabase.from("notifications").insert({
    tenant_id: params.tenantId,
    type: params.type,
    title: params.title,
    message: params.message,
    target_role: params.targetRole,
    target_user_id: params.targetUserId || null,
    reference_id: params.referenceId || null,
    reference_type: params.referenceType || null,
  }).then(({ error }) => {
    if (error) console.error("[notification] Insert failed:", error)
  })
}
