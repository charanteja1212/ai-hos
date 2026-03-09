"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LogOut,
  Sun,
  Moon,
  Heart,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { patientNav } from "@/components/layout/sidebar-nav-config"
import type { SessionUser } from "@/types/auth"

// Flatten for bottom nav
const allNavItems = patientNav.sections.flatMap((s) => s.items)

// Bottom nav shows first 4 + More
const bottomNavItems = allNavItems.slice(0, 4)

export function PatientShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const user = session?.user as SessionUser | undefined

  useEffect(() => setMounted(true), [])
  useEffect(() => setShowMore(false), [pathname])

  useEffect(() => {
    if (status !== "loading" && (!user || user.role !== "PATIENT")) {
      router.replace("/patient-login")
    }
  }, [status, user, router])

  // Auth guard — loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-sm px-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!user || user.role !== "PATIENT") return null

  const initials = (user.name || "P")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const isActive = (href: string) => {
    if (href === "/patient") return pathname === "/patient"
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Topbar */}
      <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none">{user.name}</p>
            <p className="text-[10px] text-muted-foreground">Patient Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl w-8 h-8"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/patient-login" })}
            className="rounded-xl text-xs gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — Notion style */}
        <aside className="hidden lg:flex w-56 flex-col sidebar-notion shrink-0">
          <div className="flex-1 overflow-y-auto sidebar-scroll py-2 px-2">
            {patientNav.sections.map((section, sIdx) => (
              <div key={section.id} className={cn(sIdx > 0 && "mt-4")}>
                <div className="px-3 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                    {section.label}
                  </span>
                </div>
                <nav className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <button
                        key={item.href}
                        onClick={() => router.push(item.href)}
                        className={cn(
                          "relative w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150",
                          active
                            ? "text-foreground bg-accent/50"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="patient-active-bar"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        <item.icon
                          className={cn(
                            "w-[18px] h-[18px] shrink-0",
                            active ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        {item.label}
                      </button>
                    )
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="border-t border-border/40 p-3 shrink-0">
            <div className="flex items-center gap-2.5 rounded-lg p-2">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{user.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {user.patientPhone}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4 sm:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t border-border/50 z-40">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.map((item) => {
            const active = isActive(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", active && "scale-110")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}

          {/* Click-outside backdrop */}
          {showMore && (
            <div className="fixed inset-0 z-30" onClick={() => setShowMore(false)} />
          )}

          {/* More menu */}
          <div className="relative z-40">
            <button
              onClick={() => setShowMore(!showMore)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all",
                showMore ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>

            <AnimatePresence>
              {showMore && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-16 right-0 bg-popover border border-border rounded-xl shadow-xl p-2 min-w-[160px]"
                >
                  {allNavItems.slice(4).map((item) => (
                    <button
                      key={item.href}
                      onClick={() => {
                        router.push(item.href)
                        setShowMore(false)
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all",
                        isActive(item.href)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  ))}
                  <div className="border-t border-border/50 mt-1 pt-1">
                    <button
                      onClick={() => signOut({ callbackUrl: "/patient-login" })}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </div>
  )
}
