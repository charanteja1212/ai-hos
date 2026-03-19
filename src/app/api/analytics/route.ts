import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { SessionUser } from "@/types/auth"
import { createServerClient } from "@/lib/supabase/server"
import { analyticsQuerySchema } from "@/lib/validations/api-schemas"
import { createRouteLogger } from "@/lib/logger"
import { isRateLimited } from "@/lib/rate-limit"

const log = createRouteLogger("/api/analytics")

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin roles can access analytics
    const adminRoles = ["SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN"]
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (await isRateLimited(`analytics:${user.email}`, 30, 300000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const body = await req.json()
    const validation = analyticsQuerySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data
    const tenant_id = data.tenant_id
      ? (user.role === "SUPER_ADMIN" || user.role === "CLIENT_ADMIN" ? data.tenant_id : user.tenantId)
      : user.tenantId

    const supabase = createServerClient()
    const today = new Date().toISOString().split("T")[0]
    const fromDate = data.from_date || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
    const toDate = data.to_date || today

    // ── Dashboard Summary ──
    if (data.metric === "dashboard-summary") {
      const [appointmentsRes, invoicesRes, patientsRes, admissionsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("booking_id, status, date", { count: "exact" })
          .eq("tenant_id", tenant_id)
          .gte("date", fromDate)
          .lte("date", toDate),
        supabase
          .from("invoices")
          .select("invoice_id, total, payment_status, type")
          .eq("tenant_id", tenant_id)
          .gte("created_at", fromDate + "T00:00:00")
          .lte("created_at", toDate + "T23:59:59"),
        supabase
          .from("patients")
          .select("phone", { count: "exact" })
          .eq("tenant_id", tenant_id),
        supabase
          .from("admissions")
          .select("admission_id, status")
          .eq("tenant_id", tenant_id)
          .eq("status", "admitted"),
      ])

      const appointments = appointmentsRes.data || []
      const invoices = invoicesRes.data || []
      const totalRevenue = invoices
        .filter(i => i.payment_status === "paid")
        .reduce((sum, i) => sum + (i.total || 0), 0)

      return NextResponse.json({
        success: true,
        data: {
          total_appointments: appointmentsRes.count || appointments.length,
          confirmed_appointments: appointments.filter(a => a.status === "confirmed").length,
          cancelled_appointments: appointments.filter(a => a.status === "cancelled").length,
          total_revenue: totalRevenue,
          total_invoices: invoices.length,
          paid_invoices: invoices.filter(i => i.payment_status === "paid").length,
          unpaid_invoices: invoices.filter(i => i.payment_status === "unpaid").length,
          total_patients: patientsRes.count || 0,
          current_admissions: (admissionsRes.data || []).length,
          period: { from: fromDate, to: toDate },
        },
      })
    }

    // ── Revenue by Type ──
    if (data.metric === "revenue-by-type") {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("type, total, payment_status")
        .eq("tenant_id", tenant_id)
        .eq("payment_status", "paid")
        .gte("created_at", fromDate + "T00:00:00")
        .lte("created_at", toDate + "T23:59:59")

      const byType: Record<string, { count: number; total: number }> = {}
      for (const inv of invoices || []) {
        const t = inv.type || "other"
        if (!byType[t]) byType[t] = { count: 0, total: 0 }
        byType[t].count++
        byType[t].total += inv.total || 0
      }

      return NextResponse.json({
        success: true,
        data: {
          breakdown: byType,
          grand_total: Object.values(byType).reduce((s, v) => s + v.total, 0),
          period: { from: fromDate, to: toDate },
        },
      })
    }

    // ── Revenue by Doctor ──
    if (data.metric === "revenue-by-doctor") {
      const { data: appointments } = await supabase
        .from("appointments")
        .select("doctor_name, doctor_id, booking_id")
        .eq("tenant_id", tenant_id)
        .eq("status", "confirmed")
        .gte("date", fromDate)
        .lte("date", toDate)

      const { data: invoices } = await supabase
        .from("invoices")
        .select("booking_id, total, payment_status")
        .eq("tenant_id", tenant_id)
        .eq("payment_status", "paid")
        .eq("type", "consultation")
        .gte("created_at", fromDate + "T00:00:00")
        .lte("created_at", toDate + "T23:59:59")

      const invoiceMap = new Map((invoices || []).map(i => [i.booking_id, i.total || 0]))

      const byDoctor: Record<string, { doctor_name: string; appointments: number; revenue: number }> = {}
      for (const appt of appointments || []) {
        const key = appt.doctor_id || appt.doctor_name || "Unknown"
        if (!byDoctor[key]) {
          byDoctor[key] = { doctor_name: appt.doctor_name || "Unknown", appointments: 0, revenue: 0 }
        }
        byDoctor[key].appointments++
        byDoctor[key].revenue += invoiceMap.get(appt.booking_id) || 0
      }

      return NextResponse.json({
        success: true,
        data: {
          doctors: Object.values(byDoctor).sort((a, b) => b.revenue - a.revenue),
          period: { from: fromDate, to: toDate },
        },
      })
    }

    // ── Appointment Stats ──
    if (data.metric === "appointment-stats") {
      const { data: appointments } = await supabase
        .from("appointments")
        .select("date, status, source")
        .eq("tenant_id", tenant_id)
        .gte("date", fromDate)
        .lte("date", toDate)

      const byDate: Record<string, { confirmed: number; cancelled: number; total: number }> = {}
      const bySource: Record<string, number> = {}

      for (const a of appointments || []) {
        if (!byDate[a.date]) byDate[a.date] = { confirmed: 0, cancelled: 0, total: 0 }
        byDate[a.date].total++
        if (a.status === "confirmed") byDate[a.date].confirmed++
        if (a.status === "cancelled") byDate[a.date].cancelled++

        const src = a.source || "unknown"
        bySource[src] = (bySource[src] || 0) + 1
      }

      return NextResponse.json({
        success: true,
        data: {
          daily: byDate,
          by_source: bySource,
          total: (appointments || []).length,
          period: { from: fromDate, to: toDate },
        },
      })
    }

    // ── Patient Demographics ──
    if (data.metric === "patient-demographics") {
      const { data: patients, count } = await supabase
        .from("patients")
        .select("gender, age, created_at", { count: "exact" })
        .eq("tenant_id", tenant_id)

      const byGender: Record<string, number> = {}
      const byAgeGroup: Record<string, number> = {
        "0-18": 0, "19-30": 0, "31-45": 0, "46-60": 0, "61+": 0, "unknown": 0,
      }

      for (const p of patients || []) {
        const g = p.gender || "unknown"
        byGender[g] = (byGender[g] || 0) + 1

        const age = p.age
        if (age == null) byAgeGroup["unknown"]++
        else if (age <= 18) byAgeGroup["0-18"]++
        else if (age <= 30) byAgeGroup["19-30"]++
        else if (age <= 45) byAgeGroup["31-45"]++
        else if (age <= 60) byAgeGroup["46-60"]++
        else byAgeGroup["61+"]++
      }

      return NextResponse.json({
        success: true,
        data: {
          total_patients: count || 0,
          by_gender: byGender,
          by_age_group: byAgeGroup,
        },
      })
    }

    return NextResponse.json({ error: "Invalid metric" }, { status: 400 })
  } catch (err) {
    log.error({ err }, "Analytics API error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
