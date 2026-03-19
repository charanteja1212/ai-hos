"use client"

import { PS } from "./print-layout"
import type { Admission } from "@/types/database"

interface DischargeSummaryPrintProps {
  admission: Admission
}

function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function daysStayed(admission: Admission) {
  const start = admission.admission_date
    ? new Date(admission.admission_date)
    : admission.created_at ? new Date(admission.created_at) : new Date()
  const end = admission.actual_discharge ? new Date(admission.actual_discharge) : new Date()
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export function DischargeSummaryPrint({ admission }: DischargeSummaryPrintProps) {
  const summary = admission.discharge_summary
  const charges = admission.daily_charges || []
  const days = daysStayed(admission)
  const chargesTotal = charges.reduce((s, c) => s + c.amount, 0)

  return (
    <div style={{ fontSize: 12 }}>
      {/* Patient Info */}
      <div style={PS.infoRow}>
        <div>
          <p style={PS.sectionLabel}>Patient</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {admission.patient_name}
          </p>
          <p style={PS.muted}>{admission.patient_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={PS.sectionLabel}>Admission</p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>{admission.admission_id}</p>
          <p style={PS.muted}>
            Status: <strong style={{ color: admission.status === "discharged" ? "#16a34a" : "#0f172a", textTransform: "capitalize" }}>{admission.status}</strong>
          </p>
        </div>
      </div>

      {/* Admission Details Grid */}
      <h3 style={PS.sectionHeading}>Admission Details</h3>
      <table style={PS.table}>
        <tbody>
          {[
            ["Ward / Bed", `${admission.ward || "—"} — ${admission.bed_number || "—"}`],
            ["Attending Doctor", admission.doctor_name ? `Dr. ${admission.doctor_name}` : "—"],
            ["Admitting Diagnosis", admission.diagnosis || "—"],
            ["Date of Admission", admission.admission_date ? formatDate(admission.admission_date) : admission.created_at ? formatDate(admission.created_at) : "—"],
            ["Date of Discharge", admission.actual_discharge ? formatDate(admission.actual_discharge) : "—"],
            ["Length of Stay", `${days} day${days !== 1 ? "s" : ""}`],
          ].map(([label, value], i) => (
            <tr key={i}>
              <td style={{ ...PS.td, fontWeight: 600, backgroundColor: "#f8fafc", width: 180, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{label}</td>
              <td style={PS.td}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Discharge Summary */}
      {summary && (
        <>
          <h3 style={PS.sectionHeading}>Discharge Summary</h3>

          {summary.final_diagnosis && (
            <div style={{ marginBottom: 12 }}>
              <p style={PS.sectionLabel}>Final Diagnosis</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{summary.final_diagnosis}</p>
            </div>
          )}

          {summary.treatment_given && (
            <div style={{ marginBottom: 12 }}>
              <p style={PS.sectionLabel}>Treatment Summary</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#334155", lineHeight: 1.6 }}>{summary.treatment_given}</p>
            </div>
          )}

          {summary.medications_on_discharge && summary.medications_on_discharge.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={PS.sectionLabel}>Medications on Discharge</p>
              <table style={{ ...PS.table, marginTop: 4 }}>
                <thead>
                  <tr>
                    <th style={{ ...PS.th, width: 28, textAlign: "center" }}>#</th>
                    <th style={PS.th}>Medicine</th>
                    <th style={{ ...PS.th, width: 80 }}>Dosage</th>
                    <th style={{ ...PS.th, width: 100 }}>Frequency</th>
                    <th style={{ ...PS.th, width: 80 }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.medications_on_discharge.map((med, i) => (
                    <tr key={i}>
                      <td style={{ ...PS.td, textAlign: "center", color: "#94a3b8", fontSize: 10 }}>{i + 1}</td>
                      <td style={{ ...PS.td, fontWeight: 600 }}>{med.medicine}</td>
                      <td style={PS.td}>{med.dosage}</td>
                      <td style={PS.td}>{med.frequency}</td>
                      <td style={PS.td}>{med.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary.follow_up_instructions && (
            <div style={{ ...PS.highlightBox("blue"), marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Follow-up Instructions</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6 }}>{summary.follow_up_instructions}</p>
            </div>
          )}

          {summary.follow_up_date && (
            <div style={{ ...PS.highlightBox("green"), marginBottom: 12 }}>
              <strong>Follow-up Date: </strong>{formatDate(summary.follow_up_date)}
            </div>
          )}
        </>
      )}

      {/* Daily Charges */}
      {charges.length > 0 && (
        <>
          <h3 style={PS.sectionHeading}>Charges Summary</h3>
          <table style={PS.table}>
            <thead>
              <tr>
                <th style={PS.th}>Date</th>
                <th style={PS.th}>Description</th>
                <th style={{ ...PS.th, width: 80 }}>Category</th>
                <th style={{ ...PS.th, textAlign: "right", width: 100 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c, i) => (
                <tr key={i}>
                  <td style={PS.td}>{c.date}</td>
                  <td style={PS.td}>{c.description}</td>
                  <td style={{ ...PS.td, textTransform: "capitalize" }}>{c.category}</td>
                  <td style={{ ...PS.td, textAlign: "right", fontWeight: 600 }}>{formatCurrency(c.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ ...PS.td, fontWeight: 700, textAlign: "right", backgroundColor: "#f8fafc", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                  Total Charges
                </td>
                <td style={{ ...PS.td, fontWeight: 700, textAlign: "right", fontSize: 13, backgroundColor: "#f8fafc", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                  {formatCurrency(chargesTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      {/* Vitals at Discharge */}
      {summary?.vitals_at_discharge && (
        <>
          <h3 style={PS.sectionHeading}>Vitals at Discharge</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            {Object.entries(summary.vitals_at_discharge).filter(([, v]) => v).map(([key, value]) => (
              <div key={key} style={{
                padding: "6px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                backgroundColor: "#f8fafc",
                textAlign: "center",
                WebkitPrintColorAdjust: "exact" as const,
                printColorAdjust: "exact" as const,
              }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8" }}>
                  {key === "bp" ? "Blood Pressure" : key === "spo2" ? "SpO2" : key === "temp" ? "Temperature" : key.charAt(0).toUpperCase() + key.slice(1)}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{value as string}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Condition at Discharge */}
      {summary?.condition_at_discharge && (
        <div style={{ ...PS.highlightBox("amber"), marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Condition at Discharge</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{summary.condition_at_discharge}</p>
        </div>
      )}

      {/* Signatures — Doctor + Patient Acknowledgment */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, gap: 40 }}>
        <div style={{ textAlign: "center", width: 220 }}>
          <div style={{ borderTop: "1px solid #334155", paddingTop: 6 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
              {summary?.discharged_by || admission.doctor_name || "Attending Doctor"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: "#94a3b8" }}>Discharged By — Signature & Stamp</p>
          </div>
        </div>
        <div style={{ textAlign: "center", width: 220 }}>
          <div style={{ borderTop: "1px solid #334155", paddingTop: 6 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
              {admission.patient_name}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: "#94a3b8" }}>Patient / Attendant — Signature</p>
          </div>
        </div>
      </div>
    </div>
  )
}
