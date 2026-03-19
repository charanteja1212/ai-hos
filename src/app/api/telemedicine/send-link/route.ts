import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { requireFeature } from "@/lib/platform/check-feature"
import { getJitsiUrl } from "@/lib/telemedicine"
import { sendText, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createRouteLogger } from "@/lib/logger"
import { telemedicineSendLinkBodySchema } from "@/lib/validations/api-schemas"
import { isRateLimited } from "@/lib/rate-limit"

const log = createRouteLogger("/api/telemedicine/send-link")

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only allow staff roles
    const allowedRoles = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN", "DOCTOR"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Rate limit: 10 links per 5 minutes per user
    if (await isRateLimited(`telemedicine:${user.email}`, 10, 300000)) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 })
    }

    // Feature gate: check telemedicine feature
    const featureBlock = await requireFeature(user.clientId, "telemedicine")
    if (featureBlock) return featureBlock

    const body = await req.json()
    const validation = telemedicineSendLinkBodySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      )
    }
    const { patientPhone, roomName, doctorName, patientName, tenantId } = validation.data

    // Use tenant from session unless super/client admin overrides
    let effectiveTenantId: string
    if (user.role === "SUPER_ADMIN" || user.role === "CLIENT_ADMIN") {
      effectiveTenantId = tenantId || user.tenantId
    } else {
      effectiveTenantId = user.tenantId
    }

    const jitsiUrl = getJitsiUrl(roomName, patientName)
    const firstName = (patientName || "").split(" ")[0] || "Patient"

    const message = [
      `Dear ${firstName},`,
      ``,
      `Dr. ${doctorName} has started a video consultation.`,
      ``,
      `Join now: ${jitsiUrl}`,
      ``,
      `Please ensure you have a stable internet connection and allow camera/microphone access when prompted.`,
    ].join("\n")

    const supabase = createServerClient()
    const waConfig = await getTenantWhatsAppConfig(effectiveTenantId, supabase)
    const result = await sendText(patientPhone, message, waConfig)

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        jitsiUrl,
      })
    }

    return NextResponse.json(
      { error: "Failed to send WhatsApp message", details: result.error },
      { status: 502 }
    )
  } catch (error) {
    log.error({ err: error }, "Send link error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
