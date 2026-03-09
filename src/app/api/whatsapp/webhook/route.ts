import { NextRequest, NextResponse } from "next/server"
import { resolveClientByPhoneNumberId } from "@/lib/platform/client-router"

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "care_hospital_whatsapp_2026"
const N8N_WEBHOOK_URL = process.env.N8N_API_URL
  ? `${process.env.N8N_API_URL}/webhook/whatsapp-cloud`
  : "https://ainewworld.in/webhook/whatsapp-cloud"

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
 * POST — Receive WhatsApp messages, resolve tenant, forward to n8n
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Extract phone_number_id from the webhook payload
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const phoneNumberId = value?.metadata?.phone_number_id

    if (!phoneNumberId) {
      // Status updates or other non-message webhooks — forward as-is
      forwardToN8n(body).catch(() => {})
      return NextResponse.json({ status: "ok" })
    }

    // Resolve tenant from phone_number_id
    const route = await resolveClientByPhoneNumberId(phoneNumberId)

    // Build enriched payload with tenant context
    const enrichedBody = {
      ...body,
      _tenant: route
        ? {
            tenantId: route.tenantId,
            clientId: route.clientId,
            hospitalName: route.hospitalName,
            phoneNumberId: route.waPhoneNumberId,
          }
        : null,
    }

    // Forward to n8n WhatsApp bot workflow
    await forwardToN8n(enrichedBody)

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("[whatsapp-webhook] Error:", error)
    // Always return 200 to Meta — otherwise they retry aggressively
    return NextResponse.json({ status: "ok" })
  }
}

/**
 * Forward webhook payload to n8n
 */
async function forwardToN8n(payload: unknown): Promise<void> {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.error("[whatsapp-webhook] n8n forward failed:", res.status)
    }
  } catch (err) {
    console.error("[whatsapp-webhook] n8n forward error:", err)
  }
}
