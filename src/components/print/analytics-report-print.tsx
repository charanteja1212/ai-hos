"use client"

import { PS } from "./print-layout"
import type { Invoice } from "@/types/database"

interface AnalyticsReportPrintProps {
  invoices: Invoice[]
  fromDate: string
  toDate: string
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation",
  pharmacy: "Pharmacy",
  lab: "Laboratory",
  admission: "Admission",
  procedure: "Procedure",
}

export function AnalyticsReportPrint({ invoices, fromDate, toDate }: AnalyticsReportPrintProps) {
  const paid = invoices.filter(i => i.payment_status === "paid")
  const totalRevenue = paid.reduce((s, i) => s + (i.total || 0), 0)
  const unpaidTotal = invoices.filter(i => i.payment_status !== "paid").reduce((s, i) => s + (i.total || 0), 0)

  const types = ["consultation", "pharmacy", "lab", "admission", "procedure"] as const
  const typeBreakdown = types.map(type => {
    const typeInvoices = invoices.filter(i => i.type === type)
    const paidInvoices = typeInvoices.filter(i => i.payment_status === "paid")
    return {
      type,
      label: TYPE_LABELS[type],
      count: typeInvoices.length,
      paidCount: paidInvoices.length,
      revenue: paidInvoices.reduce((s, i) => s + (i.total || 0), 0),
      outstanding: typeInvoices.filter(i => i.payment_status !== "paid").reduce((s, i) => s + (i.total || 0), 0),
    }
  }).filter(t => t.count > 0)

  const paidCount = invoices.filter(i => i.payment_status === "paid").length
  const unpaidCount = invoices.filter(i => i.payment_status === "unpaid").length
  const partialCount = invoices.filter(i => i.payment_status === "partial").length

  return (
    <div style={{ fontSize: 12 }}>
      {/* Period Info */}
      <div style={PS.infoRow}>
        <div>
          <p style={PS.sectionLabel}>Report Period</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
            {fromDate} — {toDate}
          </p>
          <p style={PS.muted}>Total Invoices: {invoices.length}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={PS.sectionLabel}>Generated</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
            {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden",
        WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
      }}>
        {[
          { label: "Total Revenue (Paid)", value: formatCurrency(totalRevenue), bg: "#f0fdf4" },
          { label: "Outstanding", value: formatCurrency(unpaidTotal), bg: "#fef2f2" },
          { label: "Avg Invoice Value", value: paid.length > 0 ? formatCurrency(totalRevenue / paid.length) : "—", bg: "#eff6ff" },
          { label: "Collection Rate", value: invoices.length > 0 ? `${Math.round((paidCount / invoices.length) * 100)}%` : "—", bg: "#f8fafc" },
        ].map((kpi, i) => (
          <div key={i} style={{
            flex: 1, padding: "10px 14px", textAlign: "center",
            borderRight: i < 3 ? "1px solid #e2e8f0" : undefined,
            backgroundColor: kpi.bg,
          }}>
            <p style={{ margin: 0, fontSize: 8, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by Department */}
      <h3 style={PS.sectionHeading}>Revenue by Department</h3>
      <table style={{ ...PS.table, marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={PS.th}>Department</th>
            <th style={{ ...PS.th, textAlign: "center", width: 70 }}>Invoices</th>
            <th style={{ ...PS.th, textAlign: "center", width: 70 }}>Paid</th>
            <th style={{ ...PS.th, textAlign: "right", width: 110 }}>Revenue</th>
            <th style={{ ...PS.th, textAlign: "right", width: 110 }}>Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {typeBreakdown.map(t => (
            <tr key={t.type}>
              <td style={{ ...PS.td, fontWeight: 600 }}>{t.label}</td>
              <td style={{ ...PS.td, textAlign: "center" }}>{t.count}</td>
              <td style={{ ...PS.td, textAlign: "center" }}>{t.paidCount}</td>
              <td style={{ ...PS.td, textAlign: "right", fontWeight: 600 }}>{formatCurrency(t.revenue)}</td>
              <td style={{ ...PS.td, textAlign: "right", color: t.outstanding > 0 ? "#dc2626" : "#64748b" }}>{formatCurrency(t.outstanding)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...PS.td, fontWeight: 700, backgroundColor: "#f1f5f9", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>Total</td>
            <td style={{ ...PS.td, fontWeight: 700, textAlign: "center", backgroundColor: "#f1f5f9", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{invoices.length}</td>
            <td style={{ ...PS.td, fontWeight: 700, textAlign: "center", backgroundColor: "#f1f5f9", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{paid.length}</td>
            <td style={{ ...PS.td, fontWeight: 700, textAlign: "right", fontSize: 13, backgroundColor: "#f1f5f9", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{formatCurrency(totalRevenue)}</td>
            <td style={{ ...PS.td, fontWeight: 700, textAlign: "right", fontSize: 13, backgroundColor: "#f1f5f9", color: "#dc2626", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{formatCurrency(unpaidTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Payment Status */}
      <h3 style={PS.sectionHeading}>Payment Status Breakdown</h3>
      <div style={{
        display: "flex", gap: 0, marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden",
        WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
      }}>
        {[
          { label: "Paid", count: paidCount, color: "#16a34a", bg: "#f0fdf4" },
          { label: "Unpaid", count: unpaidCount, color: "#dc2626", bg: "#fef2f2" },
          { label: "Partial", count: partialCount, color: "#d97706", bg: "#fffbeb" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: "8px 16px", textAlign: "center",
            borderRight: i < 2 ? "1px solid #e2e8f0" : undefined,
            backgroundColor: s.bg,
          }}>
            <p style={{ margin: 0, fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>{s.label}</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, textAlign: "center", fontSize: 9, color: "#94a3b8", borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
        <p style={{ margin: 0 }}>This is a computer-generated financial report and does not require a signature.</p>
      </div>
    </div>
  )
}
