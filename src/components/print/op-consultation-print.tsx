"use client"

import { PS } from "./print-layout"
import type { ClinicalNote, Vitals } from "@/types/database"

interface OPConsultationPrintProps {
  note: ClinicalNote
  vitals?: Vitals | null
  patientName?: string
  patientPhone?: string
  patientAge?: number
  patientGender?: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  consultation: "OP Consultation",
  follow_up: "Follow-up Visit",
  procedure: "Procedure Note",
  discharge: "Discharge Note",
  referral: "Referral Note",
}

export function OPConsultationPrint({ note, vitals, patientName, patientPhone, patientAge, patientGender }: OPConsultationPrintProps) {
  const hasVitals = vitals && (vitals.bp_systolic || vitals.pulse || vitals.temperature || vitals.spo2 || vitals.weight)
  const hasExamFindings = note.examination_findings && Object.keys(note.examination_findings).length > 0

  return (
    <div style={{ fontSize: 12 }}>
      {/* Patient & Doctor Info */}
      <div style={PS.infoRow}>
        <div>
          <p style={PS.sectionLabel}>Patient</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
            {patientName || patientPhone || note.patient_phone}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
            {patientPhone && <p style={PS.muted}>{patientPhone}</p>}
            {patientAge && <p style={PS.muted}>Age: {patientAge}</p>}
            {patientGender && <p style={{ ...PS.muted, textTransform: "capitalize" }}>{patientGender}</p>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={PS.sectionLabel}>{NOTE_TYPE_LABELS[note.note_type] || "Consultation"}</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
            {note.doctor_name ? `Dr. ${note.doctor_name}` : "—"}
          </p>
          <p style={PS.muted}>
            Date: {formatDate(note.created_at)}
          </p>
          {note.booking_id && (
            <p style={{ margin: "1px 0 0", fontSize: 9, color: "#94a3b8" }}>
              Ref: {note.booking_id}
            </p>
          )}
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

      {/* Chief Complaint */}
      {note.chief_complaint && (
        <div style={{ marginBottom: 12 }}>
          <p style={PS.sectionLabel}>Chief Complaint</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{note.chief_complaint}</p>
        </div>
      )}

      {/* History of Present Illness */}
      {note.history_of_illness && (
        <div style={{ marginBottom: 12 }}>
          <p style={PS.sectionLabel}>History of Present Illness</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#334155", lineHeight: 1.6 }}>{note.history_of_illness}</p>
        </div>
      )}

      {/* SOAP Notes */}
      <h3 style={PS.sectionHeading}>Clinical Notes (SOAP)</h3>

      {note.subjective && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 0.5 }}>S — Subjective</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#334155", lineHeight: 1.6, paddingLeft: 12, borderLeft: "2px solid #bfdbfe" }}>{note.subjective}</p>
        </div>
      )}

      {note.objective && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: 0.5 }}>O — Objective</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#334155", lineHeight: 1.6, paddingLeft: 12, borderLeft: "2px solid #bbf7d0" }}>{note.objective}</p>
        </div>
      )}

      {note.assessment && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: 0.5 }}>A — Assessment</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#334155", lineHeight: 1.6, paddingLeft: 12, borderLeft: "2px solid #fde68a" }}>{note.assessment}</p>
        </div>
      )}

      {note.plan && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#9333ea", textTransform: "uppercase", letterSpacing: 0.5 }}>P — Plan</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#334155", lineHeight: 1.6, paddingLeft: 12, borderLeft: "2px solid #d8b4fe" }}>{note.plan}</p>
        </div>
      )}

      {/* Examination Findings */}
      {hasExamFindings && (
        <>
          <h3 style={PS.sectionHeading}>Examination Findings</h3>
          <table style={PS.table}>
            <tbody>
              {Object.entries(note.examination_findings!).map(([key, value], i) => (
                <tr key={i}>
                  <td style={{
                    ...PS.td, fontWeight: 600, width: 180,
                    backgroundColor: "#f8fafc", textTransform: "capitalize",
                    WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
                  }}>
                    {key.replace(/_/g, " ")}
                  </td>
                  <td style={PS.td}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Doctor Signature */}
      <div style={PS.signatureBlock}>
        <div style={PS.signatureInner}>
          <div style={PS.signatureLine}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
              {note.doctor_name ? `Dr. ${note.doctor_name}` : "Attending Doctor"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: "#94a3b8" }}>Signature & Stamp</p>
          </div>
        </div>
      </div>
    </div>
  )
}
