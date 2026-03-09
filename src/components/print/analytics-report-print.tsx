"use client"

import type { Invoice } from "@/types/database"

interface AnalyticsReportPrintProps {
  invoices: Invoice[]
  fromDate: string
  toDate: string
}

function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  // Revenue by type
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

  return (
    <div style={{ fontSize: 12 }}>
      {/* Period */}
      <p style={{ margin: "0 0 16px", fontSize: 11, color: "#555" }}>
        Period: <strong>{fromDate}</strong> to <strong>{toDate}</strong> &nbsp;|&nbsp; Total Invoices: <strong>{invoices.length}</strong>
      </p>

      {/* Summary */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 4, padding: 12, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#777", textTransform: "uppercase" }}>Total Revenue (Paid)</p>
          <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>{formatCurrency(totalRevenue)}</p>
        </div>
        <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 4, padding: 12, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#777", textTransform: "uppercase" }}>Outstanding</p>
          <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>{formatCurrency(unpaidTotal)}</p>
        </div>
        <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 4, padding: 12, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#777", textTransform: "uppercase" }}>Avg Invoice Value</p>
          <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>
            {paid.length > 0 ? formatCurrency(totalRevenue / paid.length) : "—"}
          </p>
        </div>
      </div>

      {/* Revenue by Type */}
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Revenue by Department</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Department</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "center" }}>Invoices</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "center" }}>Paid</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "right" }}>Revenue</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "right" }}>Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {typeBreakdown.map(t => (
            <tr key={t.type}>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11 }}>{t.label}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center" }}>{t.count}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center" }}>{t.paidCount}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "right" }}>{formatCurrency(t.revenue)}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "right" }}>{formatCurrency(t.outstanding)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 700 }}>Total</td>
            <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 700, textAlign: "center" }}>{invoices.length}</td>
            <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 700, textAlign: "center" }}>{paid.length}</td>
            <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 700, textAlign: "right" }}>{formatCurrency(totalRevenue)}</td>
            <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 700, textAlign: "right" }}>{formatCurrency(unpaidTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Payment Status Breakdown */}
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>Payment Status Breakdown</h3>
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        {[
          { label: "Paid", count: invoices.filter(i => i.payment_status === "paid").length },
          { label: "Unpaid", count: invoices.filter(i => i.payment_status === "unpaid").length },
          { label: "Partial", count: invoices.filter(i => i.payment_status === "partial").length },
        ].map(s => (
          <div key={s.label} style={{ border: "1px solid #ddd", borderRadius: 4, padding: "8px 16px", fontSize: 11 }}>
            <span style={{ color: "#777" }}>{s.label}: </span>
            <strong>{s.count}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
