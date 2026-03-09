"use client"

import type { LabOrder } from "@/types/database"

interface LabReportPrintProps {
  order: LabOrder
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  })
}

export function LabReportPrint({ order }: LabReportPrintProps) {
  const results = (order.results || {}) as Record<string, string | number>

  return (
    <div style={{ fontSize: 12 }}>
      {/* Patient / Order info */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{order.patient_name || order.patient_phone}</p>
          <p style={{ margin: "2px 0 0", color: "#555", fontSize: 11 }}>{order.patient_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#555" }}>Order: <strong>{order.order_id}</strong></p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>
            Date: {order.created_at ? formatDate(order.created_at) : "—"}
          </p>
        </div>
      </div>

      {/* Referring doctor */}
      {order.doctor_name && (
        <p style={{ margin: "0 0 12px", fontSize: 11 }}>
          Referring Doctor: <strong>Dr. {order.doctor_name}</strong>
        </p>
      )}

      {/* Sample / Report dates */}
      <div style={{ display: "flex", gap: 24, marginBottom: 16, fontSize: 11, color: "#555" }}>
        {order.sample_collected_at && (
          <span>Sample Collected: <strong>{formatDateTime(order.sample_collected_at)}</strong></span>
        )}
        {order.results_uploaded_at && (
          <span>Report Date: <strong>{formatDateTime(order.results_uploaded_at)}</strong></span>
        )}
      </div>

      {/* Tests and Results table */}
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left", width: 30 }}>S.No</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Test Name</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "center" }}>Result</th>
            <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "center" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(order.tests || []).map((test, i) => (
            <tr key={i}>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center" }}>{i + 1}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11 }}>{test.test_name}</td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center", fontWeight: 500 }}>
                {results[test.test_name] !== undefined ? String(results[test.test_name]) : "—"}
              </td>
              <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center", textTransform: "capitalize" }}>
                {test.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Notes */}
      {order.notes && (
        <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid #e5e5e5", borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#777" }}>Notes</p>
          <p style={{ margin: "4px 0 0", fontSize: 11 }}>{order.notes}</p>
        </div>
      )}

      {/* Total amount */}
      {order.total_amount && order.total_amount > 0 && (
        <p style={{ margin: "16px 0 0", fontSize: 11, textAlign: "right" }}>
          Total: <strong>Rs {order.total_amount.toLocaleString("en-IN")}</strong>
        </p>
      )}

      {/* Signature */}
      <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "center", width: 200 }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 6 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>Lab Technician</p>
            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#555" }}>Signature & Date</p>
          </div>
        </div>
      </div>
    </div>
  )
}
