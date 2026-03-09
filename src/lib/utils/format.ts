/**
 * Shared formatting utilities used across all dashboard pages.
 * Eliminates duplicated getInitials, raw status strings, unformatted phones, etc.
 */

// --- Status humanization ---

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
  pending_payment: "Pending Payment",
  no_show: "No Show",
  checked_in: "Checked In",
  in_consultation: "In Consultation",
  admitted: "Admitted",
  discharged: "Discharged",
  transferred: "Transferred",
  waiting: "Waiting",
  active: "Active",
  done: "Done",
  dispensed: "Dispensed",
  collected: "Collected",
  processing: "Processing",
  ready: "Ready",
}

export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "Unknown"
  return STATUS_LABELS[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// --- Status badge colors (centralized) ---

export const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pending_payment: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  no_show: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  waiting: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  dispensed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ready: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  collected: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
}

export const checkInColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-300",
  checked_in: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  in_consultation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  admitted: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
}

// --- Phone formatting ---

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone
}

// --- Initials ---

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

// --- Currency ---

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "\u20B90"
  return `\u20B9${amount.toLocaleString("en-IN")}`
}
