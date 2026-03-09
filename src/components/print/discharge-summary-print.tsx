"use client"

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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{admission.patient_name}</p>
          <p style={{ margin: "2px 0 0", color: "#555", fontSize: 11 }}>{admission.patient_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#555" }}>Admission: <strong>{admission.admission_id}</strong></p>
        </div>
      </div>

      {/* Admission Details */}
      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
        <tbody>
          {[
            ["Ward / Bed", `${admission.ward} — ${admission.bed_number}`],
            ["Doctor", admission.doctor_name || "—"],
            ["Admission Date", admission.admission_date ? formatDate(admission.admission_date) : admission.created_at ? formatDate(admission.created_at) : "—"],
            ["Discharge Date", admission.actual_discharge ? formatDate(admission.actual_discharge) : "—"],
            ["Length of Stay", `${days} day${days !== 1 ? "s" : ""}`],
          ].map(([label, value], i) => (
            <tr key={i}>
              <td style={{ border: "1px solid #ddd", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f9f9f9", width: 160 }}>{label}</td>
              <td style={{ border: "1px solid #ddd", padding: "6px 10px", fontSize: 11 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Discharge Summary */}
      {summary && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px", borderBottom: "1px solid #ddd", paddingBottom: 4 }}>Discharge Summary</h3>

          {summary.final_diagnosis && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#777" }}>Final Diagnosis</p>
              <p style={{ margin: "2px 0 0", fontSize: 11 }}>{summary.final_diagnosis}</p>
            </div>
          )}

          {summary.treatment_given && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#777" }}>Treatment Given</p>
              <p style={{ margin: "2px 0 0", fontSize: 11 }}>{summary.treatment_given}</p>
            </div>
          )}

          {/* Medications on Discharge */}
          {summary.medications_on_discharge && summary.medications_on_discharge.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#777" }}>Medications on Discharge</p>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left", width: 24 }}>S.No</th>
                    <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Medicine</th>
                    <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Dosage</th>
                    <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Frequency</th>
                    <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.medications_on_discharge.map((med, i) => (
                    <tr key={i}>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, textAlign: "center" }}>{i + 1}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10 }}>{med.medicine}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10 }}>{med.dosage}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10 }}>{med.frequency}</td>
                      <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10 }}>{med.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary.follow_up_instructions && (
            <div style={{ marginBottom: 10, padding: "8px 12px", border: "1px solid #dbeafe", borderRadius: 4, backgroundColor: "#eff6ff" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#777" }}>Follow-up Instructions</p>
              <p style={{ margin: "2px 0 0", fontSize: 11 }}>{summary.follow_up_instructions}</p>
            </div>
          )}

          {summary.follow_up_date && (
            <p style={{ margin: "0 0 10px", fontSize: 11 }}>
              <strong>Follow-up Date:</strong> {formatDate(summary.follow_up_date)}
            </p>
          )}
        </>
      )}

      {/* Daily Charges */}
      {charges.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px", borderBottom: "1px solid #ddd", paddingBottom: 4 }}>Charges Summary</h3>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Date</th>
                <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Description</th>
                <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Category</th>
                <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10 }}>{c.date}</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10 }}>{c.description}</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, textTransform: "capitalize" }}>{c.category}</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 10, textAlign: "right" }}>{formatCurrency(c.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 11, fontWeight: 700, textAlign: "right" }}>Total</td>
                <td style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: 11, fontWeight: 700, textAlign: "right" }}>{formatCurrency(chargesTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Discharged by */}
      {summary?.discharged_by && (
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "center", width: 200 }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: 6 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>{summary.discharged_by}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#555" }}>Discharged By</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
