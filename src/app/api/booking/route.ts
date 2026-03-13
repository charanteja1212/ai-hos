import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import {
  checkAvailability,
  bookAppointment,
  cancelAppointment,
  listSpecialties,
  patientLookup,
  savePatient,
} from "@/lib/booking/service"
import { sendBookingConfirmation, sendCancellationConfirmation, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only allow staff roles to use this API
    const allowedRoles = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN", "RECEPTION", "DOCTOR"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { action, ...params } = body

    // Inject tenant_id from session to prevent cross-tenant access
    let tenant_id: string
    if (user.role === "SUPER_ADMIN" || user.role === "CLIENT_ADMIN") {
      tenant_id = params.tenant_id || user.tenantId
    } else {
      tenant_id = user.tenantId
    }

    // ── list-specialties ──────────────────────────────────────────────────
    if (action === "list-specialties") {
      const result = await listSpecialties(tenant_id)
      return NextResponse.json(result)
    }

    // ── check-availability ────────────────────────────────────────────────
    if (action === "check-availability") {
      const result = await checkAvailability({
        tenant_id,
        doctor_id: params.doctor_id,
        specialty: params.specialty,
      })
      return NextResponse.json(result)
    }

    // ── book-appointment ──────────────────────────────────────────────────
    if (action === "book-appointment") {
      // Validate required fields
      const errors: string[] = []

      if (!params.doctor_id || typeof params.doctor_id !== "string" || !params.doctor_id.trim()) {
        errors.push("doctor_id is required")
      }
      if (!params.doctor_name || typeof params.doctor_name !== "string" || !params.doctor_name.trim()) {
        errors.push("doctor_name is required")
      }
      if (!params.patient_name || typeof params.patient_name !== "string" || !params.patient_name.trim()) {
        errors.push("patient_name is required")
      }
      if (!params.date || !/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
        errors.push("date must be in YYYY-MM-DD format")
      }
      if (!params.time || !/^\d{2}:\d{2}$/.test(params.time)) {
        errors.push("time must be in HH:MM 24-hour format")
      }
      if (!params.patient_phone || !/\d{10,}/.test(params.patient_phone.replace(/\D/g, ""))) {
        errors.push("patient_phone must have at least 10 digits")
      }

      if (errors.length > 0) {
        return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
      }

      const result = await bookAppointment({
        tenant_id,
        patient_phone: params.patient_phone,
        patient_name: params.patient_name,
        patient_type: params.patient_type,
        doctor_id: params.doctor_id,
        doctor_name: params.doctor_name,
        specialty: params.specialty,
        date: params.date,
        time: params.time,
        source: params.source || "dashboard",
        booked_by_whatsapp_number: params.booked_by_whatsapp_number,
      })

      // Send WhatsApp confirmation (fire-and-forget, don't block response)
      if (result.success && result.booking_id) {
        const supabase = createServerClient()
        getTenantWhatsAppConfig(tenant_id, supabase).then((waConfig) => {
          sendBookingConfirmation(params.patient_phone, {
            patientName: params.patient_name,
            doctorName: params.doctor_name,
            specialty: params.specialty,
            date: params.date,
            time: params.time,
            bookingId: result.booking_id,
            hospitalName: user.hospitalName || "Hospital",
          }, waConfig).catch((err) => console.error("[booking] WhatsApp confirmation failed:", err))
        })
      }

      return NextResponse.json(result)
    }

    // ── cancel-appointment ────────────────────────────────────────────────
    if (action === "cancel-appointment") {
      const result = await cancelAppointment({
        tenant_id,
        booking_id: params.booking_id,
        patient_phone: params.patient_phone,
      })

      // Send WhatsApp cancellation notice (fire-and-forget)
      if (result.success && result.cancelled_booking) {
        const supabase = createServerClient()
        getTenantWhatsAppConfig(tenant_id, supabase).then((waConfig) => {
          sendCancellationConfirmation(params.patient_phone || "", {
            patientName: result.cancelled_booking!.patient_name || "",
            bookingId: params.booking_id,
            hospitalName: user.hospitalName || "Hospital",
          }, waConfig).catch((err) => console.error("[booking] WhatsApp cancel notice failed:", err))
        })
      }

      return NextResponse.json(result)
    }

    // ── patient-lookup ────────────────────────────────────────────────────
    if (action === "patient-lookup") {
      if (!params.phone) {
        return NextResponse.json({ error: "Phone number required" }, { status: 400 })
      }
      const result = await patientLookup(tenant_id, params.phone)
      return NextResponse.json(result)
    }

    // ── save-patient ──────────────────────────────────────────────────────
    if (action === "save-patient") {
      if (!params.phone || !params.name) {
        return NextResponse.json({ error: "Phone and name required" }, { status: 400 })
      }
      const result = await savePatient({
        phone: params.phone,
        name: params.name,
        age: params.age,
        gender: params.gender,
        email: params.email,
        address: params.address,
        tenant_id,
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Booking API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
