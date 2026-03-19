/**
 * Operation Theatre (OT) Scheduling Types
 *
 * Manages surgical scheduling, pre-op checklists, and OT resource allocation.
 */

export type OTStatus = "available" | "in_use" | "cleaning" | "maintenance"
export type SurgeryStatus = "scheduled" | "pre_op" | "in_progress" | "post_op" | "completed" | "cancelled"
export type SurgeryPriority = "emergency" | "urgent" | "elective"

export interface OperationTheatre {
  ot_id: string
  tenant_id: string
  name: string // e.g., "OT-1", "OT-2 (Minor)"
  type: "major" | "minor" | "day_care"
  status: OTStatus
  equipment?: string[] // e.g., ["laparoscope", "c-arm"]
}

export interface SurgerySchedule {
  surgery_id: string
  tenant_id: string
  ot_id: string
  patient_name: string
  patient_phone: string
  admission_id?: string

  // Surgery details
  procedure_name: string
  procedure_code?: string // ICD-10 PCS or custom
  surgery_type: SurgeryPriority
  estimated_duration_min: number

  // Team
  surgeon_name: string
  surgeon_id: string
  anesthetist_name?: string
  anesthetist_id?: string
  assistant_names?: string[]

  // Schedule
  scheduled_date: string // YYYY-MM-DD
  scheduled_time: string // HH:MM
  actual_start?: string
  actual_end?: string

  // Status
  status: SurgeryStatus
  notes?: string
  complications?: string

  // Pre-op
  pre_op_checklist?: PreOpChecklist
  consent_obtained?: boolean
  consent_timestamp?: string

  created_at?: string
  updated_at?: string
}

export interface PreOpChecklist {
  patient_identity_verified: boolean
  consent_signed: boolean
  site_marked: boolean
  allergies_reviewed: boolean
  blood_group_confirmed: boolean
  npo_status: boolean // nil per os — fasting confirmed
  iv_access: boolean
  pre_op_medications_given: boolean
  blood_products_available: boolean
  imaging_available: boolean
  anesthesia_assessment_done: boolean
  notes?: string
}

export const PRE_OP_CHECKLIST_ITEMS: { key: keyof Omit<PreOpChecklist, "notes">; label: string; critical: boolean }[] = [
  { key: "patient_identity_verified", label: "Patient identity verified (name band + verbal)", critical: true },
  { key: "consent_signed", label: "Informed consent signed by patient/guardian", critical: true },
  { key: "site_marked", label: "Surgical site marked", critical: true },
  { key: "allergies_reviewed", label: "Allergies reviewed and documented", critical: true },
  { key: "blood_group_confirmed", label: "Blood group confirmed", critical: true },
  { key: "npo_status", label: "NPO (fasting) status confirmed", critical: true },
  { key: "iv_access", label: "IV access secured", critical: false },
  { key: "pre_op_medications_given", label: "Pre-op medications administered", critical: false },
  { key: "blood_products_available", label: "Blood products available (if needed)", critical: false },
  { key: "imaging_available", label: "Imaging/reports available in OT", critical: false },
  { key: "anesthesia_assessment_done", label: "Anesthesia assessment completed", critical: true },
]

export const SURGERY_STATUS_CONFIG: Record<SurgeryStatus, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  pre_op: { label: "Pre-Op", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  in_progress: { label: "In Progress", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  post_op: { label: "Post-Op", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
}

export const OT_STATUS_CONFIG: Record<OTStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "bg-emerald-100 text-emerald-700" },
  in_use: { label: "In Use", color: "bg-red-100 text-red-700" },
  cleaning: { label: "Cleaning", color: "bg-amber-100 text-amber-700" },
  maintenance: { label: "Maintenance", color: "bg-muted text-muted-foreground" },
}

/**
 * Default empty pre-op checklist
 */
export function createEmptyChecklist(): PreOpChecklist {
  return {
    patient_identity_verified: false,
    consent_signed: false,
    site_marked: false,
    allergies_reviewed: false,
    blood_group_confirmed: false,
    npo_status: false,
    iv_access: false,
    pre_op_medications_given: false,
    blood_products_available: false,
    imaging_available: false,
    anesthesia_assessment_done: false,
  }
}

/**
 * Check if all critical pre-op checklist items are done.
 */
export function isPreOpComplete(checklist: PreOpChecklist): boolean {
  return PRE_OP_CHECKLIST_ITEMS
    .filter((item) => item.critical)
    .every((item) => checklist[item.key] === true)
}

/**
 * Get pre-op completion percentage.
 */
export function getPreOpProgress(checklist: PreOpChecklist): number {
  const total = PRE_OP_CHECKLIST_ITEMS.length
  const done = PRE_OP_CHECKLIST_ITEMS.filter((item) => checklist[item.key] === true).length
  return Math.round((done / total) * 100)
}
