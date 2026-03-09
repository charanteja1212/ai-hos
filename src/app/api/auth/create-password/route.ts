import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import type { SessionUser } from "@/types/auth"

export async function POST(req: Request) {
  try {
    // Require active session
    const session = await auth()
    const user = session?.user as SessionUser | undefined
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email, password } = await req.json()

    // Validate inputs
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }
    if (!password || typeof password !== "string" || password.length < 10) {
      return NextResponse.json(
        { error: "Password must be at least 10 characters" },
        { status: 400 }
      )
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain uppercase, lowercase, and a number" },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Check if user already has credentials set up
    const { data: existing } = await supabase
      .from("user_credentials")
      .select("id")
      .eq("email", email)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "This email already has a password set up" },
        { status: 409 }
      )
    }

    // Determine entity_table and entity_id from session
    let entityTable: string
    let entityId: string

    switch (user.role) {
      case "SUPER_ADMIN":
        entityTable = "platform_admins"
        entityId = user.id
        break
      case "CLIENT_ADMIN":
        entityTable = "clients"
        entityId = user.clientId || ""
        break
      case "DOCTOR":
        entityTable = "doctors"
        entityId = user.doctorId || user.id
        break
      case "BRANCH_ADMIN":
      case "ADMIN":
        entityTable = "tenants"
        entityId = user.tenantId
        break
      default:
        // LAB_TECH, PHARMACIST, RECEPTION — staff table
        entityTable = "staff"
        entityId = user.id
        break
    }

    if (!entityId) {
      return NextResponse.json({ error: "Could not determine entity" }, { status: 400 })
    }

    // Also check if this exact role+entity already has credentials
    const { data: existingEntity } = await supabase
      .from("user_credentials")
      .select("id")
      .eq("role", user.role)
      .eq("entity_table", entityTable)
      .eq("entity_id", entityId)
      .single()

    if (existingEntity) {
      return NextResponse.json(
        { error: "This account already has a password set up with a different email" },
        { status: 409 }
      )
    }

    // Create Supabase Auth user (handles password hashing)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authUser.user) {
      // Check for duplicate email in Supabase Auth
      if (authError?.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "This email is already registered" },
          { status: 409 }
        )
      }
      console.error("Supabase auth error:", authError)
      return NextResponse.json(
        { error: "Failed to create auth user" },
        { status: 500 }
      )
    }

    // Insert mapping row in user_credentials
    const { error: insertError } = await supabase.from("user_credentials").insert({
      supabase_auth_uid: authUser.user.id,
      email,
      role: user.role,
      entity_table: entityTable,
      entity_id: entityId,
      tenant_id: user.tenantId || null,
      client_id: user.clientId || null,
    })

    if (insertError) {
      // Rollback: delete the Supabase Auth user we just created
      await supabase.auth.admin.deleteUser(authUser.user.id)
      console.error("Insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to save credentials" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("create-password error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
