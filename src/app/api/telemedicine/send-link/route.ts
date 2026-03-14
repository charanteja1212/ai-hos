import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { requireFeature } from "@/lib/platform/check-feature"
import { getJitsiUrl } from "@/lib/telemedicine"
import { sendText, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"

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

    // Feature gate: check telemedicine feature
    const featureBlock = await requireFeature(user.clientId, "telemedicine")
    if (featureBlock) return featureBlock

    const body = await req.json()
    const { patientPhone, roomName, doctorName, patientName, tenantId } = body

    // Validate required fields
    const errors: string[] = []
    if (!patientPhone) errors.push("patientPhone is required")
    if (!roomName) errors.push("roomName is required")
    if (!doctorName) errors.push("doctorName is required")
    if (!patientName) errors.push("patientName is required")
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

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
    console.error("[telemedicine] Send link error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
