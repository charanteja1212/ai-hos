import { NextRequest, NextResponse } from "next/server"
import { parseWebhookPayload, isStatusUpdate } from "@/lib/whatsapp/parser"
import { isDuplicate } from "@/lib/whatsapp/dedup"
import { loadSession, saveSession } from "@/lib/whatsapp/session"
import { runAgent } from "@/lib/whatsapp/agent"
import { sendReply } from "@/lib/whatsapp/send-reply"
import type { TenantConfig } from "@/lib/whatsapp/types"

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "care_hospital_whatsapp_2026"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const WA_API_URL_DEFAULT = process.env.WA_API_URL || ""
const WA_TOKEN_DEFAULT = process.env.WA_ACCESS_TOKEN || ""

/**
 * GET — Meta webhook verification (hub.challenge)
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

/**
 * Resolve tenant from WhatsApp phone_number_id via Supabase
 */
async function resolveTenant(receiverPhoneId: string): Promise<TenantConfig | null> {
  if (!receiverPhoneId) return null

  try {
    const res = await fetch(
      SUPABASE_URL +
        "/tenants?whatsapp_phone_id=eq." +
        encodeURIComponent(receiverPhoneId) +
        "&status=eq.active&select=*",
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
        },
        signal: AbortSignal.timeout(10000),
      }
    )

    if (res.ok) {
      const tenants = await res.json()
      if (Array.isArray(tenants) && tenants.length > 0) {
        const t = tenants[0]
        return {
          tenant_id: t.tenant_id || "T001",
          hospital_name: t.hospital_name || "Care Hospital",
          bot_name: t.bot_name || "Advera",
          consultation_fee: t.consultation_fee || 200,
          openai_api_key: t.openai_api_key || "",
          openai_model: t.openai_model || "gpt-4o-mini",
          wa_token: t.wa_token || "",
          wa_api_url: t.wa_api_url || "",
          whatsapp_phone_id: t.whatsapp_phone_id || "",
          flow_registration_id: t.flow_registration_id || "",
          flow_dependent_id: t.flow_dependent_id || "",
        }
      }
    }
  } catch (e) {
    console.error("[webhook] Tenant resolution error:", e)
  }

  // No auto-create — tenants must be configured via Super Admin > WhatsApp Routing
  console.warn("[webhook] No tenant found for phone_number_id:", receiverPhoneId)
  return null
}

/**
 * POST — Receive WhatsApp messages and process them through the bot
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Ignore status updates (delivery receipts, read receipts)
    if (isStatusUpdate(body)) {
      return NextResponse.json({ status: "ok" })
    }

    // Step 1: Parse the message
    const parsed = parseWebhookPayload(body)
    if (!parsed || !parsed.messageBody) {
      // No actionable message (could be a media message, etc.)
      return NextResponse.json({ status: "ok" })
    }

    // Step 2: Dedup check
    if (parsed.messageId) {
      const dup = await isDuplicate(parsed.messageId)
      if (dup) {
        return NextResponse.json({ status: "duplicate" })
      }
    }

    // Step 3: Resolve tenant
    const tenant = await resolveTenant(parsed.receiverPhoneId)
    const tenantId = tenant?.tenant_id || "T001"
    const tenantConfig: TenantConfig = tenant || {
      tenant_id: "T001",
      hospital_name: "Care Hospital",
      bot_name: "Advera",
      consultation_fee: 200,
      openai_api_key: process.env.OPENAI_API_KEY || "",
      openai_model: "gpt-4o-mini",
      wa_token: WA_TOKEN_DEFAULT,
      wa_api_url: WA_API_URL_DEFAULT,
      whatsapp_phone_id: "",
      flow_registration_id: "",
      flow_dependent_id: "",
    }

    const cleanPhone = (parsed.senderPhone || "").replace(/\D/g, "")

    // Step 4: Load session
    const session = await loadSession(cleanPhone, tenantId, parsed.messageId)
    if (session.isDuplicateMessage) {
      return NextResponse.json({ status: "duplicate" })
    }

    // Step 5: Run state machine
    const result = await runAgent({
      senderPhone: parsed.senderPhone,
      messageBody: parsed.messageBody,
      messageId: parsed.messageId,
      cleanPhone,
      tenantId,
      tenant: tenantConfig,
      state: session.state,
      data: session.data,
      language: session.language,
      convoMessages: session.convoMessages,
    })

    // Step 6: Send reply
    const waToken = tenantConfig.wa_token || WA_TOKEN_DEFAULT
    const waApiUrl = tenantConfig.wa_api_url || WA_API_URL_DEFAULT

    const sendResult = await sendReply({
      senderPhone: cleanPhone,
      messageId: parsed.messageId,
      aiReply: result.reply,
      language: result.language,
      waToken,
      waApiUrl,
      tenantConfig: {
        flow_registration_id: tenantConfig.flow_registration_id || null,
        flow_dependent_id: tenantConfig.flow_dependent_id || null,
      },
    })

    if (!sendResult.success) {
      console.error("[webhook] Send failed:", sendResult.error)
    }

    // Step 7: Save session
    await saveSession(
      cleanPhone,
      tenantId,
      result.nextState,
      result.data,
      result.language,
      session.convoMessages,
      parsed.messageId,
      parsed.messageBody,
      result.reply
    )

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("[webhook] Error:", error)
    // Always return 200 to Meta to prevent aggressive retries
    return NextResponse.json({ status: "ok" })
  }
}
