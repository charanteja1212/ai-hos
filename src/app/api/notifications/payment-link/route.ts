import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { sendPaymentLink, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createRouteLogger } from "@/lib/logger"

const log = createRouteLogger("/api/notifications/payment-link")

/**
 * POST /api/notifications/payment-link
 * Sends a WhatsApp payment link to a patient for an unpaid invoice.
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
    const { invoice_id, patient_phone, patient_name, amount, description, tenant_id } = body

    if (!patient_phone || !amount || !tenant_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("hospital_name")
      .eq("tenant_id", tenant_id)
      .single()

    const hospitalName = tenant?.hospital_name || "Hospital"

    // Build payment link — uses the /wa/pay page with invoice ID
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.ainewworld.in"
    const paymentLink = `${baseUrl}/wa/pay?id=${invoice_id || ""}&phone=${encodeURIComponent(patient_phone)}`

    const waConfig = await getTenantWhatsAppConfig(tenant_id, supabase)

    const result = await sendPaymentLink(
      patient_phone,
      {
        patientName: patient_name || "Patient",
        amount: Number(amount),
        invoiceId: invoice_id,
        description: description || "Hospital services",
        hospitalName,
        paymentLink,
      },
      waConfig
    )

    log.info({ invoice_id, patient_phone, success: result.success }, "Payment link sent via WhatsApp")

    return NextResponse.json({ success: result.success, messageId: result.messageId })
  } catch (err) {
    log.error({ err }, "Failed to send payment link")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
