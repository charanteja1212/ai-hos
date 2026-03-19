import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { billingActionSchema } from "@/lib/validations/api-schemas"
import { createRouteLogger } from "@/lib/logger"
import { logAudit } from "@/lib/audit"
import { isRateLimited } from "@/lib/rate-limit"
import { calculateInvoiceTotals, type TenantTaxConfig } from "@/lib/billing/tax"

const log = createRouteLogger("/api/billing")

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

    if (await isRateLimited(`billing:${user.email}`, 60, 300000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await req.json()
    const validation = billingActionSchema.safeParse(body)
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

    // ── Generate Invoice ──
    if (data.action === "generate-invoice") {
      const invoice_id = `INV_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      // Fetch tenant tax config
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("enable_gst, gst_percentage, gstin, hsn_code, state_code")
        .eq("tenant_id", tenant_id)
        .single()

      const taxConfig: TenantTaxConfig = {
        enable_gst: tenantRow?.enable_gst || false,
        gst_percentage: tenantRow?.gst_percentage || 18,
        gstin: tenantRow?.gstin || "",
        hsn_code: tenantRow?.hsn_code || "",
        state_code: tenantRow?.state_code || "",
      }

      const totals = calculateInvoiceTotals(
        data.items,
        taxConfig,
        data.discount_type && data.discount_value != null
          ? { type: data.discount_type, value: data.discount_value }
          : undefined
      )

      const invoiceData = {
        invoice_id,
        tenant_id,
        patient_phone: data.patient_phone,
        patient_name: data.patient_name,
        type: data.type,
        items: data.items,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        gst_percentage: taxConfig.enable_gst ? taxConfig.gst_percentage : null,
        gstin: taxConfig.gstin || null,
        hsn_code: taxConfig.hsn_code || null,
        discount_type: data.discount_type || null,
        discount_value: data.discount_value ?? null,
        payment_status: "unpaid",
        booking_id: data.booking_id || null,
        admission_id: data.admission_id || null,
      }

      const { error } = await supabase.from("invoices").insert(invoiceData)

      if (error) {
        log.error({ err: error }, "Invoice insert failed")
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      logAudit({
        action: "create", entityType: "invoice", entityId: invoice_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { type: data.type, total: totals.total, patient: data.patient_name },
      })

      return NextResponse.json({ success: true, invoice_id, totals })
    }

    // ── Update Payment Status ──
    if (data.action === "update-payment") {
      const { data: invoice, error: fetchErr } = await supabase
        .from("invoices")
        .select("invoice_id, payment_status, tenant_id")
        .eq("invoice_id", data.invoice_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (fetchErr || !invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
      }

      const { error: updateErr } = await supabase
        .from("invoices")
        .update({
          payment_status: data.payment_status,
          payment_method: data.payment_method || null,
        })
        .eq("invoice_id", data.invoice_id)

      if (updateErr) {
        log.error({ err: updateErr }, "Invoice payment update failed")
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      logAudit({
        action: "status_change", entityType: "invoice", entityId: data.invoice_id,
        actorEmail: user.email || "staff", actorRole: user.role, tenantId: tenant_id,
        details: { from: invoice.payment_status, to: data.payment_status, payment_method: data.payment_method },
      })

      return NextResponse.json({ success: true, payment_status: data.payment_status })
    }

    // ── Get Invoice ──
    if (data.action === "get-invoice") {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("invoice_id", data.invoice_id)
        .eq("tenant_id", tenant_id)
        .single()

      if (error || !invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
      }

      return NextResponse.json({ success: true, invoice })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    log.error({ err }, "Billing API error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
