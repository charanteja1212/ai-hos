import { describe, it, expect } from "vitest"
import { PLATFORM_ROLES, CLIENT_ROLES, BRANCH_ROLES, type UserRole } from "@/types/auth"
import { getNavForRole } from "@/components/layout/sidebar-nav-config"

describe("Role System", () => {
  describe("Role constants", () => {
    it("PLATFORM_ROLES contains only SUPER_ADMIN", () => {
      expect(PLATFORM_ROLES).toEqual(["SUPER_ADMIN"])
    })

    it("CLIENT_ROLES contains only CLIENT_ADMIN", () => {
      expect(CLIENT_ROLES).toEqual(["CLIENT_ADMIN"])
    })

    it("BRANCH_ROLES contains operational staff roles", () => {
      expect(BRANCH_ROLES).toContain("DOCTOR")
      expect(BRANCH_ROLES).toContain("RECEPTION")
      expect(BRANCH_ROLES).toContain("LAB_TECH")
      expect(BRANCH_ROLES).toContain("PHARMACIST")
      expect(BRANCH_ROLES).toContain("BRANCH_ADMIN")
      expect(BRANCH_ROLES).toContain("ADMIN")
    })

    it("all roles are covered across role groups + PATIENT", () => {
      const allRoles: UserRole[] = [
        ...PLATFORM_ROLES,
        ...CLIENT_ROLES,
        ...BRANCH_ROLES,
        "PATIENT",
      ]
      const expectedRoles: UserRole[] = [
        "SUPER_ADMIN", "CLIENT_ADMIN", "BRANCH_ADMIN", "ADMIN",
        "DOCTOR", "RECEPTION", "LAB_TECH", "PHARMACIST", "PATIENT",
      ]
      for (const role of expectedRoles) {
        expect(allRoles).toContain(role)
      }
    })
  })

  describe("Navigation config per role", () => {
    it("SUPER_ADMIN gets platform navigation", () => {
      const nav = getNavForRole("SUPER_ADMIN")
      const allLabels = nav.sections.flatMap((s) => s.items.map((i) => i.label))
      expect(allLabels).toContain("Dashboard")
      expect(allLabels).toContain("Clients")
      expect(allLabels).toContain("System Health")
      expect(allLabels).toContain("WhatsApp Routing")
    })

    it("SUPER_ADMIN nav has platform-specific routes", () => {
      const nav = getNavForRole("SUPER_ADMIN")
      const allHrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href))
      expect(allHrefs).toContain("/platform")
      expect(allHrefs).toContain("/platform/clients")
      expect(allHrefs).toContain("/platform/health")
      expect(allHrefs).toContain("/platform/whatsapp")
    })

    it("CLIENT_ADMIN gets branch admin navigation", () => {
      const nav = getNavForRole("CLIENT_ADMIN")
      const allLabels = nav.sections.flatMap((s) => s.items.map((i) => i.label))
      expect(allLabels).toContain("Dashboard")
      expect(allLabels).toContain("Doctors")
      expect(allLabels).toContain("Patients")
      expect(allLabels).toContain("Subscription")
      expect(allLabels).toContain("Activity Log")
    })

    it("DOCTOR gets doctor navigation", () => {
      const nav = getNavForRole("DOCTOR")
      const allLabels = nav.sections.flatMap((s) => s.items.map((i) => i.label))
      expect(allLabels).toContain("Dashboard")
      expect(allLabels).toContain("Consult")
      expect(allLabels).toContain("Schedule")
      expect(allLabels).not.toContain("Clients")
    })

    it("RECEPTION gets reception navigation", () => {
      const nav = getNavForRole("RECEPTION")
      const allLabels = nav.sections.flatMap((s) => s.items.map((i) => i.label))
      expect(allLabels).toContain("Queue Board")
      expect(allLabels).toContain("Walk-in Booking")
      expect(allLabels).toContain("Patient Search")
    })

    it("PHARMACIST gets pharmacy navigation", () => {
      const nav = getNavForRole("PHARMACIST")
      const allLabels = nav.sections.flatMap((s) => s.items.map((i) => i.label))
      expect(allLabels).toContain("Prescriptions")
      expect(allLabels).toContain("Inventory")
    })

    it("LAB_TECH gets lab navigation", () => {
      const nav = getNavForRole("LAB_TECH")
      const allLabels = nav.sections.flatMap((s) => s.items.map((i) => i.label))
      expect(allLabels).toContain("Lab Orders")
    })

    it("PATIENT gets patient navigation", () => {
      const nav = getNavForRole("PATIENT")
      const allLabels = nav.sections.flatMap((s) => s.items.map((i) => i.label))
      expect(allLabels).toContain("Book Appointment")
      expect(allLabels).toContain("Appointments")
      expect(allLabels).toContain("OP Passes")
      expect(allLabels).toContain("Prescriptions")
      expect(allLabels).toContain("Lab Results")
      expect(allLabels).toContain("Profile")
    })

    it("all nav items have valid hrefs starting with /", () => {
      const roles: UserRole[] = [
        "SUPER_ADMIN", "CLIENT_ADMIN", "DOCTOR", "RECEPTION",
        "PHARMACIST", "LAB_TECH", "PATIENT",
      ]
      for (const role of roles) {
        const nav = getNavForRole(role)
        for (const section of nav.sections) {
          for (const item of section.items) {
            expect(item.href).toMatch(/^\//)
          }
        }
      }
    })

    it("feature-gated nav items have requiredFeature set", () => {
      const nav = getNavForRole("CLIENT_ADMIN")
      const inpatientsItem = nav.sections
        .flatMap((s) => s.items)
        .find((i) => i.label === "Inpatients")
      expect(inpatientsItem?.requiredFeature).toBe("ipd_module")

      const pharmacyItem = nav.sections
        .flatMap((s) => s.items)
        .find((i) => i.label === "Pharmacy")
      expect(pharmacyItem?.requiredFeature).toBe("pharmacy_module")
    })
  })
})
