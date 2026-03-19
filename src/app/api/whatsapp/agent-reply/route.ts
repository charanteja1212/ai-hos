import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { sendText, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createServerClient } from "@/lib/supabase/server"
import { agentReplyBodySchema } from "@/lib/validations/api-schemas"
import { createRouteLogger } from "@/lib/logger"
import { isRateLimited } from "@/lib/rate-limit"

const log = createRouteLogger("whatsapp/agent-reply")

/**
 * POST /api/whatsapp/agent-reply
 * Reception staff sends a reply to a patient in live chat mode.
 * Also supports closing the chat.
 */
export async function POST(req: NextRequest) {
 try {
  const session = await auth()
  const user = session?.user as SessionUser | undefined
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role check: only staff roles can reply
  const allowedRoles = ["RECEPTION", "BRANCH_ADMIN", "ADMIN", "CLIENT_ADMIN", "SUPER_ADMIN"]
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Rate limit: 30 messages per 5 minutes per staff user
  if (await isRateLimited(`agent-reply:${user.email}`, 30, 300000)) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 })
  }

  const body = await req.json()
  const validation = agentReplyBodySchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.issues },
      { status: 400 }
    )
  }
  const { chat_id, message, action } = validation.data

  const supabase = createServerClient()

  // Fetch the live chat (scoped to the user's tenant)
  const tenantId = user.tenantId
  const { data: chat, error: chatErr } = await supabase
    .from("live_chats")
    .select("*")
    .eq("id", chat_id)
    .eq("tenant_id", tenantId)
    .single()

  if (chatErr || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  // Close action
  if (action === "close") {
    const existingMessages = chat.messages || []
    existingMessages.push({
      role: "system",
      content: "Chat closed by staff",
      ts: new Date().toISOString(),
    })

    await supabase
      .from("live_chats")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        messages: existingMessages,
      })
      .eq("id", chat_id)

    // Reset patient's bot state to MAIN_MENU
    await supabase
      .from("chat_sessions")
      .update({
        booking_state: { _state: "MAIN_MENU" },
      })
      .eq("phone", chat.phone)
      .eq("tenant_id", chat.tenant_id)

    // Notify patient
    const waConfig = await getTenantWhatsAppConfig(chat.tenant_id, supabase)
    await sendText(
      chat.phone,
      "Your live chat session has ended. Thank you for reaching out!\n\nType *Hi* to return to the main menu.",
      waConfig
    )

    return NextResponse.json({ success: true, action: "closed" })
  }

  // Send reply
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 })
  }

  // Send via WhatsApp
  const waConfig = await getTenantWhatsAppConfig(chat.tenant_id, supabase)
  const result = await sendText(chat.phone, message, waConfig)

  // Append to live_chats messages
  const existingMessages = chat.messages || []
  existingMessages.push({
    role: "staff",
    content: message,
    staff_name: user.name || "Staff",
    ts: new Date().toISOString(),
  })

  await supabase
    .from("live_chats")
    .update({
      messages: existingMessages,
      updated_at: new Date().toISOString(),
      assigned_to: user.name || "Staff",
    })
    .eq("id", chat_id)

  return NextResponse.json({
    success: result.success,
    messageId: result.messageId,
  })
 } catch (err) {
    log.error({ err }, "Agent reply error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
