import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { createServerClient } from "@/lib/supabase/server"
import { buildSessionUser } from "@/lib/auth/build-session-user"
import { signSupabaseJWT } from "@/lib/supabase/sign-jwt"
import { isRateLimited, resetRateLimit } from "@/lib/rate-limit"
import type { UserRole, SessionUser } from "@/types/auth"

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      id: "hospital-login",
      name: "Hospital Login",
      credentials: {
        role: { label: "Role", type: "text" },
        loginMode: { label: "Login Mode", type: "text" },
        tenantId: { label: "Tenant", type: "text" },
        clientId: { label: "Client", type: "text" },
        identifier: { label: "ID", type: "text" },
        email: { label: "Email", type: "text" },
        pin: { label: "PIN", type: "password" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const loginMode = (credentials?.loginMode as string) || "branch"
        const supabase = createServerClient()

        // ========== PASSWORD LOGIN ==========
        if (loginMode === "password") {
          const email = credentials?.email as string
          const password = credentials?.password as string
          if (!email || !password) return null

          // Verify password via Supabase Auth
          const { data: authData, error: authError } =
            await supabase.auth.signInWithPassword({ email, password })

          if (authError || !authData.user) return null

          // Sign out of Supabase Auth immediately — we only used it for password verification
          await supabase.auth.signOut()

          // Look up user_credentials to resolve app identity
          const { data: cred } = await supabase
            .from("user_credentials")
            .select("*")
            .eq("email", email)
            .single()

          if (!cred) return null

          // Verify tenant is active (skip for SUPER_ADMIN who has no tenant)
          if (cred.tenant_id) {
            const { data: tenantCheck } = await supabase
              .from("tenants")
              .select("status")
              .eq("tenant_id", cred.tenant_id)
              .single()
            if (!tenantCheck || tenantCheck.status !== "active") return null
          }

          // Build session from credential mapping
          return buildSessionUser({
            role: cred.role,
            entityTable: cred.entity_table,
            entityId: cred.entity_id,
            tenantId: cred.tenant_id,
            clientId: cred.client_id,
            email,
          })
        }

        // ========== PIN-BASED LOGIN ==========
        if (!credentials?.pin) return null
        const pin = credentials.pin as string

        // ========== SUPER ADMIN LOGIN ==========
        if (loginMode === "super_admin") {
          const email = credentials.email as string
          if (!email) return null

          const rateLimitKey = `pin:super:${email}`
          if (isRateLimited(rateLimitKey, 5)) return null

          const { data: admin } = await supabase
            .from("platform_admins")
            .select("admin_id, email, name, pin")
            .eq("email", email)
            .eq("status", "active")
            .single()

          if (!admin || admin.pin !== pin) return null
          resetRateLimit(rateLimitKey)

          return {
            id: admin.admin_id,
            name: admin.name,
            role: "SUPER_ADMIN",
            tenantId: "",
            hospitalName: "AI-HOS Platform",
            clientId: "",
            clientName: "",
          } as SessionUser & { id: string }
        }

        // ========== CLIENT ADMIN LOGIN ==========
        if (loginMode === "client_admin") {
          const clientId = credentials.clientId as string
          if (!clientId) return null

          const rateLimitKey = `pin:client:${clientId}`
          if (isRateLimited(rateLimitKey, 5)) return null

          const { data: client } = await supabase
            .from("clients")
            .select("client_id, name, admin_pin")
            .eq("client_id", clientId)
            .eq("status", "active")
            .single()

          if (!client || client.admin_pin !== pin) return null
          resetRateLimit(rateLimitKey)

          // Get the first ACTIVE branch for this client as default
          const { data: firstBranch } = await supabase
            .from("tenants")
            .select("tenant_id, hospital_name")
            .eq("client_id", clientId)
            .eq("status", "active")
            .limit(1)
            .single()

          // Block login if client has no active branches
          if (!firstBranch) return null

          return {
            id: `client-admin-${clientId}`,
            name: client.name + " Admin",
            role: "CLIENT_ADMIN",
            tenantId: firstBranch.tenant_id,
            hospitalName: firstBranch.hospital_name || client.name,
            clientId: client.client_id,
            clientName: client.name,
          } as SessionUser & { id: string }
        }

        // ========== BRANCH LOGIN (default) ==========
        const role = (credentials.role as string) || "ADMIN"
        const tenantId = credentials.tenantId as string
        if (!tenantId) return null

        // Rate limit: 5 failed PIN attempts per tenant+role in 15 minutes
        const identifier = credentials.identifier as string || ""
        const rateLimitKey = `pin:branch:${tenantId}:${role}:${identifier}`
        if (isRateLimited(rateLimitKey, 5)) return null

        // Fetch tenant info — must be active
        const { data: tenant } = await supabase
          .from("tenants")
          .select("tenant_id, hospital_name, admin_pin, reception_pin, client_id, status")
          .eq("tenant_id", tenantId)
          .single()

        if (!tenant || tenant.status !== "active") return null

        // Fetch parent client name
        const clientId = tenant.client_id || ""
        let clientName = ""
        if (clientId) {
          const { data: client } = await supabase
            .from("clients")
            .select("name")
            .eq("client_id", clientId)
            .single()
          clientName = client?.name || ""
        }

        // Map ADMIN → BRANCH_ADMIN for new role system
        const effectiveRole: UserRole = role === "ADMIN" ? "BRANCH_ADMIN" : role as UserRole

        if (role === "ADMIN" || role === "BRANCH_ADMIN") {
          // First try branch-level admin PIN
          if (pin === tenant.admin_pin) {
            resetRateLimit(rateLimitKey)
            return {
              id: `admin-${tenantId}`,
              name: tenant.hospital_name + " Admin",
              role: effectiveRole,
              tenantId,
              hospitalName: tenant.hospital_name,
              clientId,
              clientName,
            } as SessionUser & { id: string }
          }
          // Then try individual staff PIN
          const { data: adminStaff } = await supabase
            .from("staff")
            .select("staff_id, name, role, pin")
            .eq("tenant_id", tenantId)
            .in("role", ["ADMIN", "BRANCH_ADMIN"])
            .eq("pin", pin)
            .eq("status", "active")
            .limit(1)
            .single()
          if (!adminStaff) return null
          resetRateLimit(rateLimitKey)
          return {
            id: adminStaff.staff_id,
            name: adminStaff.name,
            role: effectiveRole,
            tenantId,
            hospitalName: tenant.hospital_name,
            clientId,
            clientName,
          } as SessionUser & { id: string }
        }

        if (role === "RECEPTION") {
          // First try branch-level reception PIN
          if (pin === (tenant.reception_pin || tenant.admin_pin)) {
            resetRateLimit(rateLimitKey)
            return {
              id: `reception-${tenantId}`,
              name: "Reception",
              role: "RECEPTION",
              tenantId,
              hospitalName: tenant.hospital_name,
              clientId,
              clientName,
            } as SessionUser & { id: string }
          }
          // Then try individual staff PIN
          const { data: recStaff } = await supabase
            .from("staff")
            .select("staff_id, name, role, pin")
            .eq("tenant_id", tenantId)
            .eq("role", "RECEPTION")
            .eq("pin", pin)
            .eq("status", "active")
            .limit(1)
            .single()
          if (!recStaff) return null
          resetRateLimit(rateLimitKey)
          return {
            id: recStaff.staff_id,
            name: recStaff.name,
            role: "RECEPTION",
            tenantId,
            hospitalName: tenant.hospital_name,
            clientId,
            clientName,
          } as SessionUser & { id: string }
        }

        if (role === "DOCTOR") {
          const doctorId = credentials.identifier as string
          if (!doctorId) return null

          const { data: doctor } = await supabase
            .from("doctors")
            .select("doctor_id, name, specialty, pin")
            .eq("doctor_id", doctorId)
            .eq("tenant_id", tenantId)
            .single()

          if (!doctor || doctor.pin !== pin) return null
          resetRateLimit(rateLimitKey)

          return {
            id: doctor.doctor_id,
            name: doctor.name,
            role: "DOCTOR",
            tenantId,
            hospitalName: tenant.hospital_name,
            clientId,
            clientName,
            doctorId: doctor.doctor_id,
            specialty: doctor.specialty,
          } as SessionUser & { id: string }
        }

        // Staff roles: LAB_TECH, PHARMACIST
        if (role === "LAB_TECH" || role === "PHARMACIST") {
          const { data: staff } = await supabase
            .from("staff")
            .select("staff_id, name, role, pin")
            .eq("tenant_id", tenantId)
            .eq("role", role)
            .eq("pin", pin)
            .eq("status", "active")
            .limit(1)
            .single()

          if (!staff) return null
          resetRateLimit(rateLimitKey)

          return {
            id: staff.staff_id,
            name: staff.name,
            role: staff.role as UserRole,
            tenantId,
            hospitalName: tenant.hospital_name,
            clientId,
            clientName,
          } as SessionUser & { id: string }
        }

        return null
      },
    }),
    Credentials({
      id: "patient-login",
      name: "Patient Login",
      credentials: {
        phone: { label: "Phone", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const phone = (credentials?.phone as string)?.replace(/\D/g, "")
        const otp = credentials?.otp as string
        if (!phone || !otp) return null

        // Rate limit: 5 OTP verification attempts per phone in 15 minutes
        const otpRateLimitKey = `otp:verify:${phone}`
        if (isRateLimited(otpRateLimitKey, 5)) return null

        const supabase = createServerClient()

        // Verify OTP — find unexpired, unverified OTP for this phone
        const { data: otpRecord } = await supabase
          .from("patient_otps")
          .select("*")
          .eq("phone", phone)
          .eq("otp", otp)
          .eq("verified", false)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (!otpRecord) return null
        if ((otpRecord.attempts || 0) >= 3) return null

        // Atomically mark ALL unverified OTPs for this phone as verified.
        // The `.eq("verified", false)` acts as a WHERE guard — if another concurrent
        // request already verified them, this update affects 0 rows and we reject.
        const { data: updatedRows } = await supabase
          .from("patient_otps")
          .update({ verified: true, attempts: (otpRecord.attempts || 0) + 1 })
          .eq("phone", phone)
          .eq("verified", false)
          .select("id")

        // If no rows were updated, another request already consumed this OTP
        if (!updatedRows || updatedRows.length === 0) {
          console.error(`[auth] OTP for ${phone} was already consumed by a concurrent request`)
          return null
        }

        resetRateLimit(otpRateLimitKey)

        // Lookup patient — handle both phone formats (with/without 91 prefix)
        const phoneVariants: string[] = [phone]
        if (phone.startsWith("91") && phone.length === 12) {
          phoneVariants.push(phone.slice(2))
        } else if (phone.length === 10) {
          phoneVariants.push(`91${phone}`)
        }

        const { data: patients } = await supabase
          .from("patients")
          .select("phone, name, tenant_id")
          .in("phone", phoneVariants)
          .limit(1)

        const patient = patients?.[0]
        if (!patient) return null

        // Resolve hospital name from tenant — must be active
        let hospitalName = ""
        let clientId = ""
        if (patient.tenant_id) {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("hospital_name, client_id, status")
            .eq("tenant_id", patient.tenant_id)
            .single()
          if (!tenant || tenant.status !== "active") return null
          hospitalName = tenant.hospital_name || ""
          clientId = tenant.client_id || ""
        }

        return {
          id: `patient-${patient.phone}`,
          name: patient.name || "Patient",
          role: "PATIENT" as UserRole,
          tenantId: patient.tenant_id || "",
          hospitalName,
          clientId,
          patientPhone: patient.phone,
        } as SessionUser & { id: string }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const sessionUser = user as SessionUser & { id: string }
        token.role = sessionUser.role
        token.tenantId = sessionUser.tenantId
        token.hospitalName = sessionUser.hospitalName
        token.clientId = sessionUser.clientId
        token.clientName = sessionUser.clientName
        token.doctorId = sessionUser.doctorId
        token.specialty = sessionUser.specialty
        token.email = sessionUser.email
        token.patientPhone = sessionUser.patientPhone

        // Generate custom Supabase JWT for browser RLS
        try {
          token.supabaseAccessToken = await signSupabaseJWT({
            tenantId: sessionUser.tenantId || "",
            clientId: sessionUser.clientId || "",
            userRole: sessionUser.role,
            userId: sessionUser.id || "",
          })
        } catch {
          // If SUPABASE_JWT_SECRET is not set, skip — browser uses anon key
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as unknown as SessionUser
        user.role = token.role as UserRole
        user.tenantId = token.tenantId as string
        user.hospitalName = token.hospitalName as string
        user.clientId = token.clientId as string | undefined
        user.clientName = token.clientName as string | undefined
        user.doctorId = token.doctorId as string | undefined
        user.specialty = token.specialty as string | undefined
        user.email = token.email as string | undefined
        user.patientPhone = token.patientPhone as string | undefined
      }
      // Pass Supabase JWT to browser
      if (token.supabaseAccessToken) {
        (session as unknown as Record<string, unknown>).supabaseAccessToken =
          token.supabaseAccessToken
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },
}
