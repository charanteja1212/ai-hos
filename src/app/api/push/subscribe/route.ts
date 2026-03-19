import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { createRouteLogger } from "@/lib/logger"
import { pushSubscribeBodySchema } from "@/lib/validations/api-schemas"

const log = createRouteLogger("/api/push/subscribe")

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const validation = pushSubscribeBodySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid subscription", details: validation.error.issues },
        { status: 400 }
      )
    }
    const { subscription } = validation.data

    // Use session values instead of request body
    const sessionUser = session.user as { id?: string; email?: string; tenantId?: string }
    const userId = sessionUser.id || sessionUser.email || "unknown"
    const tenantId = sessionUser.tenantId || ""

    const supabase = createServerClient()

    // Upsert push subscription (replace if endpoint exists)
    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        created_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    log.error({ err }, "Push subscribe error")
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 })
  }
}
