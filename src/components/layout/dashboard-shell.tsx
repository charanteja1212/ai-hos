"use client"

import { useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { Skeleton } from "@/components/ui/skeleton"
import type { SessionUser } from "@/types/auth"
import { BranchProvider } from "@/components/providers/branch-context"
import { FeaturesProvider } from "@/components/providers/features-context"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Ensure page scroll is never locked by stale Radix scroll-locks
  useEffect(() => {
    const unlock = () => {
      document.body.removeAttribute("data-scroll-locked")
      document.body.style.overflow = ""
      document.body.style.paddingRight = ""
      document.documentElement.style.overflow = ""
    }
    unlock()
    const t = setTimeout(unlock, 500)
    return () => clearTimeout(t)
  }, [pathname])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // Capture-phase wheel handler on window — fires BEFORE any other handler.
  // Manually scrolls main to bypass anything blocking native scroll.
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const main = document.getElementById("dashboard-main")
      if (!main) return
      if (!main.contains(e.target as Node)) return
      const max = main.scrollHeight - main.clientHeight
      if (max <= 0) return
      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 40  // LINE mode
      if (e.deltaMode === 2) dy *= main.clientHeight  // PAGE mode
      main.scrollTop = Math.max(0, Math.min(max, main.scrollTop + dy))
      e.preventDefault()
    }
    window.addEventListener("wheel", handler, { passive: false, capture: true })
    return () => window.removeEventListener("wheel", handler, { capture: true })
  }, [])

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), [])

  if (status === "loading") {
    return (
      <div className="flex h-screen">
        <div className="hidden lg:block w-64 border-r border-border bg-sidebar p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-24 h-3" />
            </div>
          </div>
          <div className="space-y-2 mt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-14 sm:h-16 border-b border-border px-4 sm:px-6 flex items-center justify-between">
            <Skeleton className="w-48 h-6" />
            <Skeleton className="w-32 h-8 rounded-xl" />
          </div>
          <div className="flex-1 p-4 sm:p-6 space-y-4">
            <Skeleton className="w-64 h-8" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 sm:h-32 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!session?.user) return null

  const user = session.user as SessionUser

  return (
    <FeaturesProvider user={user}>
    <BranchProvider user={user}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — mobile: fixed overlay, desktop: fixed */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <Sidebar role={user.role} hospitalName={user.hospitalName} userName={user.name} clientId={user.clientId || ""} logoUrl={user.logoUrl} />
      </div>

      {/* Content — offset by sidebar width */}
      <div
        className="lg:pl-64 bg-background"
        style={{ height: "100dvh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ flexShrink: 0 }}>
          <Topbar user={user} onToggleMobile={toggleMobile} />
        </div>
        <main
          id="dashboard-main"
          className="p-4 sm:p-6"
          style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto" }}
        >
          {children}
        </main>
      </div>
    </BranchProvider>
    </FeaturesProvider>
  )
}
