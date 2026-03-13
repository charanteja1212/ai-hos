/**
 * POST /api/payment/send-emails — Send payment/booking confirmation emails
 * Replaces n8n workflow daXY30SUndQS6KfV (Send Payment Emails)
 *
 * Called internally after payment confirmation, booking, cancellation, etc.
 * Looks up patient email from DB and sends styled HTML emails via SMTP.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import nodemailer from "nodemailer"

const SMTP_USER = process.env.SMTP_USER || ""
const SMTP_PASS = process.env.SMTP_PASS || ""
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type,
      patient_phone,
      booked_by_whatsapp_number,
      patient_name,
      doctor_name,
      specialty,
      date,
      time,
      booking_id,
      hospital_name,
      payment_id,
      amount,
      op_pass_id,
      old_date,
      old_time,
      reschedule_count,
      reason,
      email_html,
      email_subject,
    } = body

    if (!SMTP_USER || !SMTP_PASS) {
      return NextResponse.json({ success: false, reason: "SMTP not configured" })
    }

    const supabase = createServerClient()

    // Look up patient email from both phones
    const phones = new Set<string>()
    if (patient_phone) {
      const digits = patient_phone.replace(/\D/g, "")
      phones.add(digits)
      if (digits.length === 10) phones.add(`91${digits}`)
      if (digits.startsWith("91") && digits.length === 12) phones.add(digits.slice(2))
    }
    if (booked_by_whatsapp_number) {
      const digits = booked_by_whatsapp_number.replace(/\D/g, "")
      phones.add(digits)
      if (digits.length === 10) phones.add(`91${digits}`)
      if (digits.startsWith("91") && digits.length === 12) phones.add(digits.slice(2))
    }

    const { data: patients } = await supabase
      .from("patients")
      .select("email, phone, name")
      .in("phone", Array.from(phones))

    const patientWithEmail = patients?.find((p) => p.email)
    if (!patientWithEmail?.email) {
      return NextResponse.json({ success: true, emails_sent: false, reason: "no email found" })
    }

    const email = patientWithEmail.email
    const transporter = getTransporter()
    let emailsSent = 0

    if (type === "appointment") {
      // Confirmation email
      await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: `Appointment Confirmed — ${hospital_name || "AI-HOS"}`,
        html: buildConfirmationEmail({ patient_name, doctor_name, specialty, date, time, booking_id, hospital_name, op_pass_id }),
      })
      emailsSent++

      // Receipt email
      if (payment_id && amount) {
        await transporter.sendMail({
          from: SMTP_FROM,
          to: email,
          subject: `Payment Receipt — ${hospital_name || "AI-HOS"}`,
          html: buildReceiptEmail({ patient_name, amount, payment_id, booking_id, hospital_name }),
        })
        emailsSent++
      }
    } else if (type === "cancellation") {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: `Appointment Cancelled — ${hospital_name || "AI-HOS"}`,
        html: buildCancellationEmail({ patient_name, doctor_name, date, time, booking_id, hospital_name, reason }),
      })
      emailsSent++
    } else if (type === "reschedule") {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: `Appointment Rescheduled — ${hospital_name || "AI-HOS"}`,
        html: buildRescheduleEmail({ patient_name, doctor_name, date, time, old_date, old_time, booking_id, hospital_name, reschedule_count }),
      })
      emailsSent++
    } else if (email_html && email_subject) {
      // Pre-built email (prescription, follow-up, etc.)
      await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: email_subject,
        html: email_html,
      })
      emailsSent++
    }

    return NextResponse.json({ success: true, emails_sent: emailsSent, patient_email: email })
  } catch (err) {
    console.error("[send-emails] Error:", err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function emailWrapper(gradient: string, content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:20px;background:#f0f4f8;font-family:-apple-system,sans-serif;">
    <div style="max-width:500px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:${gradient};padding:28px;text-align:center;color:white;">${content.split("<!--BODY-->")[0]}</div>
      <div style="padding:24px;">${content.split("<!--BODY-->")[1] || ""}</div>
      <div style="text-align:center;padding:16px;color:#94a3b8;font-size:11px;border-top:1px solid #f0f4f8;">AI-HOS Hospital Management System</div>
    </div>
  </body></html>`
}

function row(label: string, value: string) {
  return `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;">
    <span style="color:#64748b;font-size:13px;">${label}</span>
    <span style="font-weight:600;font-size:14px;color:#1e293b;">${value}</span>
  </div>`
}

function buildConfirmationEmail(d: Record<string, string>) {
  return emailWrapper("linear-gradient(135deg, #2563eb, #3b82f6)",
    `<h2 style="margin:0;font-size:20px;">Appointment Confirmed</h2>
    <p style="margin:8px 0 0;opacity:0.8;font-size:14px;">Your appointment has been booked successfully</p>
    <!--BODY-->
    ${row("Patient", d.patient_name || "—")}
    ${row("Doctor", d.doctor_name || "—")}
    ${row("Specialty", d.specialty || "—")}
    ${row("Date", d.date || "—")}
    ${row("Time", d.time || "—")}
    ${row("Booking ID", d.booking_id || "—")}
    ${d.op_pass_id ? row("OP Pass", d.op_pass_id) : ""}
    <p style="margin:16px 0 0;color:#64748b;font-size:12px;text-align:center;">Please arrive 15 minutes before your appointment time.</p>`)
}

function buildReceiptEmail(d: Record<string, string>) {
  return emailWrapper("linear-gradient(135deg, #059669, #10b981)",
    `<h2 style="margin:0;font-size:20px;">Payment Receipt</h2>
    <p style="margin:8px 0 0;opacity:0.8;font-size:14px;">Thank you for your payment</p>
    <!--BODY-->
    ${row("Patient", d.patient_name || "—")}
    ${row("Amount", `Rs ${d.amount || "0"}`)}
    ${row("Payment ID", d.payment_id || "—")}
    ${row("Booking ID", d.booking_id || "—")}
    ${row("Hospital", d.hospital_name || "—")}`)
}

function buildCancellationEmail(d: Record<string, string>) {
  return emailWrapper("linear-gradient(135deg, #dc2626, #ef4444)",
    `<h2 style="margin:0;font-size:20px;">Appointment Cancelled</h2>
    <p style="margin:8px 0 0;opacity:0.8;font-size:14px;">Your appointment has been cancelled</p>
    <!--BODY-->
    ${row("Patient", d.patient_name || "—")}
    ${row("Doctor", d.doctor_name || "—")}
    ${row("Date", d.date || "—")}
    ${row("Time", d.time || "—")}
    ${row("Booking ID", d.booking_id || "—")}
    ${d.reason ? row("Reason", d.reason) : ""}
    <p style="margin:16px 0 0;color:#64748b;font-size:12px;text-align:center;">If your OP Pass is still active, you can book a new appointment at no extra cost.</p>`)
}

function buildRescheduleEmail(d: Record<string, string>) {
  return emailWrapper("linear-gradient(135deg, #d97706, #f59e0b)",
    `<h2 style="margin:0;font-size:20px;">Appointment Rescheduled</h2>
    <p style="margin:8px 0 0;opacity:0.8;font-size:14px;">Your appointment has been moved to a new time</p>
    <!--BODY-->
    ${row("Patient", d.patient_name || "—")}
    ${row("Doctor", d.doctor_name || "—")}
    ${row("New Date", d.date || "—")}
    ${row("New Time", d.time || "—")}
    ${d.old_date ? row("Previous Date", d.old_date) : ""}
    ${d.old_time ? row("Previous Time", d.old_time) : ""}
    ${row("Booking ID", d.booking_id || "—")}
    ${d.reschedule_count ? row("Reschedule #", d.reschedule_count) : ""}`)
}
