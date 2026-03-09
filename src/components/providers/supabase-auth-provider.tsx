"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { setSupabaseToken } from "@/lib/supabase/client"

/**
 * Syncs the NextAuth session's Supabase JWT to the global browser client.
 * Place this inside SessionProvider so all createBrowserClient() calls
 * automatically use the authenticated token for RLS.
 */
export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const token = (session as unknown as Record<string, unknown>)?.supabaseAccessToken as
    | string
    | undefined

  useEffect(() => {
    setSupabaseToken(token || null)
  }, [token])

  return <>{children}</>
}
