import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { ipdActionSchema } from "@/lib/validations/api-schemas"
import { createRouteLogger } from "@/lib/logger"
import { logAudit } from "@/lib/audit"
import { isRateLimited } from "@/lib/rate-limit"
import { requireFeature } from "@/lib/platform/check-feature"

const log = createRouteLogger("/api/ipd")

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const staffRoles = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN", "RECEPTION", "DOCTOR"]
    if (!staffRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Subscription tier check — IPD requires Enterprise
    const featureBlock = await requireFeature(user.clientId, "ipd_module")
    if (featureBlock) return featureBlock

    if (await isRateLimited(`ipd:${user.email}`, 60, 300000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await req.json()
    const validation = ipdActionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data
    const tenant_id = ("tenant_id" in data && data.tenant_id)
      ? (user.role === "SUPER_ADMIN" || user.role === "CLIENT_ADMIN" ? data.tenant_id : user.tenantId)
      : user.tenantId

    const supabase = createServerClient()

    // ── Admit Patient ──
    if (data.action === "admit") {
      const admission_id = `ADM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      const { error } = await supabase.from("admissions").insert({
        admission_id,
        tenant_id,
        patient_phone: data.patient_phone,
        patient_name: data.patient_name,
        doctor_id: data.doctor_id || null,
        doctor_name: data.doctor_name || null,
        ward: data.ward,
        bed_number: data.bed_number,
        diagnosis: data.diagnosis || null,
        admission_date: new Date().toISOString().split("T")[0],
        expected_discharge: data.expected_discharge || null,
        from_appointment: data.from_appointment || null,
        status: "admitted",
        transfer_history: [],
        nursing_notes: [],
        daily_charges: [],
      })

      if (error) {
        log.error({ err: error }, "Admission insert failed")
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      logAudit({
        action: "create", entityType: "admission", entityId: admission_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { patient_name: data.patient_name, ward: data.ward, bed: data.bed_number },
      })

      return NextResponse.json({ success: true, admission_id })
    }

    // ── Transfer Patient ──
    if (data.action === "transfer") {
      const { data: admission, error: fetchErr } = await supabase
        .from("admissions")
        .select("admission_id, ward, bed_number, transfer_history, tenant_id")
        .eq("admission_id", data.admission_id)
        .eq("tenant_id", tenant_id)
        .eq("status", "admitted")
        .single()

      if (fetchErr || !admission) {
        return NextResponse.json({ error: "Admission not found or already discharged" }, { status: 404 })
      }

      const transferRecord = {
        id: `TR_${Date.now()}`,
        from_ward: admission.ward,
        from_bed: admission.bed_number,
        to_ward: data.to_ward,
        to_bed: data.to_bed,
        transferred_at: new Date().toISOString(),
        transferred_by: user.name || user.email || "staff",
        reason: data.reason || "Transfer requested",
      }

      const history = [...(admission.transfer_history || []), transferRecord]

      const { error: updateErr } = await supabase
        .from("admissions")
        .update({
          ward: data.to_ward,
          bed_number: data.to_bed,
          transfer_history: history,
        })
        .eq("admission_id", data.admission_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Transfer update failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      logAudit({
        action: "update", entityType: "admission", entityId: data.admission_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { type: "transfer", from: `${admission.ward}/${admission.bed_number}`, to: `${data.to_ward}/${data.to_bed}` },
      })

      return NextResponse.json({ success: true, transfer: transferRecord })
    }

    // ── Discharge Patient ──
    if (data.action === "discharge") {
      const { data: admission, error: fetchErr } = await supabase
        .from("admissions")
        .select("admission_id, tenant_id, status")
        .eq("admission_id", data.admission_id)
        .eq("tenant_id", tenant_id)
        .eq("status", "admitted")
        .single()

      if (fetchErr || !admission) {
        return NextResponse.json({ error: "Admission not found or already discharged" }, { status: 404 })
      }

      const dischargeSummary = {
        final_diagnosis: data.final_diagnosis,
        treatment_given: data.treatment_given,
        medications_on_discharge: data.medications_on_discharge || [],
        follow_up_instructions: data.follow_up_instructions || "",
        follow_up_date: data.follow_up_date || null,
        discharged_by: user.name || user.email || "staff",
      }

      const { error: updateErr } = await supabase
        .from("admissions")
        .update({
          status: "discharged",
          actual_discharge: new Date().toISOString().split("T")[0],
          discharge_summary: dischargeSummary,
        })
        .eq("admission_id", data.admission_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Discharge update failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      logAudit({
        action: "status_change", entityType: "admission", entityId: data.admission_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { status: "discharged", final_diagnosis: data.final_diagnosis },
      })

      return NextResponse.json({ success: true, discharged: true })
    }

    // ── Add Nursing Note ──
    if (data.action === "add-nursing-note") {
      const { data: admission, error: fetchErr } = await supabase
        .from("admissions")
        .select("admission_id, nursing_notes, tenant_id")
        .eq("admission_id", data.admission_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (fetchErr || !admission) {
        return NextResponse.json({ error: "Admission not found" }, { status: 404 })
      }

      const nursingNote = {
        id: `NN_${Date.now()}`,
        timestamp: new Date().toISOString(),
        author: user.name || user.email || "staff",
        type: data.type,
        note: data.note,
        vitals: data.vitals || undefined,
        observations: data.observations || undefined,
        medications_given: data.medications_given || undefined,
      }

      const notes = [...(admission.nursing_notes || []), nursingNote]

      const { error: updateErr } = await supabase
        .from("admissions")
        .update({ nursing_notes: notes })
        .eq("admission_id", data.admission_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Nursing note update failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, note_id: nursingNote.id })
    }

    // ── Add Daily Charge ──
    if (data.action === "add-daily-charge") {
      const { data: admission, error: fetchErr } = await supabase
        .from("admissions")
        .select("admission_id, daily_charges, tenant_id")
        .eq("admission_id", data.admission_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (fetchErr || !admission) {
        return NextResponse.json({ error: "Admission not found" }, { status: 404 })
      }

      const charge = {
        date: data.date || new Date().toISOString().split("T")[0],
        description: data.description,
        amount: data.amount,
        category: data.category,
      }

      const charges = [...(admission.daily_charges || []), charge]

      const { error: updateErr } = await supabase
        .from("admissions")
        .update({ daily_charges: charges })
        .eq("admission_id", data.admission_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Daily charge update failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, charge })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    log.error({ err }, "IPD API error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
