import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createRouteLogger } from "@/lib/logger"
import { forgotPasswordBodySchema } from "@/lib/validations/api-schemas"
import { isRateLimited } from "@/lib/rate-limit"

const log = createRouteLogger("/api/auth/forgot-password")

export async function POST(req: Request) {
  try {
    // Rate limit: max 5 password reset requests per IP per 15 minutes
    const forwarded = req.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() || "unknown"
    if (await isRateLimited(`forgot-pw:${ip}`, 5, 15 * 60 * 1000)) {
      // Still return success to prevent enumeration
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a reset link has been sent.",
      })
    }

    const body = await req.json()
    const validation = forgotPasswordBodySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }
    const { email } = validation.data

    const supabase = createServerClient()

    // Check if email exists in user_credentials (prevent leaking info — always return success)
    const { data: cred } = await supabase
      .from("user_credentials")
      .select("id")
      .eq("email", email)
      .single()

    if (cred) {
      // Use hardcoded origin to prevent open redirect via Origin header
      const origin = process.env.NEXTAUTH_URL || "http://localhost:3000"

      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      })
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a reset link has been sent.",
    })
  } catch (err) {
    log.error({ err }, "Forgot password error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
