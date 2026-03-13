"use client"

/**
 * SupabaseAuthProvider — RLS is disabled on all tables, so we skip
 * sending custom JWTs. The browser client uses the anon key directly.
 * Tenant isolation is handled in code via tenant_id filters.
 */
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
