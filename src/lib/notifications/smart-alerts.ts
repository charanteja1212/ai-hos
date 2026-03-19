/**
 * Smart Alert Rules Engine
 *
 * Defines auto-triggered alerts based on clinical and operational conditions.
 * These run on a schedule (via cron or edge function) to catch overdue items
 * that staff might miss during busy shifts.
 *
 * Each rule returns a list of alerts that should be sent via WhatsApp/push/in-app.
 */

import { createServerClient } from "@/lib/supabase/server"
import { createRouteLogger } from "@/lib/logger"

const log = createRouteLogger("smart-alerts")

export type AlertPriority = "critical" | "high" | "medium" | "low"
export type AlertChannel = "whatsapp" | "push" | "in_app"

export interface SmartAlert {
  id: string
  tenantId: string
  type: string
  priority: AlertPriority
  title: string
  message: string
  channels: AlertChannel[]
  recipientPhone?: string
  recipientRole?: string
  metadata?: Record<string, unknown>
}

// ─── Alert Rules ────────────────────────────────────────────────────────────

/**
 * Find lab orders pending for more than the configured hours.
 * Default: 4 hours for urgent, 24 hours for routine.
 */
export async function checkOverdueLabResults(tenantId: string): Promise<SmartAlert[]> {
  const supabase = createServerClient()
  const alerts: SmartAlert[] = []

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Urgent labs pending > 4 hours
  const { data: urgentLabs } = await supabase
    .from("lab_orders")
    .select("order_id, patient_name, patient_phone, tests, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .eq("priority", "urgent")
    .lt("created_at", fourHoursAgo)
    .limit(20)

  for (const lab of urgentLabs || []) {
    const hoursAgo = Math.round((Date.now() - new Date(lab.created_at).getTime()) / (60 * 60 * 1000))
    alerts.push({
      id: `overdue-lab-${lab.order_id}`,
      tenantId,
      type: "overdue_lab_urgent",
      priority: "critical",
      title: "Urgent Lab Overdue",
      message: `${lab.patient_name}'s urgent lab order (${lab.order_id}) has been pending for ${hoursAgo}h. Please process immediately.`,
      channels: ["in_app", "push"],
      recipientRole: "LAB_TECH",
      metadata: { orderId: lab.order_id, patientName: lab.patient_name, hoursOverdue: hoursAgo },
    })
  }

  // Routine labs pending > 24 hours
  const { data: routineLabs } = await supabase
    .from("lab_orders")
    .select("order_id, patient_name, patient_phone, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .neq("priority", "urgent")
    .lt("created_at", twentyFourHoursAgo)
    .limit(20)

  for (const lab of routineLabs || []) {
    const hoursAgo = Math.round((Date.now() - new Date(lab.created_at).getTime()) / (60 * 60 * 1000))
    alerts.push({
      id: `overdue-lab-${lab.order_id}`,
      tenantId,
      type: "overdue_lab_routine",
      priority: "high",
      title: "Lab Order Overdue",
      message: `${lab.patient_name}'s lab order (${lab.order_id}) has been pending for ${hoursAgo}h.`,
      channels: ["in_app"],
      recipientRole: "LAB_TECH",
      metadata: { orderId: lab.order_id, patientName: lab.patient_name, hoursOverdue: hoursAgo },
    })
  }

  return alerts
}

/**
 * Find unpaid invoices past their due date or older than 7 days.
 */
export async function checkOverduePayments(tenantId: string): Promise<SmartAlert[]> {
  const supabase = createServerClient()
  const alerts: SmartAlert[] = []

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: unpaid } = await supabase
    .from("invoices")
    .select("invoice_id, patient_name, patient_phone, total_amount, created_at")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "partial"])
    .lt("created_at", sevenDaysAgo)
    .limit(30)

  for (const inv of unpaid || []) {
    const daysAgo = Math.round((Date.now() - new Date(inv.created_at).getTime()) / (24 * 60 * 60 * 1000))
    alerts.push({
      id: `overdue-payment-${inv.invoice_id}`,
      tenantId,
      type: "overdue_payment",
      priority: daysAgo > 14 ? "high" : "medium",
      title: "Payment Overdue",
      message: `Invoice ${inv.invoice_id} for ${inv.patient_name} (₹${inv.total_amount}) is ${daysAgo} days old. Consider sending a payment reminder.`,
      channels: daysAgo > 14 ? ["in_app", "whatsapp"] : ["in_app"],
      recipientPhone: inv.patient_phone,
      recipientRole: "RECEPTION",
      metadata: { invoiceId: inv.invoice_id, amount: inv.total_amount, daysOverdue: daysAgo },
    })
  }

  return alerts
}

