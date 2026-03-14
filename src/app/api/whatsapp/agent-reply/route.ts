import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendText, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createServerClient } from "@/lib/supabase/server"

/**
 * POST /api/whatsapp/agent-reply
 * Reception staff sends a reply to a patient in live chat mode.
 * Also supports closing the chat.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { chat_id, message, action } = body

  if (!chat_id) {
    return NextResponse.json({ error: "chat_id required" }, { status: 400 })
  }

  const supabase = createServerClient()

  // Fetch the live chat
  const { data: chat, error: chatErr } = await supabase
    .from("live_chats")
    .select("*")
    .eq("id", chat_id)
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
    staff_name: (session.user as { name?: string }).name || "Staff",
    ts: new Date().toISOString(),
  })

  await supabase
    .from("live_chats")
    .update({
      messages: existingMessages,
      updated_at: new Date().toISOString(),
      assigned_to: (session.user as { name?: string }).name || "Staff",
    })
    .eq("id", chat_id)

  return NextResponse.json({
    success: result.success,
    messageId: result.messageId,
  })
}
