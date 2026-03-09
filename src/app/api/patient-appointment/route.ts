import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import type { SessionUser } from "@/types/auth"
import { cancelAppointment } from "@/lib/booking/service"
import { sendCancellationConfirmation, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user || user.role !== "PATIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { action, booking_id } = body

    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 })
    }

    const tenant_id = user.tenantId

    if (action === "cancel") {
      // Verify patient owns this booking
      const supabase = createServerClient()
      const phoneVariants: string[] = []
      if (user.patientPhone) {
        phoneVariants.push(user.patientPhone)
        if (user.patientPhone.startsWith("91") && user.patientPhone.length === 12) {
          phoneVariants.push(user.patientPhone.slice(2))
        } else if (user.patientPhone.length === 10) {
          phoneVariants.push(`91${user.patientPhone}`)
        }
      }

      const { data: booking } = await supabase
        .from("appointments")
        .select("patient_phone, tenant_id, status")
        .eq("booking_id", booking_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (!booking || !phoneVariants.includes(booking.patient_phone)) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 })
      }

      if (booking.status !== "confirmed") {
        return NextResponse.json({ error: "Can only cancel confirmed appointments" }, { status: 400 })
      }

      // Cancel via direct Supabase (no n8n)
      const result = await cancelAppointment({
        tenant_id,
        booking_id,
        patient_phone: user.patientPhone,
      })

      // Send WhatsApp cancellation notice with per-tenant config (fire-and-forget)
      if (result.success) {
        getTenantWhatsAppConfig(tenant_id, supabase).then((waConfig) => {
          sendCancellationConfirmation(user.patientPhone || "", {
            patientName: user.name || "",
            bookingId: booking_id,
            hospitalName: user.hospitalName || "Hospital",
          }, waConfig).catch((err) => console.error("[patient-appointment] WhatsApp cancel failed:", err))
        })
      }

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
