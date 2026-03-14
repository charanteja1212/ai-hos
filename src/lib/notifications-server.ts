/**
 * Server-side notification creation helper.
 * Used in API routes, webhook handlers, and background workers
 * where createBrowserClient() is not available.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ServerNotificationParams {
  tenantId: string
  type: string
  title: string
  message: string
  targetRole: string
  targetUserId?: string
  referenceId?: string
  referenceType?: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

/**
 * Insert a notification from server-side code (fire-and-forget).
 * Uses service_role key to bypass RLS.
 */
export async function createServerNotification(params: ServerNotificationParams): Promise<void> {
  try {
    await fetch(SUPABASE_URL + "/notifications", {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        type: params.type,
        title: params.title,
        message: params.message,
        target_role: params.targetRole,
        target_user_id: params.targetUserId || null,
        reference_id: params.referenceId || null,
        reference_type: params.referenceType || null,
        action_url: params.actionUrl || null,
        metadata: params.metadata || null,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    console.error("[notification-server] Insert failed:", e)
  }
}

/**
 * Create multiple notifications at once (e.g., notify multiple roles).
 */
export async function createServerNotifications(
  notifications: ServerNotificationParams[]
): Promise<void> {
  if (notifications.length === 0) return

  try {
    await fetch(SUPABASE_URL + "/notifications", {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(
        notifications.map((p) => ({
          tenant_id: p.tenantId,
          type: p.type,
          title: p.title,
          message: p.message,
          target_role: p.targetRole,
          target_user_id: p.targetUserId || null,
          reference_id: p.referenceId || null,
          reference_type: p.referenceType || null,
          action_url: p.actionUrl || null,
          metadata: p.metadata || null,
        }))
      ),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    console.error("[notification-server] Batch insert failed:", e)
  }
}
