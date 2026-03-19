/**
 * Insurance & TPA (Third Party Administrator) Claims Module
 *
 * Handles insurance claim lifecycle for Indian healthcare:
 * - Cashless: Pre-auth → Treatment → Claim submission → Settlement
 * - Reimbursement: Treatment → Bill → Patient submits to insurer
 *
 * Common TPAs in India: Medi Assist, Paramount Health, Raksha TPA,
 * FHPL, MD India, Star Health, ICICI Lombard, etc.
 */

export type ClaimType = "cashless" | "reimbursement"
export type ClaimStatus =
  | "pre_auth_pending"
  | "pre_auth_approved"
  | "pre_auth_rejected"
  | "treatment_ongoing"
  | "claim_submitted"
  | "claim_under_review"
  | "claim_approved"
  | "claim_partially_approved"
  | "claim_rejected"
  | "settled"

export interface InsuranceInfo {
  provider: string          // e.g., "Star Health", "ICICI Lombard"
  policy_number: string
  policy_holder_name: string
  relationship: "self" | "spouse" | "child" | "parent" | "other"
  tpa_name?: string         // e.g., "Medi Assist", "Paramount Health"
  tpa_id?: string
  sum_insured?: number
  valid_from?: string
  valid_to?: string
  card_number?: string      // Health card number
  group_policy?: boolean    // Corporate/group policy
  employer_name?: string
}

export interface InsuranceClaim {
  claim_id: string
  tenant_id: string
  patient_phone: string
  patient_name: string
  admission_id?: string
  invoice_id?: string

  // Insurance details
  insurance: InsuranceInfo
  claim_type: ClaimType

  // Financial
  total_bill_amount: number
  approved_amount?: number
  settled_amount?: number
  patient_copay?: number
  deductions?: ClaimDeduction[]

  // Status tracking
  status: ClaimStatus
  pre_auth_number?: string
  claim_number?: string

  // Dates
  submitted_at?: string
  approved_at?: string
  settled_at?: string

  // Documents
  documents?: ClaimDocument[]

  // Notes / communication
  tpa_remarks?: string
  hospital_remarks?: string

  created_at?: string
  updated_at?: string
}

export interface ClaimDeduction {
  reason: string
  amount: number
}

export interface ClaimDocument {
  name: string
  type: "discharge_summary" | "bill" | "investigation" | "prescription" | "id_proof" | "policy_copy" | "other"
  url?: string
  uploaded_at?: string
}

// ─── Status Configuration ──────────────────────────────────────────────

export const CLAIM_STATUS_CONFIG: Record<ClaimStatus, {
  label: string
  color: string
  description: string
}> = {
  pre_auth_pending: {
    label: "Pre-Auth Pending",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    description: "Pre-authorization request sent to TPA, awaiting approval",
  },
  pre_auth_approved: {
    label: "Pre-Auth Approved",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    description: "Pre-authorization approved — proceed with cashless treatment",
  },
  pre_auth_rejected: {
    label: "Pre-Auth Rejected",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    description: "Pre-authorization rejected by TPA — patient must pay or appeal",
  },
  treatment_ongoing: {
    label: "Treatment Ongoing",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    description: "Patient under treatment with approved cashless coverage",
  },
  claim_submitted: {
    label: "Claim Submitted",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    description: "Final claim submitted to TPA with all documents",
  },
  claim_under_review: {
    label: "Under Review",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    description: "TPA is reviewing the claim and documents",
  },
  claim_approved: {
    label: "Claim Approved",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    description: "Full claim amount approved for settlement",
  },
  claim_partially_approved: {
    label: "Partially Approved",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    description: "Partial amount approved — some deductions applied",
  },
  claim_rejected: {
    label: "Claim Rejected",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    description: "Claim rejected — patient must pay full amount",
  },
  settled: {
    label: "Settled",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    description: "Payment received from TPA — claim closed",
  },
}

// ─── Common Indian TPAs ────────────────────────────────────────────────

export const COMMON_TPAS = [
  "Medi Assist",
  "Paramount Health Services",
  "Raksha TPA",
  "FHPL (Family Health Plan Limited)",
  "MD India Healthcare",
  "Vidal Health (TTK Healthcare)",
  "Heritage Health Insurance TPA",
  "Medsave Health Insurance TPA",
  "East West Assist",
  "Anmol Medicare",
  "United Healthcare",
  "Good Health Insurance TPA",
  "Park Mediclaim",
  "Genins India",
  "Direct insurer (no TPA)",
] as const

export const COMMON_INSURERS = [
  "Star Health Insurance",
  "ICICI Lombard",
  "Bajaj Allianz",
  "HDFC ERGO",
  "Niva Bupa (Max Bupa)",
  "Care Health Insurance",
  "New India Assurance",
  "United India Insurance",
  "Oriental Insurance",
  "National Insurance",
  "SBI General Insurance",
  "Tata AIG",
  "Aditya Birla Health Insurance",
  "Manipal Cigna",
  "Reliance General Insurance",
  "Cholamandalam MS",
  "IFFCO Tokio",
  "Royal Sundaram",
  "Kotak Mahindra General Insurance",
] as const

// ─── Required Documents per Claim Type ─────────────────────────────────

export const REQUIRED_DOCUMENTS: Record<ClaimType, ClaimDocument["type"][]> = {
  cashless: [
    "discharge_summary",
    "bill",
    "investigation",
    "prescription",
    "id_proof",
  ],
  reimbursement: [
    "discharge_summary",
    "bill",
    "investigation",
    "prescription",
    "id_proof",
    "policy_copy",
  ],
}

/**
 * Check what documents are missing for a claim submission.
 */
export function getMissingDocuments(claim: InsuranceClaim): ClaimDocument["type"][] {
  const required = REQUIRED_DOCUMENTS[claim.claim_type]
  const uploaded = (claim.documents || []).map((d) => d.type)
  return required.filter((r) => !uploaded.includes(r))
}

/**
 * Calculate patient's out-of-pocket based on claim.
 */
export function calculatePatientLiability(claim: InsuranceClaim): number {
  if (claim.status === "settled" && claim.settled_amount != null) {
    return Math.max(0, claim.total_bill_amount - claim.settled_amount)
  }
  if (claim.approved_amount != null) {
    return Math.max(0, claim.total_bill_amount - claim.approved_amount)
  }
  if (claim.patient_copay != null) {
    return claim.patient_copay
  }
  return claim.total_bill_amount
}