/**
 * Find admitted patients approaching expected discharge date.
 */
export async function checkPendingDischarges(tenantId: string): Promise<SmartAlert[]> {
  const supabase = createServerClient()
  const alerts: SmartAlert[] = []

  const { data: admitted } = await supabase
    .from("admissions")
    .select("admission_id, patient_name, doctor_name, ward, bed_number, expected_discharge, admission_date, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "admitted")

  const now = Date.now()
  for (const adm of admitted || []) {
    if (adm.expected_discharge) {
      const expected = new Date(adm.expected_discharge).getTime()
      const hoursUntil = (expected - now) / (60 * 60 * 1000)

      // Alert if discharge is today or overdue
      if (hoursUntil < 24 && hoursUntil > -48) {
        alerts.push({
          id: `pending-discharge-${adm.admission_id}`,
          tenantId,
          type: hoursUntil < 0 ? "overdue_discharge" : "upcoming_discharge",
          priority: hoursUntil < 0 ? "high" : "medium",
          title: hoursUntil < 0 ? "Discharge Overdue" : "Discharge Today",
          message: hoursUntil < 0
            ? `${adm.patient_name} (${adm.ward} - ${adm.bed_number}) was expected to be discharged ${Math.abs(Math.round(hoursUntil))}h ago. Dr. ${adm.doctor_name} should review.`
            : `${adm.patient_name} (${adm.ward} - ${adm.bed_number}) is expected to be discharged today. Prepare discharge summary.`,
          channels: ["in_app"],
          recipientRole: "DOCTOR",
          metadata: { admissionId: adm.admission_id, ward: adm.ward, bed: adm.bed_number },
        })
      }
    }

    // Also alert for long stays (> 14 days without expected discharge)
    const admDate = adm.admission_date || adm.created_at
    if (admDate && !adm.expected_discharge) {
      const daysAdmitted = Math.round((now - new Date(admDate).getTime()) / (24 * 60 * 60 * 1000))
      if (daysAdmitted > 14) {
        alerts.push({
          id: `long-stay-${adm.admission_id}`,
          tenantId,
          type: "long_stay",
          priority: "medium",
          title: "Extended Stay — No Discharge Date",
          message: `${adm.patient_name} (${adm.ward} - ${adm.bed_number}) has been admitted for ${daysAdmitted} days with no expected discharge date set.`,
          channels: ["in_app"],
          recipientRole: "ADMIN",
          metadata: { admissionId: adm.admission_id, daysAdmitted },
        })
      }
    }
  }

  return alerts
}

/**
 * Find appointments with no-show patients who haven't been followed up.
 */
export async function checkNoShowFollowUps(tenantId: string): Promise<SmartAlert[]> {
  const supabase = createServerClient()
  const alerts: SmartAlert[] = []
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const { data: noShows } = await supabase
    .from("appointments")
    .select("booking_id, patient_name, patient_phone, doctor_name, date")
    .eq("tenant_id", tenantId)
    .eq("status", "no_show")
    .gte("date", yesterday)
    .lte("date", today)
    .limit(20)

  for (const appt of noShows || []) {
    alerts.push({
      id: `noshow-followup-${appt.booking_id}`,
      tenantId,
      type: "no_show_followup",
      priority: "low",
      title: "No-Show Follow-up",
      message: `${appt.patient_name} missed their appointment with Dr. ${appt.doctor_name} on ${appt.date}. Consider sending a rescheduling message.`,
      channels: ["in_app"],
      recipientPhone: appt.patient_phone,
      recipientRole: "RECEPTION",
      metadata: { bookingId: appt.booking_id, doctorName: appt.doctor_name },
    })
  }

  return alerts
}

/**
 * Run all smart alert checks for a tenant and return combined results.
 */
export async function runSmartAlerts(tenantId: string): Promise<SmartAlert[]> {
  try {
    const [labs, payments, discharges, noShows] = await Promise.all([
      checkOverdueLabResults(tenantId),
      checkOverduePayments(tenantId),
      checkPendingDischarges(tenantId),
      checkNoShowFollowUps(tenantId),
    ])

    const all = [...labs, ...payments, ...discharges, ...noShows]

    // Sort by priority
    const priorityOrder: Record<AlertPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    all.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    log.info({ tenantId, total: all.length, critical: labs.filter(a => a.priority === "critical").length }, "Smart alerts check completed")

    return all
  } catch (err) {
    log.error({ err, tenantId }, "Smart alerts check failed")
    return []
  }
}
