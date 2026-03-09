import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

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
    console.error("forgot-password error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
