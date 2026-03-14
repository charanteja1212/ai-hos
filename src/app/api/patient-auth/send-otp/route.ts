import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { randomInt } from "crypto"
import { sendOTP } from "@/lib/whatsapp/sender"
import { isRateLimited } from "@/lib/rate-limit"
import { normalizePhone, phoneVariants } from "@/lib/utils/phone"

export async function POST(req: Request) {
  try {
    // IP-based rate limit: max 10 OTP requests per IP per 15 minutes
    const forwarded = req.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() || "unknown"
    if (await isRateLimited(`otp-ip:${ip}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const { phone } = await req.json()
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    // Normalize phone to digits only
    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone.length < 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Build phone variants to handle mixed storage formats (with/without 91 prefix)
    const variants = phoneVariants(phone)

    // Check patient exists (try all phone variants)
    const { data: patients } = await supabase
      .from("patients")
      .select("phone, name")
      .in("phone", variants)
      .limit(1)

    const patient = patients?.[0]

    if (!patient) {
      // Generic message to prevent user enumeration
      return NextResponse.json(
        { error: "Unable to send OTP. If you are a registered patient, please try again or contact the hospital." },
        { status: 404 }
      )
    }

    // Rate limit: max 3 OTPs per phone in 15 minutes
    // Check ALL phone variants to prevent bypass via format switching
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("patient_otps")
      .select("*", { count: "exact", head: true })
      .in("phone", variants)
      .gte("created_at", fifteenMinAgo)

    if ((count || 0) >= 3) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please try again in 15 minutes." },
        { status: 429 }
      )
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    // Store OTP
    await supabase.from("patient_otps").insert({
      phone: normalizedPhone,
      otp,
      expires_at: expiresAt,
    })

    // Send OTP via direct WhatsApp Cloud API (no n8n)
    const otpResult = await sendOTP(normalizedPhone, otp, patient.name || "")

    const firstName = (patient.name || "").split(" ")[0]
    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, error: "OTP could not be delivered. Please try again." },
        { status: 502 }
      )
    }
    return NextResponse.json({ success: true, name: firstName })
  } catch {
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 })
  }
}
