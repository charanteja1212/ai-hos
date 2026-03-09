"use client"

import type { Prescription } from "@/types/database"

interface PrescriptionPrintProps {
  prescription: Prescription
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function PrescriptionPrint({ prescription }: PrescriptionPrintProps) {
  const vitals = prescription.vitals as Record<string, unknown> | undefined

  return (
    <div style={{ fontSize: 12 }}>
      {/* Rx + Patient + Doctor */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{prescription.patient_name || prescription.patient_phone}</p>
          <p style={{ margin: "2px 0 0", color: "#555", fontSize: 11 }}>{prescription.patient_phone}</p>
          <p style={{ margin: "2px 0 0", color: "#555", fontSize: 11 }}>
            Date: {prescription.created_at ? formatDate(prescription.created_at) : "—"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>Dr. {prescription.doctor_name}</p>
          <p style={{ margin: "2px 0 0", color: "#777", fontSize: 10 }}>ID: {prescription.prescription_id}</p>
        </div>
      </div>

      {/* Vitals */}
      {vitals && Object.keys(vitals).length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#777" }}>Vitals</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11 }}>
            {vitals.bp_systolic ? <span>BP: <strong>{String(vitals.bp_systolic)}/{String(vitals.bp_diastolic || "")}</strong></span> : null}
            {vitals.pulse ? <span>Pulse: <strong>{String(vitals.pulse)}</strong></span> : null}
            {vitals.temperature ? <span>Temp: <strong>{String(vitals.temperature)}°F</strong></span> : null}
            {vitals.spo2 ? <span>SpO2: <strong>{String(vitals.spo2)}%</strong></span> : null}
            {vitals.weight ? <span>Weight: <strong>{String(vitals.weight)} kg</strong></span> : null}
            {vitals.respiratory_rate ? <span>RR: <strong>{String(vitals.respiratory_rate)}</strong></span> : null}
          </div>
        </div>
      )}

      {/* Diagnosis & Symptoms */}
      {(prescription.diagnosis || prescription.symptoms) && (
        <div style={{ marginBottom: 12 }}>
          {prescription.diagnosis && (
            <p style={{ margin: "0 0 4px", fontSize: 11 }}>
              <strong>Diagnosis:</strong> {prescription.diagnosis}
            </p>
          )}
          {prescription.symptoms && (
            <p style={{ margin: "0 0 4px", fontSize: 11 }}>
              <strong>Symptoms:</strong> {prescription.symptoms}
            </p>
          )}
        </div>
      )}

      {/* Rx Symbol + Medicines */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "serif", lineHeight: 1 }}>&#8478;</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#555" }}>Medicines</span>
        </div>

        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left", width: 30 }}>S.No</th>
              <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Medicine</th>
              <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Dosage</th>
              <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Frequency</th>
              <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "left" }}>Duration</th>
              <th style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 600, backgroundColor: "#f5f5f5", textAlign: "center" }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {(prescription.items || []).map((item, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center" }}>{i + 1}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, fontWeight: 500 }}>{item.medicine_name}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11 }}>{item.dosage}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11 }}>{item.frequency}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11 }}>{item.duration}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: 11, textAlign: "center" }}>{item.quantity || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {prescription.notes && (
        <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid #e5e5e5", borderRadius: 4, backgroundColor: "#fffbeb" }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#777" }}>Doctor&apos;s Notes</p>
          <p style={{ margin: "4px 0 0", fontSize: 11 }}>{prescription.notes}</p>
        </div>
      )}

      {/* Follow-up */}
      {prescription.follow_up_date && (
        <div style={{ marginBottom: 16, padding: "6px 12px", border: "1px solid #dbeafe", borderRadius: 4, backgroundColor: "#eff6ff", fontSize: 11 }}>
          <strong>Follow-up Date:</strong> {formatDate(prescription.follow_up_date)}
        </div>
      )}

      {/* Doctor Signature Line */}
      <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "center", width: 200 }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 6 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Dr. {prescription.doctor_name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#555" }}>Signature</p>
          </div>
        </div>
      </div>
    </div>
  )
}
