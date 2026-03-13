"use client"

import { PS } from "./print-layout"
import type { Prescription } from "@/types/database"

interface PrescriptionPrintProps {
  prescription: Prescription
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function PrescriptionPrint({ prescription }: PrescriptionPrintProps) {
  const vitals = prescription.vitals as Record<string, unknown> | undefined
  const hasVitals = vitals && Object.values(vitals).some(v => v !== null && v !== undefined && v !== "")

  return (
    <div style={{ fontSize: 12 }}>
      {/* Patient & Doctor Info */}
      <div style={PS.infoRow}>
        <div>
          <p style={PS.sectionLabel}>Patient</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {prescription.patient_name || prescription.patient_phone}
          </p>
          <p style={PS.muted}>{prescription.patient_phone}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={PS.sectionLabel}>Prescribing Doctor</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
            Dr. {prescription.doctor_name}
          </p>
          <p style={PS.muted}>
            Date: {prescription.created_at ? formatDate(prescription.created_at) : "—"}
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 9, color: "#94a3b8" }}>
            Rx ID: {prescription.prescription_id}
          </p>
        </div>
      </div>

      {/* Vitals Strip */}
      {hasVitals && (
        <div style={{
          display: "flex", gap: 0, marginBottom: 14, border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden",
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
        }}>
          {[
            { label: "BP", value: vitals.bp_systolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic || "—"}` : null, unit: "mmHg" },
            { label: "Pulse", value: vitals.pulse, unit: "bpm" },
            { label: "Temp", value: vitals.temperature, unit: "°F" },
            { label: "SpO₂", value: vitals.spo2, unit: "%" },
            { label: "Weight", value: vitals.weight, unit: "kg" },
            { label: "RR", value: vitals.respiratory_rate, unit: "/min" },
          ].filter(v => v.value).map((v, i) => (
            <div key={i} style={{
              flex: 1, padding: "6px 10px", textAlign: "center",
              borderRight: "1px solid #e2e8f0",
              backgroundColor: i % 2 === 0 ? "#f8fafc" : "#ffffff",
            }}>
              <p style={{ margin: 0, fontSize: 8, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{v.label}</p>
              <p style={{ margin: "1px 0 0", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {String(v.value)} <span style={{ fontSize: 8, fontWeight: 400, color: "#94a3b8" }}>{v.unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Diagnosis & Symptoms */}
      {(prescription.diagnosis || prescription.symptoms) && (
        <div style={{ marginBottom: 14 }}>
          {prescription.diagnosis && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Diagnosis: </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{prescription.diagnosis}</span>
            </div>
          )}
          {prescription.symptoms && (
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>Symptoms: </span>
              <span style={{ fontSize: 11, color: "#334155" }}>{prescription.symptoms}</span>
            </div>
          )}
        </div>
      )}

      {/* Rx Symbol + Medicines */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 800, fontFamily: "serif", lineHeight: 1, color: "#1e293b" }}>&#8478;</span>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#64748b" }}>Medications</span>
        </div>

        <table style={PS.table}>
          <thead>
            <tr>
              <th style={{ ...PS.th, width: 32, textAlign: "center" }}>#</th>
              <th style={PS.th}>Medicine</th>
              <th style={{ ...PS.th, width: 80 }}>Dosage</th>
              <th style={{ ...PS.th, width: 100 }}>Frequency</th>
              <th style={{ ...PS.th, width: 80 }}>Duration</th>
              <th style={{ ...PS.th, width: 40, textAlign: "center" }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {(prescription.items || []).map((item, i) => (
              <tr key={i}>
                <td style={{ ...PS.td, textAlign: "center", color: "#94a3b8", fontSize: 10 }}>{i + 1}</td>
                <td style={{ ...PS.td, fontWeight: 600 }}>{item.medicine_name}</td>
                <td style={PS.td}>{item.dosage || "—"}</td>
                <td style={PS.td}>{item.frequency || "—"}</td>
                <td style={PS.td}>{item.duration || "—"}</td>
                <td style={{ ...PS.td, textAlign: "center" }}>{item.quantity || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {prescription.notes && (
        <div style={{ ...PS.highlightBox("amber"), marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#92400e" }}>Doctor&apos;s Notes</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#78350f" }}>{prescription.notes}</p>
        </div>
      )}

      {/* Follow-up */}
      {prescription.follow_up_date && (
        <div style={{ ...PS.highlightBox("blue"), marginBottom: 12 }}>
          <span style={{ fontWeight: 700 }}>Follow-up Date: </span>
          {formatDate(prescription.follow_up_date)}
        </div>
      )}

      {/* Doctor Signature */}
      <div style={PS.signatureBlock}>
        <div style={PS.signatureInner}>
          <div style={PS.signatureLine}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Dr. {prescription.doctor_name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: "#94a3b8" }}>Signature & Stamp</p>
          </div>
        </div>
      </div>
    </div>
  )
}
