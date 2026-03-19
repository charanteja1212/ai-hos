import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { labActionSchema } from "@/lib/validations/api-schemas"
import { createRouteLogger } from "@/lib/logger"
import { logAudit } from "@/lib/audit"
import { isRateLimited } from "@/lib/rate-limit"

const log = createRouteLogger("/api/lab")

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const staffRoles = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN", "DOCTOR", "LAB_TECH", "RECEPTION"]
    if (!staffRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (await isRateLimited(`lab:${user.email}`, 60, 300000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await req.json()
    const validation = labActionSchema.safeParse(body)
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

    // ── Create Lab Order ──
    if (data.action === "create-order") {
      const order_id = `LAB_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      // Fetch test prices for total amount
      const testIds = data.tests.map(t => t.test_id)
      const { data: testMasters } = await supabase
        .from("lab_tests")
        .select("test_id, price")
        .in("test_id", testIds)
        .eq("tenant_id", tenant_id)

      const priceMap = new Map((testMasters || []).map(t => [t.test_id, t.price || 0]))
      const totalAmount = data.tests.reduce((sum, t) => sum + (priceMap.get(t.test_id) || 0), 0)

      const tests = data.tests.map(t => ({
        test_id: t.test_id,
        test_name: t.test_name,
        status: "ordered",
      }))

      const { error } = await supabase.from("lab_orders").insert({
        order_id,
        tenant_id,
        patient_phone: data.patient_phone,
        patient_name: data.patient_name,
        doctor_id: data.doctor_id || null,
        doctor_name: data.doctor_name || null,
        booking_id: data.booking_id || null,
        tests,
        status: "ordered",
        results: {},
        notes: data.notes || null,
        total_amount: totalAmount,
      })

      if (error) {
        log.error({ err: error }, "Lab order insert failed")
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      logAudit({
        action: "create", entityType: "lab_order", entityId: order_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { patient: data.patient_name, test_count: data.tests.length, total: totalAmount },
      })

      return NextResponse.json({ success: true, order_id, total_amount: totalAmount })
    }

    // ── Update Lab Status ──
    if (data.action === "update-status") {
      const { data: order, error: fetchErr } = await supabase
        .from("lab_orders")
        .select("order_id, status, tenant_id, patient_phone, patient_name, doctor_name")
        .eq("order_id", data.order_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (fetchErr || !order) {
        return NextResponse.json({ error: "Lab order not found" }, { status: 404 })
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        ordered: ["sample_collected"],
        sample_collected: ["processing"],
        processing: ["completed"],
      }
      if (!validTransitions[order.status]?.includes(data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from '${order.status}' to '${data.status}'` },
          { status: 400 }
        )
      }

      const updates: Record<string, unknown> = { status: data.status }
      if (data.status === "sample_collected") {
        updates.sample_collected_at = new Date().toISOString()
      }
      if (data.status === "completed") {
        updates.results_uploaded_at = new Date().toISOString()
      }

      const { error: updateErr } = await supabase
        .from("lab_orders")
        .update(updates)
        .eq("order_id", data.order_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Lab status update failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      logAudit({
        action: "status_change", entityType: "lab_order", entityId: data.order_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { from: order.status, to: data.status },
      })

      return NextResponse.json({ success: true, status: data.status })
    }

    // ── Upload Lab Results ──
    if (data.action === "upload-results") {
      const { data: order, error: fetchErr } = await supabase
        .from("lab_orders")
        .select("order_id, status, tenant_id")
        .eq("order_id", data.order_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (fetchErr || !order) {
        return NextResponse.json({ error: "Lab order not found" }, { status: 404 })
      }

      const { error: updateErr } = await supabase
        .from("lab_orders")
        .update({
          results: data.results,
          notes: data.notes || null,
          results_uploaded_at: new Date().toISOString(),
          status: "completed",
        })
        .eq("order_id", data.order_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Lab results upload failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      logAudit({
        action: "update", entityType: "lab_order", entityId: data.order_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { results_uploaded: true },
      })

      return NextResponse.json({ success: true, results_uploaded: true })
    }

    // ── Manage Test Master ──
    if (data.action === "manage-test") {
      if (data.operation === "create") {
        const test_id = `TEST_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

        const { error } = await supabase.from("lab_tests").insert({
          test_id,
          tenant_id,
          test_name: data.test_name,
          category: data.category || null,
          price: data.price,
          normal_range: data.normal_range || null,
          unit: data.unit || null,
          sample_type: data.sample_type || null,
          turnaround_hours: data.turnaround_hours ?? null,
          status: "active",
        })

        if (error) {
          log.error({ err: error }, "Lab test insert failed")
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, test_id })
      }

      if (data.operation === "update" && data.test_id) {
        const { error } = await supabase
          .from("lab_tests")
          .update({
            test_name: data.test_name,
            category: data.category || null,
            price: data.price,
            normal_range: data.normal_range || null,
            unit: data.unit || null,
            sample_type: data.sample_type || null,
            turnaround_hours: data.turnaround_hours ?? null,
          })
          .eq("test_id", data.test_id)
          .eq("tenant_id", tenant_id)

        if (error) {
          log.error({ err: error }, "Lab test update failed")
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, test_id: data.test_id })
      }

      return NextResponse.json({ error: "test_id required for update" }, { status: 400 })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    log.error({ err }, "Lab API error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
