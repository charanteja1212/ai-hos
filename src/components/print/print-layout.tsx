"use client"

import type { Tenant } from "@/types/database"

interface PrintLayoutProps {
  tenant: Tenant | null
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Show GSTIN in header (for invoices/tax documents) */
  showGstin?: boolean
  /** Compact header for smaller documents like tokens */
  compact?: boolean
}

// Shared inline styles for all print templates
const S = {
  page: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: "#1a1a1a",
    fontSize: 12,
    lineHeight: 1.5,
    padding: 0,
    minHeight: "100%",
  } as React.CSSProperties,
  headerBar: {
    background: "#1e293b",
    height: 4,
    marginBottom: 0,
    WebkitPrintColorAdjust: "exact" as const,
    printColorAdjust: "exact" as const,
  } as React.CSSProperties,
  header: {
    padding: "14px 0 12px",
    borderBottom: "2px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  } as React.CSSProperties,
  headerCompact: {
    padding: "8px 0",
    borderBottom: "1.5px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  } as React.CSSProperties,
  hospitalName: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.2,
    color: "#0f172a",
    letterSpacing: -0.3,
  } as React.CSSProperties,
  hospitalNameCompact: {
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.2,
    color: "#0f172a",
  } as React.CSSProperties,
  hospitalMeta: {
    fontSize: 10,
    margin: "2px 0 0",
    color: "#64748b",
    lineHeight: 1.4,
  } as React.CSSProperties,
  docTitle: {
    fontSize: 14,
    fontWeight: 700,
    margin: 0,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    color: "#1e293b",
    borderLeft: "3px solid #3b82f6",
    paddingLeft: 10,
  } as React.CSSProperties,
  docSubtitle: {
    fontSize: 10,
    color: "#64748b",
    margin: "3px 0 0",
    paddingLeft: 13,
  } as React.CSSProperties,
  footer: {
    borderTop: "1px solid #e2e8f0",
    marginTop: 28,
    paddingTop: 8,
    fontSize: 8,
    color: "#94a3b8",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
}

export function PrintLayout({ tenant, title, subtitle, children, showGstin, compact }: PrintLayoutProps) {
  const hospitalName = tenant?.hospital_name || "Hospital"
  const address = tenant?.address
  const phone = tenant?.phone
  const logoUrl = tenant?.logo_url
  const gstin = tenant?.gstin

  if (compact) {
    return (
      <div style={S.page}>
        <div style={S.headerBar} />
        <div style={S.headerCompact}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {logoUrl && <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ height: 28 }} />}
            <p style={S.hospitalNameCompact}>{hospitalName}</p>
          </div>
          <p style={{ ...S.docTitle, fontSize: 11, borderLeft: "2px solid #3b82f6", paddingLeft: 8 }}>{title}</p>
        </div>
        <div>{children}</div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.headerBar} />

      {/* Letterhead */}
      <div style={S.header}>
        <div>
          {logoUrl && (
            <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ height: 48, marginBottom: 6 }} />
          )}
          <h1 style={S.hospitalName}>{hospitalName}</h1>
          {address && <p style={S.hospitalMeta}>{address}</p>}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {phone && <p style={S.hospitalMeta}>Tel: {phone}</p>}
            {showGstin && gstin && <p style={{ ...S.hospitalMeta, fontWeight: 600 }}>GSTIN: {gstin}</p>}
          </div>
        </div>
        <div style={{ textAlign: "right", paddingTop: 4 }}>
          <h2 style={S.docTitle}>{title}</h2>
          {subtitle && <p style={S.docSubtitle}>{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <div>{children}</div>

      {/* Footer */}
      <div style={S.footer}>
        <span>This is a computer-generated document</span>
        <span>
          Printed: {new Date().toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
          })}
        </span>
      </div>
    </div>
  )
}

// ── Shared print utility styles ──────────────────────────────────────────────
// Export these so all print templates use consistent styling

export const PS = {
  /** Patient/Doctor info row */
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    padding: "10px 14px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 4,
    WebkitPrintColorAdjust: "exact" as const,
    printColorAdjust: "exact" as const,
  } as React.CSSProperties,
  /** Section label */
  sectionLabel: {
    margin: "0 0 6px",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "#94a3b8",
  } as React.CSSProperties,
  /** Section heading with bottom border */
  sectionHeading: {
    fontSize: 12,
    fontWeight: 700,
    margin: "16px 0 8px",
    paddingBottom: 4,
    borderBottom: "1.5px solid #e2e8f0",
    color: "#0f172a",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  } as React.CSSProperties,
  /** Table header cell */
  th: {
    border: "1px solid #cbd5e1",
    padding: "7px 10px",
    fontSize: 10,
    fontWeight: 700,
    backgroundColor: "#f1f5f9",
    textAlign: "left" as const,
    color: "#334155",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
    WebkitPrintColorAdjust: "exact" as const,
    printColorAdjust: "exact" as const,
  } as React.CSSProperties,
  /** Table data cell */
  td: {
    border: "1px solid #cbd5e1",
    padding: "6px 10px",
    fontSize: 11,
    color: "#1e293b",
    verticalAlign: "top" as const,
  } as React.CSSProperties,
  /** Bold data value */
  strong: {
    fontWeight: 600,
    color: "#0f172a",
  } as React.CSSProperties,
  /** Muted text */
  muted: {
    fontSize: 10,
    color: "#64748b",
  } as React.CSSProperties,
  /** Info field: label + value pair */
  field: (label: string, value: string) => ({
    label: { fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.5, margin: 0 },
    value: { fontSize: 12, fontWeight: 600, color: "#0f172a", margin: "1px 0 0" },
  }),
  /** Signature block */
  signatureBlock: {
    marginTop: 36,
    display: "flex",
    justifyContent: "flex-end",
  } as React.CSSProperties,
  signatureInner: {
    textAlign: "center" as const,
    width: 220,
  } as React.CSSProperties,
  signatureLine: {
    borderTop: "1px solid #334155",
    paddingTop: 6,
  } as React.CSSProperties,
  /** Highlighted box (follow-up, notes, etc.) */
  highlightBox: (color: "blue" | "amber" | "green" | "red") => {
    const colors = {
      blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
      amber: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
      green: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
      red: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
    }
    const c = colors[color]
    return {
      padding: "8px 12px",
      border: `1px solid ${c.border}`,
      backgroundColor: c.bg,
      borderRadius: 4,
      fontSize: 11,
      color: c.text,
      WebkitPrintColorAdjust: "exact" as const,
      printColorAdjust: "exact" as const,
    } as React.CSSProperties
  },
  /** Table wrapper */
  table: {
    borderCollapse: "collapse" as const,
    width: "100%",
  } as React.CSSProperties,
}
