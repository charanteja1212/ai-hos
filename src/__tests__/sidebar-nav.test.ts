import { describe, it, expect } from "vitest"
import { getNavForRole, patientNav, type NavSection, type NavItem } from "@/components/layout/sidebar-nav-config"
import type { UserRole } from "@/types/auth"

describe("Sidebar Navigation Config", () => {
  const allRoles: UserRole[] = [
    "SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN",
    "DOCTOR", "RECEPTION", "PHARMACIST", "LAB_TECH", "PATIENT",
  ]

  describe("getNavForRole returns valid config for all roles", () => {
    for (const role of allRoles) {
      it(`${role} has at least one section`, () => {
        const nav = getNavForRole(role)
        expect(nav.sections.length).toBeGreaterThan(0)
      })

      it(`${role} has items with icon, label, and href`, () => {
        const nav = getNavForRole(role)
        const items = nav.sections.flatMap((s) => s.items)
        for (const item of items) {
          expect(item.label).toBeTruthy()
          expect(item.href).toBeTruthy()
          expect(item.icon).toBeTruthy()
        }
      })
    }
  })

  describe("no duplicate hrefs within a role nav", () => {
    for (const role of allRoles) {
      it(`${role} has unique hrefs`, () => {
        const nav = getNavForRole(role)
        const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href))
        const uniqueHrefs = new Set(hrefs)
        expect(uniqueHrefs.size).toBe(hrefs.length)
      })
    }
  })

  describe("section IDs are unique within each role", () => {
    for (const role of allRoles) {
      it(`${role} sections have unique IDs`, () => {
        const nav = getNavForRole(role)
        const ids = nav.sections.map((s) => s.id)
        expect(new Set(ids).size).toBe(ids.length)
      })
    }
  })

  describe("role isolation", () => {
    it("SUPER_ADMIN cannot see patient routes", () => {
      const nav = getNavForRole("SUPER_ADMIN")
      const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href))
      expect(hrefs.some((h) => h.startsWith("/patient"))).toBe(false)
    })

    it("PATIENT cannot see admin routes", () => {
      const nav = getNavForRole("PATIENT")
      const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href))
      expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false)
      expect(hrefs.some((h) => h.startsWith("/platform"))).toBe(false)
    })

    it("DOCTOR cannot see platform management routes", () => {
      const nav = getNavForRole("DOCTOR")
      const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href))
      expect(hrefs.some((h) => h.startsWith("/platform"))).toBe(false)
    })

    it("RECEPTION cannot see doctor-specific routes", () => {
      const nav = getNavForRole("RECEPTION")
      const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href))
      expect(hrefs.some((h) => h.startsWith("/doctor"))).toBe(false)
    })
  })

  describe("CLIENT_ADMIN and BRANCH_ADMIN share the same nav", () => {
    it("both roles return identical navigation", () => {
      const clientNav = getNavForRole("CLIENT_ADMIN")
      const branchNav = getNavForRole("BRANCH_ADMIN")
      expect(clientNav).toEqual(branchNav)
    })

    it("ADMIN alias also gets the same nav", () => {
      const adminNav = getNavForRole("ADMIN")
      const branchNav = getNavForRole("BRANCH_ADMIN")
      expect(adminNav).toEqual(branchNav)
    })
  })

  describe("platform nav has all required management pages", () => {
    it("includes all critical platform pages", () => {
      const nav = getNavForRole("SUPER_ADMIN")
      const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href))
      const requiredPaths = [
        "/platform",
        "/platform/clients",
        "/platform/branches",
        "/platform/doctors",
        "/platform/patients",
        "/platform/plans",
        "/platform/settings",
        "/platform/logs",
        "/platform/health",
        "/platform/whatsapp",
        "/platform/analytics",
      ]
      for (const path of requiredPaths) {
        expect(hrefs).toContain(path)
      }
    })
  })
})
