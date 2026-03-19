import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { sendLabResultNotification, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createRouteLogger } from "@/lib/logger"

const log = createRouteLogger("/api/notifications/lab-results")

/**
 * POST /api/notifications/lab-results
 * Sends WhatsApp notification to patient when lab results are ready.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { order_id, patient_phone, patient_name, tests, tenant_id } = body

    if (!order_id || !patient_phone || !tenant_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Get tenant info for hospital name
    const { data: tenant } = await supabase
      .from("tenants")
      .select("hospital_name")
      .eq("tenant_id", tenant_id)
      .single()

    const hospitalName = tenant?.hospital_name || "Hospital"

    // Get WhatsApp config for this tenant
    const waConfig = await getTenantWhatsAppConfig(tenant_id, supabase)

    const testNames = (tests || []).map((t: { test_name?: string; name?: string }) => t.test_name || t.name || "Test")

    const result = await sendLabResultNotification(
      patient_phone,
      {
        patientName: patient_name || "Patient",
        orderId: order_id,
        tests: testNames,
        hospitalName,
      },
      waConfig
    )

    log.info({ order_id, patient_phone, success: result.success }, "Lab result notification sent")

    return NextResponse.json({ success: result.success, messageId: result.messageId })
  } catch (err) {
    log.error({ err }, "Failed to send lab result notification")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
