import { SignJWT } from "jose"

/**
 * Signs a custom Supabase JWT containing tenant isolation claims.
 * Used by NextAuth to create a JWT that the browser Supabase client
 * sends as Authorization header. RLS policies read these claims.
 */
export async function signSupabaseJWT(claims: {
  tenantId: string
  clientId: string
  userRole: string
  userId: string
}): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured")
  }

  const encodedSecret = new TextEncoder().encode(secret)

  const jwt = await new SignJWT({
    // Supabase required claims
    role: "authenticated",
    aud: "authenticated",
    // Custom claims for RLS policies
    tenant_id: claims.tenantId,
    client_id: claims.clientId,
    user_role: claims.userRole,
    sub: claims.userId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .setIssuer("supabase")
    .sign(encodedSecret)

  return jwt
}
