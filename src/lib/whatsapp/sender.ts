/**
 * WhatsApp Cloud API Direct Sender
 * Replaces n8n proxy — sends messages directly via Meta Graph API
 */

const DEFAULT_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || ""
const DEFAULT_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || ""
const GRAPH_API_VERSION = "v21.0"

interface WhatsAppConfig {
  phoneNumberId?: string
  accessToken?: string
}

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

function getApiUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`
}

/** Normalize phone to 12-digit with country code */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `91${digits}`
  return digits
}

/** Send a plain text WhatsApp message */
export async function sendText(
  to: string,
  text: string,
  config?: WhatsAppConfig
): Promise<SendResult> {
  const phoneNumberId = config?.phoneNumberId || DEFAULT_PHONE_NUMBER_ID
  const accessToken = config?.accessToken || DEFAULT_ACCESS_TOKEN

  if (!accessToken || !phoneNumberId) {
    console.warn("[whatsapp] No credentials configured, skipping send")
    return { success: false, error: "WhatsApp not configured" }
  }

  try {
    const res = await fetch(getApiUrl(phoneNumberId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { body: text },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error")
      console.error("[whatsapp] Send failed:", res.status, err.substring(0, 200))
      return { success: false, error: `WhatsApp API ${res.status}` }
    }

    const data = await res.json()
    return { success: true, messageId: data?.messages?.[0]?.id }
  } catch (err) {
    console.error("[whatsapp] Send error:", err)
    return { success: false, error: String(err) }
  }
}

/** Send an interactive CTA URL button message */
async function sendInteractiveButton(
  to: string,
  body: string,
  buttonText: string,
  url: string,
  config?: WhatsAppConfig
): Promise<SendResult> {
  const phoneNumberId = config?.phoneNumberId || DEFAULT_PHONE_NUMBER_ID
  const accessToken = config?.accessToken || DEFAULT_ACCESS_TOKEN

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: "WhatsApp not configured" }
  }

  try {
    const res = await fetch(getApiUrl(phoneNumberId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: { text: body },
          action: {
            name: "cta_url",
            parameters: {
              display_text: buttonText,
              url,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error")
      console.error("[whatsapp] Interactive send failed:", res.status, err.substring(0, 200))
      return { success: false, error: `WhatsApp API ${res.status}` }
    }

    const data = await res.json()
    return { success: true, messageId: data?.messages?.[0]?.id }
  } catch (err) {
    console.error("[whatsapp] Interactive send error:", err)
    return { success: false, error: String(err) }
  }
}

/** Send OTP message to patient */
export async function sendOTP(
  phone: string,
  otp: string,
  patientName: string,
  config?: WhatsAppConfig
): Promise<SendResult> {
  const firstName = (patientName || "").split(" ")[0] || "Patient"
  const text = [
    `Dear ${firstName},`,
    ``,
    `Your verification code for the Patient Portal is:`,
    `*${otp}*`,
    ``,
    `This code is valid for 5 minutes. Please do not share it with anyone.`,
    ``,
    `If you did not request this code, please disregard this message.`,
  ].join("\n")

  return sendText(phone, text, config)
}

/** Send appointment confirmation */
export async function sendBookingConfirmation(
  phone: string,
  data: {
    patientName: string
    doctorName: string
    specialty: string
    date: string
    time: string
    bookingId: string
    hospitalName: string
  },
  config?: WhatsAppConfig
): Promise<SendResult> {
  const firstName = (data.patientName || "").split(" ")[0]
  const text = [
    `*${data.hospitalName}*`,
    `*Appointment Confirmation*`,
    ``,
    `Dear ${firstName},`,
    ``,
    `Your appointment has been confirmed. Please find the details below:`,
    ``,
    `Booking ID: ${data.bookingId}`,
    `Doctor: Dr. ${data.doctorName}`,
    `Department: ${data.specialty}`,
    `Date: ${data.date}`,
    `Time: ${data.time}`,
    ``,
    `Kindly arrive 15 minutes prior to your scheduled time for registration.`,
    ``,
    `To cancel or reschedule, please reply to this message or contact the hospital reception.`,
    ``,
    `Regards,`,
    `${data.hospitalName}`,
  ].join("\n")

  return sendText(phone, text, config)
}

/** Send cancellation confirmation */
export async function sendCancellationConfirmation(
  phone: string,
  data: {
    patientName: string
    bookingId: string
    hospitalName: string
  },
  config?: WhatsAppConfig
): Promise<SendResult> {
  const firstName = (data.patientName || "").split(" ")[0]
  const text = [
    `*${data.hospitalName}*`,
    `*Appointment Cancellation*`,
    ``,
    `Dear ${firstName},`,
    ``,
    `Your appointment (Ref: ${data.bookingId}) has been cancelled as requested.`,
    ``,
    `If this was not intended, please book a new appointment through the patient portal or contact the hospital reception.`,
    ``,
    `Regards,`,
    `${data.hospitalName}`,
  ].join("\n")

  return sendText(phone, text, config)
}

/** Send appointment reminder (24h or 2h before) */
export async function sendReminder(
  phone: string,
  data: {
    patientName: string
    doctorName: string
    date: string
    time: string
    bookingId: string
    hospitalName: string
    hoursUntil: number
  },
  config?: WhatsAppConfig
): Promise<SendResult> {
  const firstName = (data.patientName || "").split(" ")[0]
  const timeLabel = data.hoursUntil <= 2 ? "in approximately 2 hours" : "scheduled for tomorrow"
  const text = [
    `*${data.hospitalName}*`,
    `*Appointment Reminder*`,
    ``,
    `Dear ${firstName},`,
    ``,
    `This is a reminder that your appointment is ${timeLabel}.`,
    ``,
    `Booking ID: ${data.bookingId}`,
    `Doctor: Dr. ${data.doctorName}`,
    `Date: ${data.date}`,
    `Time: ${data.time}`,
    ``,
    `Kindly arrive 15 minutes prior to your scheduled time.`,
    ``,
    `To cancel, please reply CANCEL or contact the hospital reception.`,
    ``,
    `Regards,`,
    `${data.hospitalName}`,
  ].join("\n")

  return sendText(phone, text, config)
}

/** Send doctor leave notification to affected patients */
export async function sendDoctorLeaveNotification(
  phone: string,
  data: {
    patientName: string
    doctorName: string
    specialty: string
    date: string
    time: string
    bookingId: string
    hospitalName: string
    reason?: string
    hasOpPass?: boolean
    rescheduleLink?: string
  },
  config?: WhatsAppConfig
): Promise<SendResult> {
  const firstName = (data.patientName || "").split(" ")[0]
  const lines = [
    `*${data.hospitalName}*`,
    `*Appointment Rescheduling Notice*`,
    ``,
    `Dear ${firstName},`,
    ``,
    `We regret to inform you that your appointment with *Dr. ${data.doctorName}* (${data.specialty}) on *${data.date}* at *${data.time}* has been cancelled due to the doctor being unavailable${data.reason ? ` (${data.reason})` : ""}.`,
    ``,
    `Booking ID: ${data.bookingId}`,
  ]

  if (data.rescheduleLink) {
    lines.push(
      ``,
      `You can reschedule your appointment${data.hasOpPass ? " *free of charge*" : ""} using the button below.`,
    )
  } else {
    lines.push(
      ``,
      `Please contact the hospital reception or reply to this message to reschedule your appointment.`,
    )
  }

  lines.push(
    ``,
    `We sincerely apologize for the inconvenience.`,
    ``,
    `Regards,`,
    `${data.hospitalName}`,
  )

  // Send as interactive button if reschedule link is available
  if (data.rescheduleLink) {
    const result = await sendInteractiveButton(
      phone,
      lines.join("\n"),
      "Reschedule Now",
      data.rescheduleLink,
      config
    )
    // Fallback to plain text with link if interactive fails
    if (!result.success) {
      const fallbackLines = [...lines]
      fallbackLines.splice(fallbackLines.length - 3, 0, ``, `Reschedule here: ${data.rescheduleLink}`)
      return sendText(phone, fallbackLines.join("\n"), config)
    }
    return result
  }

  return sendText(phone, lines.join("\n"), config)
}

/** Get WhatsApp config for a specific tenant (for per-client numbers) */
export async function getTenantWhatsAppConfig(
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<WhatsAppConfig> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("wa_token, whatsapp_phone_id")
    .eq("tenant_id", tenantId)
    .single()

  if (tenant?.wa_token && tenant?.whatsapp_phone_id) {
    return {
      phoneNumberId: tenant.whatsapp_phone_id,
      accessToken: tenant.wa_token,
    }
  }

  // Fallback to default credentials
  return {}
}
