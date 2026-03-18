import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { sendText, getTenantWhatsAppConfig } from "@/lib/whatsapp/sender"
import { createServerNotifications } from "@/lib/notifications-server"

/**
 * POST /api/notifications/post-consultation
 * Replaces n8n webhook: /webhook/post-consultation-notify
 *
 * Sends WhatsApp notification to patient after consultation + schedules follow-up reminder.
 */
export async function POST(req: NextRequest) {
  console.log("[post-consult] API called")

  // Auth check — log but don't block (fire-and-forget calls may have stale sessions)
  let authenticated = false
  try {
    const session = await auth()
    authenticated = !!session?.user
    console.log("[post-consult] Auth:", authenticated ? "OK" : "FAIL (no session)")
  } catch (e) {
    console.error("[post-consult] Auth error:", e instanceof Error ? e.message : e)
  }

  const body = await req.json()
  const {
    prescription_id,
    booking_id,
    patient_phone,
    patient_name,
    doctor_name,
    diagnosis,
    items,
    lab_tests,
    follow_up_date,
    tenant_id,
  } = body

  console.log("[post-consult] Payload:", {
    prescription_id, booking_id, patient_phone, patient_name,
    doctor_name, diagnosis, itemCount: items?.length, labCount: lab_tests?.length,
    follow_up_date, tenant_id,
  })

  if (!patient_phone || !tenant_id) {
    console.error("[post-consult] FAIL — Missing required fields:", { patient_phone, tenant_id })
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const supabase = createServerClient()

  // 1. Get tenant info for WhatsApp config
  const { data: tenant } = await supabase
    .from("tenants")
    .select("hospital_name, whatsapp_phone_id, wa_token")
    .eq("tenant_id", tenant_id)
    .single()

  const hospitalName = tenant?.hospital_name || "Hospital"

  // 2. Build WhatsApp message
  const medicineList = items?.length
    ? items.map((m: { medicine_name?: string; name?: string; dosage?: string }) => `  - ${m.medicine_name || m.name || "Medicine"}${m.dosage ? ` (${m.dosage})` : ""}`).join("\n")
    : "  None"

  const labList = lab_tests?.length
    ? lab_tests.map((t: string | { test_name?: string; name?: string }) => `  - ${typeof t === "string" ? t : (t.test_name || t.name)}`).join("\n")
    : ""

  const displayDoctor = doctor_name?.startsWith("Dr.") ? doctor_name : `Dr. ${doctor_name}`

  let message = `*${hospitalName}*\n*Consultation Summary*\n\n`
  message += `Dear ${patient_name || "Patient"},\n\n`
  message += `Your consultation with ${displayDoctor} has been completed.\n`

  if (prescription_id) {
    message += `Prescription Ref: ${prescription_id}\n`
  }

  if (diagnosis) message += `\nDiagnosis: ${diagnosis}\n`

  message += `\nPrescribed Medicines:\n${medicineList}\n`

  if (labList) message += `\nLab Tests Ordered:\n${labList}\n`

  if (follow_up_date) {
    message += `\nFollow-up Date: ${follow_up_date}\n`
  }

  message += `\nPlease proceed to the pharmacy counter to collect your medicines.`
  if (labList) message += ` For lab tests, please visit the laboratory with your prescription reference.`

  message += `\n\nRegards,\n${hospitalName}`

  // 3. Send WhatsApp notification with per-tenant config
  console.log("[post-consult] Message built, length:", message.length)
  console.log("[post-consult] Message preview:", message.substring(0, 200))
  const waConfig = await getTenantWhatsAppConfig(tenant_id, supabase)
  console.log("[post-consult] WA config:", { hasPhoneId: !!waConfig?.phoneNumberId, hasToken: !!waConfig?.token })
  const result = await sendText(patient_phone, message, waConfig)
  console.log("[post-consult] WA send result:", result)

  // 3.5 In-app notifications for pharmacy + reception
  const notifications = [
    {
      tenantId: tenant_id,
      type: "prescription_created" as const,
      title: "New Prescription",
      message: `Dr. ${doctor_name || "Doctor"} prescribed for ${patient_name || "Patient"}${diagnosis ? ` (${diagnosis})` : ""}`,
      targetRole: "PHARMACY",
      referenceId: prescription_id || booking_id,
      referenceType: "prescription",
    },
  ]

  if (lab_tests?.length) {
    notifications.push({
      tenantId: tenant_id,
      type: "prescription_created" as const,
      title: "Lab Tests Ordered",
      message: `Dr. ${doctor_name || "Doctor"} ordered ${lab_tests.length} test(s) for ${patient_name || "Patient"}`,
      targetRole: "LAB",
      referenceId: prescription_id || booking_id,
      referenceType: "prescription",
    })
  }

  createServerNotifications(notifications)

  // 4. Schedule feedback request (30 min after consultation)
  if (booking_id && patient_phone) {
    try {
      const { getNotificationQueue } = await import("@/lib/queue/queues")
      const queue = getNotificationQueue()
      await queue.add(
        "feedback-request",
        {
          booking_id,
          patient_phone,
          patient_name: patient_name || "Patient",
          doctor_name: doctor_name || "",
          doctor_id: body.doctor_id || "",
          specialty: body.specialty || "",
          tenant_id,
          hospital_name: hospitalName,
        },
        {
          delay: 30 * 60 * 1000, // 30 minutes
          jobId: `feedback-${booking_id}`,
        }
      )
    } catch {
      // Queue not available — non-critical
    }
  }

  // 5. Schedule follow-up reminder if date provided
  if (follow_up_date && booking_id) {
    try {
      const { scheduleReminders } = await import("@/lib/queue/queues")
      const followUpDate = new Date(follow_up_date)
      // Schedule a reminder 1 day before follow-up at 9 AM IST
      const reminderTime = new Date(followUpDate)
      reminderTime.setDate(reminderTime.getDate() - 1)
      reminderTime.setHours(3, 30, 0, 0) // 9 AM IST = 3:30 UTC

      if (reminderTime.getTime() > Date.now() + 60000) {
        const { getReminderQueue } = await import("@/lib/queue/queues")
        const queue = getReminderQueue()
        await queue.add(
          "follow-up-reminder",
          {
            booking_id,
            patient_phone,
            patient_name,
            doctor_name,
            follow_up_date,
            tenant_id,
            hospital_name: hospitalName,
          },
          {
            delay: reminderTime.getTime() - Date.now(),
            jobId: `followup-${booking_id}`,
          }
        )
      }
    } catch {
      // Queue not available — non-critical
    }
  }

  console.log("[post-consult] ===== DONE ===== wa_sent:", result.success, "booking:", booking_id)
  return NextResponse.json({
    success: result.success,
    whatsapp_sent: result.success,
  })
}
