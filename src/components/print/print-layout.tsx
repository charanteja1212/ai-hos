"use client"

import type { Tenant } from "@/types/database"

interface PrintLayoutProps {
  tenant: Tenant | null
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function PrintLayout({ tenant, title, subtitle, children }: PrintLayoutProps) {
  const hospitalName = tenant?.hospital_name || "Hospital"
  const address = tenant?.address
  const phone = tenant?.phone
  const logoUrl = tenant?.logo_url

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#000", padding: 0, minHeight: "100%" }}>
      {/* Letterhead */}
      <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {logoUrl && (
            <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ height: 48, marginBottom: 4 }} />
          )}
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{hospitalName}</h1>
          {address && <p style={{ fontSize: 11, margin: "2px 0 0", color: "#555" }}>{address}</p>}
          {phone && <p style={{ fontSize: 11, margin: "1px 0 0", color: "#555" }}>Tel: {phone}</p>}
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: 1, color: "#333" }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0" }}>{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <div>{children}</div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #ccc", marginTop: 32, paddingTop: 8, fontSize: 9, color: "#999", display: "flex", justifyContent: "space-between" }}>
        <span>Computer generated document</span>
        <span>
          Printed on:{" "}
          {new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </span>
      </div>
    </div>
  )
}
