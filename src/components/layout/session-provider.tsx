"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { SupabaseAuthProvider } from "@/components/providers/supabase-auth-provider"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
    </NextAuthSessionProvider>
  )
}
