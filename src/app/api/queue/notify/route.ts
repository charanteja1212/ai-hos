import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "991831654013001"
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || ""
const WA_API_URL = `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`

export async function POST(req: Request) {
  try {
    // Require authenticated session (reception/admin/doctor)
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      phone,
      patient_name,
      queue_number,
      doctor_name,
      hospital_name,
      estimated_wait,
      waiting_ahead,
      queue_url,
    } = body

    if (!phone || !queue_number) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate queue_url is from our domain (prevent phishing)
    if (queue_url) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
      let allowed = false
      try {
        const parsed = new URL(queue_url)
        if (appUrl) {
          const appHost = new URL(appUrl).hostname
          allowed = parsed.hostname === appHost
        }
        if (!allowed) {
          const origin = req.headers.get("origin")
          if (origin) {
            allowed = parsed.hostname === new URL(origin).hostname
          }
        }
      } catch {
        // Invalid URL format
      }
      if (!allowed) {
        return NextResponse.json({ error: "Invalid queue URL" }, { status: 400 })
      }
    }

    // Normalize phone: ensure it has country code
    let normalizedPhone = phone.replace(/\D/g, "")
    if (normalizedPhone.length === 10) {
      normalizedPhone = `91${normalizedPhone}`
    }

    const firstName = (patient_name || "Patient").split(" ")[0]
    const waitText = estimated_wait > 0 ? `~${estimated_wait} min` : "Shortly"
    const aheadText = waiting_ahead > 0 ? `${waiting_ahead}` : "0"

    const message = [
      `*${hospital_name || "Hospital"}*`,
      `*Queue Check-in Confirmation*`,
      ``,
      `Dear ${firstName},`,
      ``,
      `You have been successfully checked in for your consultation.`,
      ``,
      `Token Number: #${queue_number}`,
      `Doctor: ${doctor_name}`,
      `Estimated Wait: ${waitText}`,
      `Patients Ahead: ${aheadText}`,
      ``,
      `Please be seated in the waiting area. Your token number will be displayed on the screen when it is your turn.`,
      queue_url ? `\nTrack your position live: ${queue_url}` : "",
      ``,
      `Regards,`,
      `${hospital_name || "Hospital"}`,
    ].join("\n")

    if (!WA_ACCESS_TOKEN) {
      console.warn("WhatsApp access token not configured, skipping notification")
      return NextResponse.json({ success: true, skipped: true })
    }

    const waResponse = await fetch(WA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: { body: message },
      }),
    })

    if (!waResponse.ok) {
      const err = await waResponse.text()
      console.error("WhatsApp send failed:", err)
      return NextResponse.json({ success: false, error: "WhatsApp delivery failed" }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Queue notify error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
