"use client"

import { PS } from "./print-layout"
import type { Patient } from "@/types/database"

interface PatientCardPrintProps {
  patient: Patient
  hospitalName?: string
}

function formatAbha(abha: string) {
  // Format as XX-XXXX-XXXX-XXXX
  const digits = abha.replace(/\D/g, "")
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
  }
  return abha
}

export function PatientCardPrint({ patient, hospitalName }: PatientCardPrintProps) {
  return (
    <div style={{ fontSize: 12, maxWidth: 420 }}>
      {/* Card Header */}
      <div style={{
        backgroundColor: "#1e293b", color: "#ffffff", padding: "10px 16px",
        borderRadius: "6px 6px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center",
        WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: -0.3 }}>
            {hospitalName || "Hospital"}
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 8, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Patient Identity Card</p>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", backgroundColor: "#3b82f6",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, color: "#ffffff",
        }}>
          {(patient.name || "P").charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Card Body */}
      <div style={{ border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "14px 16px" }}>
        {/* Name */}
        <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
          {patient.name || "—"}
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 10, color: "#64748b" }}>{patient.phone}</p>

        {/* Details Grid */}
        <div style={{ display: "flex", gap: 0, marginBottom: 12, border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden" }}>
          {[
            { label: "Age", value: patient.age ? `${patient.age} yrs` : "—" },
            { label: "Gender", value: patient.gender || "—" },
            { label: "Blood Group", value: patient.blood_group || "—" },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1, padding: "6px 10px", textAlign: "center",
              borderRight: i < 2 ? "1px solid #e2e8f0" : undefined,
              backgroundColor: i % 2 === 0 ? "#f8fafc" : "#ffffff",
              WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
            }}>
              <p style={{ margin: 0, fontSize: 8, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Contact & Medical Info */}
        <table style={{ ...PS.table, marginBottom: 12 }}>
          <tbody>
            {[
              patient.email && ["Email", patient.email],
              patient.address && ["Address", patient.address],
              patient.emergency_contact && ["Emergency Contact", patient.emergency_contact],
              patient.allergies && ["Allergies", patient.allergies],
              patient.chronic_diseases && ["Chronic Conditions", patient.chronic_diseases],
              patient.date_of_birth && ["Date of Birth", new Date(patient.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
            ].filter(Boolean).map((row, i) => (
              <tr key={i}>
                <td style={{
                  ...PS.td, fontWeight: 600, width: 140, fontSize: 10,
                  backgroundColor: "#f8fafc",
                  WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
                }}>
                  {(row as string[])[0]}
                </td>
                <td style={{ ...PS.td, fontSize: 11 }}>{(row as string[])[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ABHA Section */}
        {patient.abha_number && (
          <div style={{
            ...PS.highlightBox("blue"), marginBottom: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>ABHA Number</p>
              <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>
                {formatAbha(patient.abha_number)}
              </p>
              {patient.abha_address && (
                <p style={{ margin: "2px 0 0", fontSize: 10, opacity: 0.8 }}>
                  {patient.abha_address}
                </p>
              )}
            </div>
            <div style={{
              padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
              backgroundColor: patient.abha_status === "verified" ? "#dcfce7" : "#e0f2fe",
              color: patient.abha_status === "verified" ? "#166534" : "#1e40af",
              textTransform: "uppercase",
              WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
            }}>
              {patient.abha_status || "Linked"}
            </div>
          </div>
        )}

        {/* Registration Info */}
        <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "center", marginTop: 8 }}>
          <p style={{ margin: 0 }}>
            Registered: {patient.created_at
              ? new Date(patient.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "—"}
            {patient.visit_count ? ` • Visits: ${patient.visit_count}` : ""}
          </p>
        </div>
      </div>
    </div>
  )
}
