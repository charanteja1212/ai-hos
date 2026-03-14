import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { subscription, userId, tenantId } = await req.json()

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
    }

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
    console.error("[push/subscribe] Error:", err)
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 })
  }
}
