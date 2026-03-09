"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

export interface Shortcut {
  /** Keys to display (e.g., ["G", "Q"]) */
  keys: string[]
  /** Description shown in help dialog */
  label: string
  /** Category for grouping */
  category: "navigation" | "actions" | "general"
  /** Roles that can use this shortcut (empty = all) */
  roles?: string[]
}

// All registered shortcuts for the help dialog
export const SHORTCUTS: Shortcut[] = [
  // General
  { keys: ["Ctrl", "K"], label: "Open command palette", category: "general" },
  { keys: ["?"], label: "Show keyboard shortcuts", category: "general" },
  { keys: ["Esc"], label: "Close dialog / popover", category: "general" },

  // Navigation (G + key sequences)
  { keys: ["G", "H"], label: "Go to Dashboard", category: "navigation" },
  { keys: ["G", "Q"], label: "Go to Queue Board", category: "navigation", roles: ["RECEPTION", "ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"] },
  { keys: ["G", "A"], label: "Go to Appointments", category: "navigation", roles: ["RECEPTION", "ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"] },
  { keys: ["G", "D"], label: "Go to Doctor Dashboard", category: "navigation", roles: ["DOCTOR"] },
  { keys: ["G", "C"], label: "Go to Consult", category: "navigation", roles: ["DOCTOR"] },
  { keys: ["G", "P"], label: "Go to Patients", category: "navigation" },
  { keys: ["G", "R"], label: "Go to Prescriptions", category: "navigation", roles: ["DOCTOR"] },
  { keys: ["G", "Y"], label: "Go to Pharmacy", category: "navigation", roles: ["PHARMACIST", "ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"] },
  { keys: ["G", "L"], label: "Go to Lab Orders", category: "navigation", roles: ["LAB_TECH", "ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"] },
  { keys: ["G", "B"], label: "Go to Billing", category: "navigation", roles: ["ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"] },
  { keys: ["G", "S"], label: "Go to Settings", category: "navigation", roles: ["ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"] },

  // Actions
  { keys: ["N"], label: "New walk-in booking", category: "actions", roles: ["RECEPTION", "ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"] },
]

// Role-based route mapping for G+key navigation
const NAV_ROUTES: Record<string, Record<string, string>> = {
  // Default routes (used when role-specific not found)
  _default: {
    h: "/",
    p: "/admin/patients",
  },
  RECEPTION: {
    h: "/reception",
    q: "/reception",
    a: "/reception/appointments",
    p: "/reception/patients",
  },
  DOCTOR: {
    h: "/doctor",
    d: "/doctor",
    c: "/doctor/consult",
    p: "/doctor/patients",
    r: "/doctor/prescriptions",
  },
  PHARMACIST: {
    h: "/pharmacy",
    y: "/pharmacy",
  },
  LAB_TECH: {
    h: "/lab",
    l: "/lab",
  },
  ADMIN: {
    h: "/admin",
    q: "/reception",
    a: "/reception/appointments",
    p: "/admin/patients",
    y: "/pharmacy",
    l: "/lab",
    b: "/admin/billing",
    s: "/admin/settings",
  },
}
// Aliases
NAV_ROUTES.CLIENT_ADMIN = NAV_ROUTES.ADMIN
NAV_ROUTES.BRANCH_ADMIN = NAV_ROUTES.ADMIN
NAV_ROUTES.SUPER_ADMIN = {
  h: "/platform",
  p: "/platform/patients",
  s: "/platform/settings",
}

interface UseKeyboardShortcutsOptions {
  role: string
  onOpenHelp: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts({ role, onOpenHelp, enabled = true }: UseKeyboardShortcutsOptions) {
  const router = useRouter()
  const pendingG = useRef(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearG = useCallback(() => {
    pendingG.current = false
    if (gTimer.current) {
      clearTimeout(gTimer.current)
      gTimer.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if ((e.target as HTMLElement).isContentEditable) return
      // Skip if any modifier key is held (except for Ctrl+K which is handled elsewhere)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()

      // ? — open shortcuts help
      if (e.key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault()
        clearG()
        onOpenHelp()
        return
      }

      // N — new walk-in booking
      if (key === "n" && !pendingG.current) {
        const canBook = ["RECEPTION", "ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "SUPER_ADMIN"].includes(role)
        if (canBook) {
          e.preventDefault()
          router.push("/reception/book")
          return
        }
      }

      // G + key sequence
      if (key === "g" && !pendingG.current) {
        e.preventDefault()
        pendingG.current = true
        // Auto-cancel after 1.5s
        gTimer.current = setTimeout(clearG, 1500)
        return
      }

      if (pendingG.current) {
        e.preventDefault()
        clearG()
        const routes = NAV_ROUTES[role] || NAV_ROUTES._default
        const defaultRoutes = NAV_ROUTES._default
        const target = routes[key] || defaultRoutes[key]
        if (target) {
          router.push(target)
        }
        return
      }
    }

    document.addEventListener("keydown", handler)
    return () => {
      document.removeEventListener("keydown", handler)
      clearG()
    }
  }, [role, enabled, router, onOpenHelp, clearG])

  // Return shortcuts filtered by role for the help dialog
  const availableShortcuts = SHORTCUTS.filter(
    (s) => !s.roles || s.roles.includes(role)
  )

  return { availableShortcuts }
}
