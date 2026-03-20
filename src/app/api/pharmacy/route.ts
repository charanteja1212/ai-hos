import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { pharmacyActionSchema } from "@/lib/validations/api-schemas"
import { createRouteLogger } from "@/lib/logger"
import { logAudit } from "@/lib/audit"
import { isRateLimited } from "@/lib/rate-limit"
import { requireFeature } from "@/lib/platform/check-feature"

const log = createRouteLogger("/api/pharmacy")

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const staffRoles = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN", "PHARMACIST", "DOCTOR", "RECEPTION"]
    if (!staffRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Subscription tier check
    const featureBlock = await requireFeature(user.clientId, "pharmacy_module")
    if (featureBlock) return featureBlock

    if (await isRateLimited(`pharmacy:${user.email}`, 60, 300000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await req.json()
    const validation = pharmacyActionSchema.safeParse(body)
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

    // ── Create Pharmacy Order ──
    if (data.action === "create-order") {
      const order_id = `PO_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      // Calculate total from medicine prices
      const medicineNames = data.items.map(i => i.medicine_name)
      const { data: medicines } = await supabase
        .from("medicines")
        .select("medicine_name, price")
        .in("medicine_name", medicineNames)
        .eq("tenant_id", tenant_id)

      const priceMap = new Map((medicines || []).map(m => [m.medicine_name, m.price || 0]))
      const totalAmount = data.items.reduce(
        (sum, item) => sum + (priceMap.get(item.medicine_name) || 0) * (item.quantity || 1),
        0
      )

      const { error } = await supabase.from("pharmacy_orders").insert({
        order_id,
        tenant_id,
        prescription_id: data.prescription_id || null,
        patient_phone: data.patient_phone || null,
        patient_name: data.patient_name || null,
        doctor_name: data.doctor_name || null,
        items: data.items,
        total_amount: totalAmount,
        status: "pending",
      })

      if (error) {
        log.error({ err: error }, "Pharmacy order insert failed")
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      logAudit({
        action: "create", entityType: "pharmacy_order", entityId: order_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { item_count: data.items.length, total: totalAmount },
      })

      return NextResponse.json({ success: true, order_id, total_amount: totalAmount })
    }

    // ── Update Pharmacy Order Status ──
    if (data.action === "update-status") {
      const { data: order, error: fetchErr } = await supabase
        .from("pharmacy_orders")
        .select("order_id, status, tenant_id, items")
        .eq("order_id", data.order_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (fetchErr || !order) {
        return NextResponse.json({ error: "Pharmacy order not found" }, { status: 404 })
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        pending: ["preparing"],
        preparing: ["ready"],
        ready: ["dispensed"],
      }
      if (!validTransitions[order.status]?.includes(data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from '${order.status}' to '${data.status}'` },
          { status: 400 }
        )
      }

      const updates: Record<string, unknown> = { status: data.status }
      if (data.status === "preparing") {
        updates.prepared_by = user.name || user.email || "staff"
      }
      if (data.status === "dispensed") {
        updates.dispensed_at = new Date().toISOString()

        // Auto-deduct stock for dispensed medicines (non-critical)
        const items = order.items as { medicine_name: string; quantity?: number }[]
        for (const item of items) {
          const qty = item.quantity || 1
          try {
            const { data: med } = await supabase
              .from("medicines")
              .select("stock")
              .eq("medicine_name", item.medicine_name)
              .eq("tenant_id", tenant_id)
              .single()
            if (med) {
              await supabase
                .from("medicines")
                .update({ stock: Math.max(0, (med.stock || 0) - qty) })
                .eq("medicine_name", item.medicine_name)
                .eq("tenant_id", tenant_id)
            }
          } catch {
            log.warn({ medicine: item.medicine_name, qty }, "Stock decrement failed")
          }
        }
      }

      const { error: updateErr } = await supabase
        .from("pharmacy_orders")
        .update(updates)
        .eq("order_id", data.order_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Pharmacy status update failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      logAudit({
        action: "status_change", entityType: "pharmacy_order", entityId: data.order_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { from: order.status, to: data.status },
      })

      return NextResponse.json({ success: true, status: data.status })
    }

    // ── Update Stock ──
    if (data.action === "update-stock") {
      const { error } = await supabase
        .from("medicines")
        .update({
          stock: data.stock,
          ...(data.price != null ? { price: data.price } : {}),
        })
        .eq("medicine_id", data.medicine_id)
        .eq("tenant_id", tenant_id)

      if (error) {
        log.error({ err: error }, "Stock update failed")
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      logAudit({
        action: "update", entityType: "medicine", entityId: data.medicine_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { stock: data.stock, price: data.price },
      })

      return NextResponse.json({ success: true })
    }

    // ── Manage Medicine ──
    if (data.action === "manage-medicine") {
      if (data.operation === "create") {
        const medicine_id = `MED_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

        const { error } = await supabase.from("medicines").insert({
          medicine_id,
          tenant_id,
          medicine_name: data.medicine_name,
          salt: data.salt || null,
          dosage: data.dosage || null,
          form: data.form || null,
          stock: data.stock,
          min_stock: data.min_stock,
          price: data.price,
          category: data.category || null,
          expiry_date: data.expiry_date || null,
          status: "active",
        })

        if (error) {
          log.error({ err: error }, "Medicine insert failed")
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, medicine_id })
      }

      if (data.operation === "update" && data.medicine_id) {
        const { error } = await supabase
          .from("medicines")
          .update({
            medicine_name: data.medicine_name,
            salt: data.salt || null,
            dosage: data.dosage || null,
            form: data.form || null,
            stock: data.stock,
            min_stock: data.min_stock,
            price: data.price,
            category: data.category || null,
            expiry_date: data.expiry_date || null,
          })
          .eq("medicine_id", data.medicine_id)
          .eq("tenant_id", tenant_id)

        if (error) {
          log.error({ err: error }, "Medicine update failed")
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, medicine_id: data.medicine_id })
      }

      return NextResponse.json({ error: "medicine_id required for update" }, { status: 400 })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    log.error({ err }, "Pharmacy API error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
