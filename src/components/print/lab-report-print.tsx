"use client"

import { PS } from "./print-layout"
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
  const results = (order.results || {}) as Record<string, Record<string, unknown> | string | number>

  function getResult(testName: string, testId: string): { value: string; normalRange: string; unit: string; flag: string } {
    const r = results[testName] || results[testId]
    if (!r) return { value: "—", normalRange: "", unit: "", flag: "" }
    if (typeof r === "string" || typeof r === "number") return { value: String(r), normalRange: "", unit: "", flag: "" }
    const obj = r as Record<string, unknown>
    return {
      value: obj.value ? String(obj.value) : "—",
      normalRange: obj.normal_range ? String(obj.normal_range) : obj.normalRange ? String(obj.normalRange) : "",
      unit: obj.unit ? String(obj.unit) : "",
      flag: obj.flag ? String(obj.flag) : "",
    }
  }

  function isAbnormal(testName: string, testId: string): boolean {
    const r = getResult(testName, testId)
    return r.flag === "abnormal" || r.flag === "high" || r.flag === "low" || r.flag === "critical"
  }

  const hasAbnormal = order.tests.some(t => isAbnormal(t.test_name, t.test_id))

  return (
    <div style={{ fontSize: 12 }}>
      {/* Patient & Order Info */}
      <div style={PS.infoRow}>
        <div>
          <p style={PS.sectionLabel}>Patient</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {order.patient_name || order.patient_phone}
          </p>
          <p style={PS.muted}>{order.patient_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={PS.sectionLabel}>Lab Report</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>Order: {order.order_id}</p>
          <p style={PS.muted}>Date: {order.created_at ? formatDate(order.created_at) : "—"}</p>
        </div>
      </div>

      {/* Referring Doctor & Sample Info */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 11 }}>
        <div>
          {order.doctor_name && (
            <p style={{ margin: 0 }}>
              <span style={{ color: "#64748b" }}>Referring Doctor: </span>
              <strong>Dr. {order.doctor_name}</strong>
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {order.sample_collected_at && (
            <p style={{ margin: 0, color: "#64748b" }}>
              Sample: <strong style={{ color: "#334155" }}>{formatDateTime(order.sample_collected_at)}</strong>
            </p>
          )}
          {order.results_uploaded_at && (
            <p style={{ margin: 0, color: "#64748b" }}>
              Reported: <strong style={{ color: "#334155" }}>{formatDateTime(order.results_uploaded_at)}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Test Results Table */}
      <h3 style={PS.sectionHeading}>Test Results</h3>
      <table style={PS.table}>
        <thead>
          <tr>
            <th style={{ ...PS.th, width: 32, textAlign: "center" }}>#</th>
            <th style={PS.th}>Test Name</th>
            <th style={{ ...PS.th, textAlign: "center", width: 100 }}>Result</th>
            <th style={{ ...PS.th, textAlign: "center", width: 60 }}>Unit</th>
            <th style={{ ...PS.th, textAlign: "center", width: 120 }}>Normal Range</th>
            <th style={{ ...PS.th, textAlign: "center", width: 60 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(order.tests || []).map((test, i) => {
            const r = getResult(test.test_name, test.test_id)
            const abnormal = isAbnormal(test.test_name, test.test_id)
            return (
              <tr key={i}>
                <td style={{ ...PS.td, textAlign: "center", color: "#94a3b8", fontSize: 10 }}>{i + 1}</td>
                <td style={{ ...PS.td, fontWeight: 600 }}>{test.test_name}</td>
                <td style={{
                  ...PS.td, textAlign: "center", fontWeight: 700,
                  color: abnormal ? "#dc2626" : "#0f172a",
                  backgroundColor: abnormal ? "#fef2f2" : undefined,
                  WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
                }}>
                  {r.value}
                  {abnormal && <span style={{ fontSize: 9, marginLeft: 3 }}>*</span>}
                </td>
                <td style={{ ...PS.td, textAlign: "center", fontSize: 10, color: "#64748b" }}>{r.unit || "—"}</td>
                <td style={{ ...PS.td, textAlign: "center", fontSize: 10, color: "#64748b" }}>{r.normalRange || "—"}</td>
                <td style={{
                  ...PS.td, textAlign: "center", fontSize: 10, textTransform: "capitalize",
                  fontWeight: test.status === "completed" ? 600 : 400,
                  color: test.status === "completed" ? "#16a34a" : "#94a3b8",
                }}>
                  {test.status}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {hasAbnormal && (
        <p style={{ margin: "6px 0 0", fontSize: 9, color: "#dc2626" }}>
          * Values marked with asterisk are outside normal range. Please consult your doctor.
        </p>
      )}

      {/* Notes */}
      {order.notes && (
        <div style={{ ...PS.highlightBox("amber"), marginTop: 14 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</p>
          <p style={{ margin: "4px 0 0", fontSize: 11 }}>{order.notes}</p>
        </div>
      )}

      {/* Total */}
      {order.total_amount && order.total_amount > 0 && (
        <div style={{ marginTop: 14, textAlign: "right" }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>Total: </span>
          <strong style={{ fontSize: 13, color: "#0f172a" }}>Rs {order.total_amount.toLocaleString("en-IN")}</strong>
        </div>
      )}

      {/* Signatures — Lab Tech + Pathologist */}
      <div style={{ ...PS.signatureBlock, justifyContent: "space-between" }}>
        <div style={PS.signatureInner}>
          <div style={PS.signatureLine}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#0f172a" }}>Lab Technician</p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: "#94a3b8" }}>Verified & Signed</p>
          </div>
        </div>
        <div style={PS.signatureInner}>
          <div style={PS.signatureLine}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#0f172a" }}>Pathologist</p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: "#94a3b8" }}>Signature & Stamp</p>
          </div>
        </div>
      </div>
    </div>
  )
}
