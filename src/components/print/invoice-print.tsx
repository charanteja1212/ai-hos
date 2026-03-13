"use client"

import { PS } from "./print-layout"
import type { Invoice } from "@/types/database"

interface InvoicePrintProps {
  invoice: Invoice
  hospitalName?: string
  hospitalAddress?: string
  hospitalPhone?: string
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

export function InvoicePrint({ invoice, hospitalName, hospitalAddress, hospitalPhone }: InvoicePrintProps) {
  const hasGST = (invoice.gst_percentage || 0) > 0
  const hasCGST = (invoice.cgst || 0) > 0
  const hasSGST = (invoice.sgst || 0) > 0
  const hasIGST = (invoice.igst || 0) > 0
  const hasDiscount = (invoice.discount || 0) > 0

  return (
    <div style={{ fontSize: 12 }}>
      {/* Hospital Header (only when used standalone without PrintLayout) */}
      {hospitalName && (
        <div style={{ textAlign: "center", marginBottom: 14, borderBottom: "2px solid #1e293b", paddingBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{hospitalName}</h2>
          {hospitalAddress && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#64748b" }}>{hospitalAddress}</p>}
          {hospitalPhone && <p style={{ margin: "1px 0 0", fontSize: 10, color: "#64748b" }}>Tel: {hospitalPhone}</p>}
          {invoice.gstin && <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 700, color: "#334155" }}>GSTIN: {invoice.gstin}</p>}
        </div>
      )}

      {/* Tax Invoice Title */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "#0f172a" }}>
          {hasGST ? "Tax Invoice" : "Invoice"}
        </h3>
      </div>

      {/* Invoice Meta */}
      <div style={PS.infoRow}>
        <div>
          <p style={PS.sectionLabel}>Billed To</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{invoice.patient_name || "—"}</p>
          <p style={PS.muted}>{invoice.patient_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={PS.sectionLabel}>Invoice Details</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>{invoice.invoice_id}</p>
          <p style={PS.muted}>Date: {invoice.created_at ? formatDate(invoice.created_at) : "—"}</p>
          <p style={PS.muted}>Type: {TYPE_LABELS[invoice.type] || invoice.type}</p>
        </div>
      </div>

      {/* Line Items */}
      <table style={{ ...PS.table, marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ ...PS.th, width: 32, textAlign: "center" }}>#</th>
            <th style={PS.th}>Description</th>
            {invoice.hsn_code && <th style={{ ...PS.th, textAlign: "center", width: 70 }}>HSN/SAC</th>}
            <th style={{ ...PS.th, textAlign: "center", width: 40 }}>Qty</th>
            <th style={{ ...PS.th, textAlign: "right", width: 80 }}>Rate</th>
            <th style={{ ...PS.th, textAlign: "right", width: 90 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items || []).map((item, i) => (
            <tr key={i}>
              <td style={{ ...PS.td, textAlign: "center", color: "#94a3b8", fontSize: 10 }}>{i + 1}</td>
              <td style={{ ...PS.td, fontWeight: 500 }}>{item.description}</td>
              {invoice.hsn_code && <td style={{ ...PS.td, textAlign: "center", fontSize: 10, color: "#64748b" }}>{invoice.hsn_code}</td>}
              <td style={{ ...PS.td, textAlign: "center" }}>{item.quantity}</td>
              <td style={{ ...PS.td, textAlign: "right" }}>{formatCurrency(item.amount)}</td>
              <td style={{ ...PS.td, textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.amount * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 300, border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", fontSize: 11, borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ color: "#64748b" }}>Subtotal</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(invoice.subtotal)}</span>
          </div>

          {hasDiscount && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", fontSize: 11, borderBottom: "1px solid #e2e8f0", color: "#16a34a" }}>
                <span>
                  Discount{invoice.discount_type === "percent" && invoice.discount_value ? ` (${invoice.discount_value}%)` : ""}
                </span>
                <span style={{ fontWeight: 600 }}>- {formatCurrency(invoice.discount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", fontSize: 11, borderBottom: "1px dashed #e2e8f0" }}>
                <span style={{ color: "#64748b" }}>Taxable Amount</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(invoice.subtotal - invoice.discount)}</span>
              </div>
            </>
          )}

          {hasCGST && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 14px", fontSize: 11, borderBottom: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b" }}>CGST ({((invoice.gst_percentage || 0) / 2).toFixed(1)}%)</span>
              <span>{formatCurrency(invoice.cgst || 0)}</span>
            </div>
          )}
          {hasSGST && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 14px", fontSize: 11, borderBottom: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b" }}>SGST ({((invoice.gst_percentage || 0) / 2).toFixed(1)}%)</span>
              <span>{formatCurrency(invoice.sgst || 0)}</span>
            </div>
          )}
          {hasIGST && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 14px", fontSize: 11, borderBottom: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b" }}>IGST ({(invoice.gst_percentage || 0).toFixed(1)}%)</span>
              <span>{formatCurrency(invoice.igst || 0)}</span>
            </div>
          )}
          {invoice.tax > 0 && !hasGST && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 14px", fontSize: 11, borderBottom: "1px solid #e2e8f0" }}>
              <span style={{ color: "#64748b" }}>Tax</span>
              <span>{formatCurrency(invoice.tax)}</span>
            </div>
          )}

          <div style={{
            display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: 14, fontWeight: 800,
            backgroundColor: "#f1f5f9", color: "#0f172a",
            WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
          }}>
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment Status */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11 }}>
        <span>
          Payment Status:{" "}
          <strong style={{
            textTransform: "uppercase",
            color: invoice.payment_status === "paid" ? "#16a34a" : invoice.payment_status === "partial" ? "#d97706" : "#dc2626",
          }}>
            {invoice.payment_status}
          </strong>
        </span>
        {invoice.payment_method && <span style={{ color: "#64748b" }}>Method: {invoice.payment_method}</span>}
      </div>

      {/* Reference IDs */}
      <div style={{ marginTop: 8, fontSize: 10, color: "#94a3b8" }}>
        {invoice.booking_id && <p style={{ margin: "2px 0" }}>Booking Ref: {invoice.booking_id}</p>}
        {invoice.admission_id && <p style={{ margin: "2px 0" }}>Admission Ref: {invoice.admission_id}</p>}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, textAlign: "center", fontSize: 9, color: "#94a3b8", borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
        <p style={{ margin: 0 }}>This is a computer-generated invoice and does not require a signature.</p>
        {invoice.gstin && <p style={{ margin: "2px 0 0" }}>GSTIN: {invoice.gstin}</p>}
      </div>
    </div>
  )
}
