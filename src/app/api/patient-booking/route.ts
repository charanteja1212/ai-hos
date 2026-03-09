import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import {
  listSpecialties,
  checkAvailability,
  bookAppointment,
} from "@/lib/booking/service"
import { sendBookingConfirmation, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user || user.role !== "PATIENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    const tenant_id = body.tenant_id || user.tenantId
    if (!tenant_id) {
      return NextResponse.json({ error: "Missing tenant_id" }, { status: 400 })
    }

    if (action === "list-specialties") {
      const result = await listSpecialties(tenant_id)
      return NextResponse.json(result)
    }

    if (action === "check-availability") {
      const result = await checkAvailability({
        tenant_id,
        doctor_id: body.doctor_id,
        specialty: body.specialty,
      })
      return NextResponse.json(result)
    }

    if (action === "book-appointment") {
      const result = await bookAppointment({
        tenant_id,
        patient_phone: user.patientPhone || "",
        patient_name: user.name || "",
        patient_type: "SELF",
        doctor_id: body.doctor_id,
        doctor_name: body.doctor_name,
        specialty: body.specialty,
        date: body.date,
        time: body.time,
        source: "patient_portal",
      })

      // Send WhatsApp confirmation (fire-and-forget) with per-tenant config
      if (result.success && result.booking_id) {
        const supabase = createServerClient()
        getTenantWhatsAppConfig(tenant_id, supabase).then((waConfig) => {
          sendBookingConfirmation(user.patientPhone || "", {
            patientName: user.name || "",
            doctorName: body.doctor_name,
            specialty: body.specialty,
            date: body.date,
            time: body.time,
            bookingId: result.booking_id,
            hospitalName: user.hospitalName || "Hospital",
          }, waConfig).catch((err) => console.error("[patient-booking] WhatsApp failed:", err))
        })
      }

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
