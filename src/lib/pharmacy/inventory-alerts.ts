/**
 * Pharmacy Inventory Alert Utilities
 *
 * Checks for low stock, expiring soon, and expired medicines.
 * Used by both the inventory page and smart alerts system.
 */

import type { Medicine } from "@/types/database"

export type InventoryAlertType = "expired" | "expiring_soon" | "low_stock" | "out_of_stock"

export interface InventoryAlert {
  type: InventoryAlertType
  medicine: Medicine
  message: string
  severity: "critical" | "warning" | "info"
  /** Days until expiry (negative = already expired) */
  daysUntilExpiry?: number
  /** Stock as percentage of minimum */
  stockRatio?: number
}

/**
 * Analyze inventory and return all alerts sorted by severity.
 */
export function analyzeInventory(medicines: Medicine[]): InventoryAlert[] {
  const alerts: InventoryAlert[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const med of medicines) {
    // Out of stock
    if (med.stock <= 0) {
      alerts.push({
        type: "out_of_stock",
        medicine: med,
        message: `${med.medicine_name} (${med.dosage || ""}) is OUT OF STOCK`,
        severity: "critical",
        stockRatio: 0,
      })
      continue
    }

    // Low stock (at or below minimum)
    if (med.min_stock > 0 && med.stock <= med.min_stock) {
      const ratio = med.stock / med.min_stock
      alerts.push({
        type: "low_stock",
        medicine: med,
        message: `${med.medicine_name} (${med.dosage || ""}) has only ${med.stock} units left (min: ${med.min_stock})`,
        severity: ratio <= 0.25 ? "critical" : "warning",
        stockRatio: ratio,
      })
    }

    // Expiry check
    if (med.expiry_date) {
      const expiry = new Date(med.expiry_date)
      expiry.setHours(0, 0, 0, 0)
      const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

      if (daysUntil < 0) {
        alerts.push({
          type: "expired",
          medicine: med,
          message: `${med.medicine_name} (${med.dosage || ""}) EXPIRED ${Math.abs(daysUntil)} days ago — remove from inventory`,
          severity: "critical",
          daysUntilExpiry: daysUntil,
        })
      } else if (daysUntil <= 30) {
        alerts.push({
          type: "expiring_soon",
          medicine: med,
          message: `${med.medicine_name} (${med.dosage || ""}) expires in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} (${med.stock} units)`,
          severity: daysUntil <= 7 ? "critical" : "warning",
          daysUntilExpiry: daysUntil,
        })
      }
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

/**
 * Generate reorder suggestions for low stock items.
 * Suggests ordering 3x the minimum stock level.
 */
export function getReorderSuggestions(medicines: Medicine[]): Array<{
  medicine: Medicine
  suggestedQuantity: number
  urgency: "immediate" | "soon" | "routine"
}> {
  return medicines
    .filter((m) => m.min_stock > 0 && m.stock <= m.min_stock)
    .map((m) => {
      const ratio = m.stock / m.min_stock
      return {
        medicine: m,
        suggestedQuantity: Math.max(m.min_stock * 3, 50),
        urgency: ratio <= 0 ? "immediate" as const : ratio <= 0.25 ? "soon" as const : "routine" as const,
      }
    })
    .sort((a, b) => {
      const order = { immediate: 0, soon: 1, routine: 2 }
      return order[a.urgency] - order[b.urgency]
    })
}

/**
 * Get a summary of inventory health.
 */
export function getInventoryHealthScore(medicines: Medicine[]): {
  score: number // 0-100
  label: string
  color: string
} {
  if (medicines.length === 0) return { score: 100, label: "No inventory", color: "text-muted-foreground" }

  const alerts = analyzeInventory(medicines)
  const critical = alerts.filter((a) => a.severity === "critical").length
  const warnings = alerts.filter((a) => a.severity === "warning").length

  // Deduct points for issues
  const deductions = (critical * 15) + (warnings * 5)
  const score = Math.max(0, Math.min(100, 100 - deductions))

  if (score >= 80) return { score, label: "Healthy", color: "text-emerald-600" }
  if (score >= 60) return { score, label: "Needs Attention", color: "text-amber-600" }
  if (score >= 40) return { score, label: "At Risk", color: "text-orange-600" }
  return { score, label: "Critical", color: "text-red-600" }
}
