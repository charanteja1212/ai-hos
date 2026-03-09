"use client"

import type { Invoice } from "@/types/database"

interface InvoicePrintProps {
  invoice: Invoice
}

function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation",
  pharmacy: "Pharmacy",
  lab: "Laboratory",
  admission: "Admission",
  procedure: "Procedure",
}

export function InvoicePrint({ invoice }: InvoicePrintProps) {
  return (
    <div style={{ fontSize: 12 }}>
      {/* Invoice meta */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>{invoice.patient_name || "—"}</p>
          <p style={{ margin: "2px 0 0", color: "#555", fontSize: 11 }}>{invoice.patient_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#555" }}>Invoice: <strong>{invoice.invoice_id}</strong></p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>
            Date: {invoice.created_at ? formatDate(invoice.created_at) : "—"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>
            Type: {TYPE_LABELS[invoice.type] || invoice.type}
          </p>
        </div>
      </div>

      {/* Line items */}
      <table className="print-table" style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>S.No</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Description</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "center" }}>Qty</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items || []).map((item, i) => (
            <tr key={i}>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11 }}>{i + 1}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11 }}>{item.description}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center" }}>{item.quantity}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "right" }}>{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11 }}>
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.tax > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11 }}>
              <span>Tax</span>
              <span>{formatCurrency(invoice.tax)}</span>
            </div>
          )}
          {invoice.discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 11 }}>
              <span>Discount</span>
              <span>- {formatCurrency(invoice.discount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, fontWeight: 700, borderTop: "2px solid #333", marginTop: 4 }}>
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment status */}
      <div style={{ marginTop: 16, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4, fontSize: 11, display: "flex", justifyContent: "space-between" }}>
        <span>Payment Status: <strong style={{ textTransform: "uppercase" }}>{invoice.payment_status}</strong></span>
        {invoice.payment_method && <span>Method: {invoice.payment_method}</span>}
      </div>

      {invoice.booking_id && (
        <p style={{ marginTop: 8, fontSize: 10, color: "#777" }}>Ref: {invoice.booking_id}</p>
      )}
      {invoice.admission_id && (
        <p style={{ marginTop: 4, fontSize: 10, color: "#777" }}>Admission: {invoice.admission_id}</p>
      )}
    </div>
  )
}
