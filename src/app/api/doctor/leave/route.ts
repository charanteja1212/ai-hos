import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { sendDoctorLeaveNotification, getTenantWhatsAppConfig, normalizePhone } from "@/lib/whatsapp/sender"
import { cancelReminders } from "@/lib/queue/queues"
import { generateWaToken } from "@/lib/whatsapp/wa-token"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Allow doctors, admins, and reception
    const allowedRoles = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN", "RECEPTION", "DOCTOR"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { doctor_id, tenant_id: bodyTenantId, date, type, reason, start_time, end_time } = body

    if (!doctor_id || !date || !type) {
      return NextResponse.json({ error: "doctor_id, date, and type are required" }, { status: 400 })
    }

    const tenant_id = user.role === "SUPER_ADMIN" || user.role === "CLIENT_ADMIN"
      ? bodyTenantId || user.tenantId
      : user.tenantId

    const supabase = createServerClient()

    // 1. Save the date override
    const overrideId = `OVR_${doctor_id}_${date.replace(/-/g, "")}_${Date.now()}`
    const overrideRecord: Record<string, unknown> = {
      override_id: overrideId,
      doctor_id,
      tenant_id,
      override_date: date,
      reason: reason || (type === "leave" ? "Personal" : "Custom hours"),
    }

    if (type === "custom_hours") {
      overrideRecord.start_time = start_time
      overrideRecord.end_time = end_time
      overrideRecord.is_available = true
    } else {
      overrideRecord.is_available = false
    }

    const { error: overrideError } = await supabase
      .from("date_overrides")
      .insert(overrideRecord)

    if (overrideError) {
      console.error("[doctor/leave] Override insert error:", overrideError.message)
      return NextResponse.json({ error: "Failed to save leave" }, { status: 500 })
    }

    // 2. Fetch affected confirmed appointments
    let appointmentQuery = supabase
      .from("appointments")
      .select("booking_id, patient_phone, patient_name, doctor_name, specialty, date, time, status")
      .eq("doctor_id", doctor_id)
      .eq("date", date)
      .eq("tenant_id", tenant_id)
      .eq("status", "confirmed")

    // For custom hours, only get appointments outside the new hours
    if (type === "custom_hours" && start_time && end_time) {
      appointmentQuery = appointmentQuery.or(`time.lt.${start_time},time.gte.${end_time}`)
    }

    const { data: affectedAppointments, error: fetchError } = await appointmentQuery

    if (fetchError) {
      console.error("[doctor/leave] Fetch appointments error:", fetchError.message)
      // Override saved but couldn't fetch appointments
      return NextResponse.json({
        success: true,
        override_saved: true,
        cancelled_count: 0,
        notified_count: 0,
        error_detail: "Leave saved but failed to fetch affected appointments",
      })
    }

    if (!affectedAppointments || affectedAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        override_saved: true,
        cancelled_count: 0,
        notified_count: 0,
        message: "Leave saved. No appointments affected.",
      })
    }

    // 3. Cancel all affected appointments
    const bookingIds = affectedAppointments.map((a) => a.booking_id)
    const { error: cancelError } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .in("booking_id", bookingIds)
      .eq("tenant_id", tenant_id)

    if (cancelError) {
      console.error("[doctor/leave] Cancel error:", cancelError.message)
    }

    const cancelledCount = cancelError ? 0 : bookingIds.length

    // 4. Cancel scheduled reminders for all affected appointments
    for (const bid of bookingIds) {
      cancelReminders(bid).catch(() => {})
    }

    // 5. Get hospital name, WhatsApp config, and check OP Passes for affected appointments
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.ainewworld.in"
    const [tenantRes, waConfig, opPassesRes] = await Promise.all([
      supabase.from("tenants").select("hospital_name").eq("tenant_id", tenant_id).single(),
      getTenantWhatsAppConfig(tenant_id, supabase),
      supabase.from("op_passes").select("op_pass_id, booking_id, status").in("booking_id", bookingIds),
    ])
    const hospitalName = tenantRes.data?.hospital_name || user.hospitalName || "Hospital"
    const opPassMap = new Map(
      (opPassesRes.data || []).map((p: { booking_id: string; status: string }) => [p.booking_id, p.status === "ACTIVE"])
    )

    // 6. Send WhatsApp notifications to all affected patients with reschedule link
    let notifiedCount = 0
    const notifyPromises = affectedAppointments.map(async (appt) => {
      if (!appt.patient_phone) return false
      const hasOpPass = opPassMap.get(appt.booking_id) || false
      // Generate a 72-hour token so patient has time to reschedule
      const phone = normalizePhone(appt.patient_phone)
      const token = await generateWaToken(phone, tenant_id, appt.patient_name || undefined, "72h")
      const rescheduleLink = `${appUrl}/wa/appointments?token=${encodeURIComponent(token)}`
      try {
        const result = await sendDoctorLeaveNotification(
          appt.patient_phone,
          {
            patientName: appt.patient_name || "Patient",
            doctorName: appt.doctor_name || "Doctor",
            specialty: appt.specialty || "",
            date: appt.date,
            time: appt.time,
            bookingId: appt.booking_id,
            hospitalName,
            reason,
            hasOpPass,
            rescheduleLink,
          },
          waConfig
        )
        return result.success
      } catch (err) {
        console.error(`[doctor/leave] WhatsApp notify failed for ${appt.booking_id}:`, err)
        return false
      }
    })

    const results = await Promise.allSettled(notifyPromises)
    notifiedCount = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length

    return NextResponse.json({
      success: true,
      override_saved: true,
      cancelled_count: cancelledCount,
      notified_count: notifiedCount,
      total_affected: affectedAppointments.length,
      affected_patients: affectedAppointments.map((a) => ({
        booking_id: a.booking_id,
        patient_name: a.patient_name,
        time: a.time,
      })),
      message: `Leave saved. ${cancelledCount} appointment(s) cancelled, ${notifiedCount} patient(s) notified via WhatsApp.`,
    })
  } catch (error) {
    console.error("[doctor/leave] API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
