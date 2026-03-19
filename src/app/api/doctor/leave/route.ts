import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { sendDoctorLeaveNotification, getTenantWhatsAppConfig, normalizePhone } from "@/lib/whatsapp/sender"
import { logAudit } from "@/lib/audit"
import { cancelReminders } from "@/lib/queue/queues"
import { generateWaToken } from "@/lib/whatsapp/wa-token"
import { createRouteLogger } from "@/lib/logger"
import { doctorLeaveBodySchema } from "@/lib/validations/api-schemas"

const log = createRouteLogger("/api/doctor/leave")

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
    const validation = doctorLeaveBodySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      )
    }
    const { doctor_id, date, type, reason, start_time, end_time } = validation.data

    const tenant_id = user.role === "SUPER_ADMIN" || user.role === "CLIENT_ADMIN"
      ? validation.data.tenant_id || user.tenantId
      : user.tenantId

    const supabase = createServerClient()

    // 1-3. Atomically: save override + cancel affected appointments
    const overrideId = `OVR_${doctor_id}_${date.replace(/-/g, "")}_${Date.now()}`

    const { data: rpcResult, error: rpcError } = await supabase.rpc("fn_doctor_leave_cancel", {
      p_override_id: overrideId,
      p_doctor_id: doctor_id,
      p_tenant_id: tenant_id,
      p_date: date,
      p_type: type,
      p_reason: reason || null,
      p_start_time: start_time || null,
      p_end_time: end_time || null,
    })

    if (rpcError || (rpcResult && !rpcResult.success)) {
      const errorMsg = rpcResult?.error || rpcError?.message || "Failed to save leave"
      log.error({ err: errorMsg }, "Doctor leave RPC error")
      return NextResponse.json({ error: errorMsg }, { status: 500 })
    }

    logAudit({
      action: "create", entityType: "date_override", entityId: overrideId,
      actorEmail: user.email || "doctor", actorRole: user.role, tenantId: tenant_id,
      details: { doctor_id, date, type, reason },
    })

    const cancelledIds: string[] = rpcResult?.cancelled_ids || []
    const cancelledCount: number = rpcResult?.cancelled_count || 0

    if (cancelledCount === 0) {
      return NextResponse.json({
        success: true,
        override_saved: true,
        cancelled_count: 0,
        notified_count: 0,
        message: "Leave saved. No appointments affected.",
      })
    }

    // Fetch affected appointment details for notifications (read-only, outside transaction)
    const { data: affectedAppointments } = await supabase
      .from("appointments")
      .select("booking_id, patient_phone, patient_name, doctor_name, specialty, date, time, status")
      .in("booking_id", cancelledIds)

    if (!affectedAppointments || affectedAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        override_saved: true,
        cancelled_count: cancelledCount,
        notified_count: 0,
        message: `Leave saved. ${cancelledCount} appointment(s) cancelled.`,
      })
    }

    const bookingIds = affectedAppointments.map((a) => a.booking_id)

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
        log.error({ err, bookingId: appt.booking_id }, "WhatsApp notify failed")
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
    log.error({ err: error }, "API error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
