import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  GitBranch,
  Stethoscope,
  Users,
  CreditCard,
  Settings,
  FileText,
  Activity,
  UserCog,
  IndianRupee,
  CalendarPlus,
  CalendarDays,
  Search,
  BedDouble,
  Pill,
  Package,
  TestTube,
  Home,
  Receipt,
  User,
  Shield,
  MessageSquare,
} from "lucide-react"
import type { UserRole } from "@/types/auth"
import type { TierFeatures } from "@/lib/platform/features"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** If set, this nav item is only shown when the feature is enabled */
  requiredFeature?: keyof TierFeatures
}

export interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

export interface RoleNavConfig {
  sections: NavSection[]
}

// ---- SUPER_ADMIN (Platform) ----
const platformAdminNav: RoleNavConfig = {
  sections: [
    {
      id: "overview",
      label: "OVERVIEW",
      items: [
        { label: "Dashboard", href: "/platform", icon: LayoutDashboard },
        { label: "Global Analytics", href: "/platform/analytics", icon: BarChart3 },
      ],
    },
    {
      id: "management",
      label: "MANAGEMENT",
      items: [
        { label: "Clients", href: "/platform/clients", icon: Building2 },
        { label: "All Branches", href: "/platform/branches", icon: GitBranch },
        { label: "All Doctors", href: "/platform/doctors", icon: Stethoscope },
        { label: "All Patients", href: "/platform/patients", icon: Users },
      ],
    },
    {
      id: "platform",
      label: "PLATFORM",
      items: [
        { label: "Subscriptions", href: "/platform/plans", icon: CreditCard },
        { label: "Platform Settings", href: "/platform/settings", icon: Settings },
        { label: "Audit Logs", href: "/platform/logs", icon: FileText },
        { label: "System Health", href: "/platform/health", icon: Activity },
        { label: "WhatsApp Routing", href: "/platform/whatsapp", icon: MessageSquare },
      ],
    },
  ],
}

// ---- ADMIN / CLIENT_ADMIN / BRANCH_ADMIN ----
const branchAdminNav: RoleNavConfig = {
  sections: [
    {
      id: "overview",
      label: "OVERVIEW",
      items: [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      ],
    },
    {
      id: "operations",
      label: "OPERATIONS",
      items: [
        { label: "Queue Board", href: "/reception", icon: CalendarDays },
        { label: "Appointments", href: "/reception/appointments", icon: CalendarPlus },
        { label: "Inpatients", href: "/reception/admissions", icon: BedDouble, requiredFeature: "ipd_module" },
      ],
    },
    {
      id: "management",
      label: "MANAGEMENT",
      items: [
        { label: "Doctors", href: "/admin/doctors", icon: Stethoscope },
        { label: "Patients", href: "/admin/patients", icon: Users },
        { label: "Staff", href: "/admin/staff", icon: UserCog },
      ],
    },
    {
      id: "clinical",
      label: "CLINICAL",
      items: [
        { label: "Pharmacy", href: "/pharmacy", icon: Pill, requiredFeature: "pharmacy_module" },
        { label: "Lab Orders", href: "/lab", icon: TestTube, requiredFeature: "lab_module" },
      ],
    },
    {
      id: "finance",
      label: "FINANCE",
      items: [
        { label: "Billing", href: "/admin/billing", icon: IndianRupee },
        { label: "Subscription", href: "/admin/subscription", icon: CreditCard },
      ],
    },
    {
      id: "settings",
      label: "SETTINGS",
      items: [
        { label: "Hospital Settings", href: "/admin/settings", icon: Settings },
        { label: "Activity Log", href: "/admin/activity", icon: FileText },
      ],
    },
  ],
}

// ---- RECEPTION ----
const receptionNav: RoleNavConfig = {
  sections: [
    {
      id: "operations",
      label: "OPERATIONS",
      items: [
        { label: "Queue Board", href: "/reception", icon: LayoutDashboard },
        { label: "Walk-in Booking", href: "/reception/book", icon: CalendarPlus },
        { label: "Appointments", href: "/reception/appointments", icon: CalendarDays },
      ],
    },
    {
      id: "records",
      label: "RECORDS",
      items: [
        { label: "Patient Search", href: "/reception/patients", icon: Search },
        { label: "Inpatients", href: "/reception/admissions", icon: BedDouble, requiredFeature: "ipd_module" },
      ],
    },
  ],
}

// ---- DOCTOR ----
const doctorNav: RoleNavConfig = {
  sections: [
    {
      id: "today",
      label: "TODAY",
      items: [
        { label: "Dashboard", href: "/doctor", icon: LayoutDashboard },
        { label: "Consult", href: "/doctor/consult", icon: Stethoscope },
      ],
    },
    {
      id: "records",
      label: "RECORDS",
      items: [
        { label: "My Patients", href: "/doctor/patients", icon: Users },
        { label: "Prescriptions", href: "/doctor/prescriptions", icon: FileText },
      ],
    },
    {
      id: "availability",
      label: "AVAILABILITY",
      items: [
        { label: "Schedule", href: "/doctor/schedule", icon: CalendarDays },
      ],
    },
  ],
}

// ---- PHARMACIST ----
const pharmacistNav: RoleNavConfig = {
  sections: [
    {
      id: "orders",
      label: "ORDERS",
      items: [
        { label: "Prescriptions", href: "/pharmacy", icon: Pill },
        { label: "Inventory", href: "/pharmacy/inventory", icon: Package },
      ],
    },
  ],
}

// ---- LAB_TECH ----
const labTechNav: RoleNavConfig = {
  sections: [
    {
      id: "work",
      label: "WORK",
      items: [
        { label: "Lab Orders", href: "/lab", icon: TestTube },
      ],
    },
  ],
}

// ---- PATIENT ----
export const patientNav: RoleNavConfig = {
  sections: [
    {
      id: "home",
      label: "HOME",
      items: [
        { label: "Dashboard", href: "/patient", icon: Home },
        { label: "Book Appointment", href: "/patient/book", icon: CalendarPlus },
      ],
    },
    {
      id: "health",
      label: "HEALTH",
      items: [
        { label: "Appointments", href: "/patient/appointments", icon: CalendarDays },
        { label: "OP Passes", href: "/patient/op-pass", icon: Shield },
        { label: "Prescriptions", href: "/patient/prescriptions", icon: Pill },
        { label: "Lab Results", href: "/patient/lab", icon: TestTube },
      ],
    },
    {
      id: "account",
      label: "ACCOUNT",
      items: [
        { label: "Invoices", href: "/patient/invoices", icon: Receipt },
        { label: "Profile", href: "/patient/profile", icon: User },
      ],
    },
  ],
}

const roleNavMap: Partial<Record<UserRole, RoleNavConfig>> = {
  SUPER_ADMIN: platformAdminNav,
  CLIENT_ADMIN: branchAdminNav,
  BRANCH_ADMIN: branchAdminNav,
  ADMIN: branchAdminNav,
  DOCTOR: doctorNav,
  RECEPTION: receptionNav,
  PHARMACIST: pharmacistNav,
  LAB_TECH: labTechNav,
  PATIENT: patientNav,
}

export function getNavForRole(role: UserRole): RoleNavConfig {
  return roleNavMap[role] || branchAdminNav
}
