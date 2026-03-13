/**
 * GET /api/verify/[id] — Verify Appointment / OP Pass / Prescription
 * Replaces n8n workflow 4LyGkTaG64XUiSbZ (Verify Appointment)
 *
 * Used for QR code scanning at reception. Returns styled HTML page.
 * Accepts query param ?type=prescription for prescription verification.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

function nowIST() {
  const istMs = Date.now() + 5.5 * 3600000
  const d = new Date(istMs)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const type = request.nextUrl.searchParams.get("type")
  const supabase = createServerClient()

  let html = ""

  try {
    // OP Pass verification
    if (id.startsWith("OP") || (!id.startsWith("BK") && !type)) {
      const { data: opPass } = await supabase
        .from("op_passes")
        .select("*")
        .eq("op_pass_id", id)
        .single()

      if (!opPass) {
        html = buildNotFoundHTML(id)
      } else {
        const today = nowIST()
        const isValid = opPass.status === "ACTIVE" && today <= opPass.expiry_date

        // Fetch linked appointment
        let appointment = null
        if (opPass.booking_id) {
          const { data } = await supabase
            .from("appointments")
            .select("*")
            .eq("booking_id", opPass.booking_id)
            .single()
          appointment = data
        }

        html = buildOpPassHTML(opPass, appointment, isValid)
      }
    }
    // Prescription verification
    else if (type === "prescription") {
      const { data: rx } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("prescription_id", id)
        .single()

      if (!rx) {
        html = buildNotFoundHTML(id)
      } else {
        html = buildPrescriptionHTML(rx)
      }
    }
    // Appointment verification
    else {
      const { data: appt } = await supabase
        .from("appointments")
        .select("*")
        .eq("booking_id", id)
        .single()

      if (!appt) {
        html = buildNotFoundHTML(id)
      } else {
        html = buildAppointmentHTML(appt)
      }
    }
  } catch {
    html = buildNotFoundHTML(id)
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

function baseStyles() {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
      .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 420px; width: 100%; overflow: hidden; }
      .header { padding: 24px; text-align: center; color: white; }
      .header h1 { font-size: 20px; font-weight: 700; }
      .header .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 8px; }
      .body { padding: 24px; }
      .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
      .row:last-child { border-bottom: none; }
      .label { color: #64748b; font-size: 13px; }
      .value { font-weight: 600; font-size: 14px; color: #1e293b; text-align: right; }
      .footer { text-align: center; padding: 16px; color: #94a3b8; font-size: 11px; border-top: 1px solid #f0f4f8; }
      .valid { background: linear-gradient(135deg, #059669, #10b981); }
      .invalid { background: linear-gradient(135deg, #dc2626, #ef4444); }
      .pending { background: linear-gradient(135deg, #d97706, #f59e0b); }
      .info { background: linear-gradient(135deg, #2563eb, #3b82f6); }
      .badge-valid { background: rgba(255,255,255,0.2); color: white; }
      .badge-invalid { background: rgba(255,255,255,0.2); color: white; }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  `
}

function buildOpPassHTML(opPass: Record<string, unknown>, appointment: Record<string, unknown> | null, isValid: boolean) {
  const statusClass = isValid ? "valid" : "invalid"
  const badgeText = isValid ? "VALID" : "EXPIRED"
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${baseStyles()}</head><body>
    <div class="card">
      <div class="header ${statusClass}">
        <h1>OP Pass Verification</h1>
        <div class="badge badge-${isValid ? "valid" : "invalid"}">${badgeText}</div>
      </div>
      <div class="body">
        <div class="row"><span class="label">OP Pass ID</span><span class="value">${opPass.op_pass_id}</span></div>
        <div class="row"><span class="label">Patient</span><span class="value">${opPass.patient_name || "—"}</span></div>
        <div class="row"><span class="label">Type</span><span class="value">${opPass.patient_type || "SELF"}</span></div>
        <div class="row"><span class="label">Issue Date</span><span class="value">${opPass.issue_date || "—"}</span></div>
        <div class="row"><span class="label">Expiry Date</span><span class="value">${opPass.expiry_date || "—"}</span></div>
        <div class="row"><span class="label">Status</span><span class="value">${opPass.status}</span></div>
        ${appointment ? `
        <div style="margin-top:16px;padding-top:16px;border-top:2px solid #f0f4f8;">
          <div class="row"><span class="label">Doctor</span><span class="value">${appointment.doctor_name || "—"}</span></div>
          <div class="row"><span class="label">Date</span><span class="value">${appointment.date || "—"}</span></div>
          <div class="row"><span class="label">Time</span><span class="value">${appointment.time || "—"}</span></div>
          <div class="row"><span class="label">Booking ID</span><span class="value">${appointment.booking_id || "—"}</span></div>
        </div>` : ""}
      </div>
      <div class="footer">AI-HOS Hospital Management System</div>
    </div>
  </body></html>`
}

function buildAppointmentHTML(appt: Record<string, unknown>) {
  const isPaid = appt.payment_status === "paid"
  const headerClass = isPaid ? "valid" : "pending"
  const badgeText = isPaid ? "VERIFIED & PAID" : "PAYMENT PENDING"
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${baseStyles()}</head><body>
    <div class="card">
      <div class="header ${headerClass}">
        <h1>Appointment Verification</h1>
        <div class="badge badge-valid">${badgeText}</div>
      </div>
      <div class="body">
        <div class="row"><span class="label">Patient</span><span class="value">${appt.patient_name || "—"}</span></div>
        <div class="row"><span class="label">Doctor</span><span class="value">${appt.doctor_name || "—"}</span></div>
        <div class="row"><span class="label">Specialty</span><span class="value">${appt.specialty || "—"}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${appt.date || "—"}</span></div>
        <div class="row"><span class="label">Time</span><span class="value">${appt.time || "—"}</span></div>
        <div class="row"><span class="label">Status</span><span class="value">${appt.status || "—"}</span></div>
        <div class="row"><span class="label">Booking ID</span><span class="value">${appt.booking_id || "—"}</span></div>
      </div>
      <div class="footer">AI-HOS Hospital Management System</div>
    </div>
  </body></html>`
}

function buildPrescriptionHTML(rx: Record<string, unknown>) {
  const isPaid = rx.payment_status === "paid"
  const headerClass = isPaid ? "valid" : "pending"
  const badgeText = isPaid ? "VERIFIED & PAID" : "PAYMENT PENDING"
  const items = Array.isArray(rx.items) ? rx.items : []
  const tests = Array.isArray(rx.tests) ? rx.tests : []
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${baseStyles()}</head><body>
    <div class="card">
      <div class="header ${headerClass}">
        <h1>Prescription Verification</h1>
        <div class="badge badge-valid">${badgeText}</div>
      </div>
      <div class="body">
        <div class="row"><span class="label">Patient</span><span class="value">${rx.patient_name || "—"}</span></div>
        <div class="row"><span class="label">Doctor</span><span class="value">${rx.doctor_name || "—"}</span></div>
        <div class="row"><span class="label">Diagnosis</span><span class="value">${rx.diagnosis || "—"}</span></div>
        <div class="row"><span class="label">Prescription ID</span><span class="value">${rx.prescription_id || "—"}</span></div>
        ${items.length > 0 ? `<div class="row"><span class="label">Medicines</span><span class="value">${items.map((i: Record<string, string>) => i.medicine_name).join(", ")}</span></div>` : ""}
        ${tests.length > 0 ? `<div class="row"><span class="label">Lab Tests</span><span class="value">${tests.map((t: Record<string, string>) => t.test_name).join(", ")}</span></div>` : ""}
      </div>
      <div class="footer">AI-HOS Hospital Management System</div>
    </div>
  </body></html>`
}

function buildNotFoundHTML(id: string) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${baseStyles()}</head><body>
    <div class="card">
      <div class="header invalid">
        <h1>Not Found</h1>
        <div class="badge badge-invalid">INVALID</div>
      </div>
      <div class="body" style="text-align:center;padding:32px;">
        <p style="color:#64748b;font-size:14px;">No booking found for ID: <strong>${id}</strong></p>
        <p style="color:#94a3b8;font-size:12px;margin-top:8px;">Please check the ID and try again.</p>
      </div>
      <div class="footer">AI-HOS Hospital Management System</div>
    </div>
  </body></html>`
}
