/**
 * ABDM (Ayushman Bharat Digital Mission) Configuration
 *
 * Environments:
 *   - Sandbox: https://dev.abdm.gov.in
 *   - Production: https://live.abdm.gov.in
 *
 * ABDM Gateway APIs used:
 *   - ABHA creation & verification
 *   - Health Information Exchange (HIE-CM)
 *   - Consent management
 *   - Health data push (HIP) / pull (HIU)
 */

export const ABDM_ENDPOINTS = {
  sandbox: {
    gateway: "https://dev.abdm.gov.in/gateway",
    abha: "https://abhasbx.abdm.gov.in/abha/api/v3",
    hiecm: "https://dev.abdm.gov.in/cm",
    auth: "https://dev.abdm.gov.in/gateway/v0.5/sessions",
  },
  production: {
    gateway: "https://live.abdm.gov.in/gateway",
    abha: "https://abha.abdm.gov.in/abha/api/v3",
    hiecm: "https://live.abdm.gov.in/cm",
    auth: "https://live.abdm.gov.in/gateway/v0.5/sessions",
  },
} as const

export type AbdmEnvironment = keyof typeof ABDM_ENDPOINTS

export interface AbdmConfig {
  environment: AbdmEnvironment
  clientId: string
  clientSecret: string
  facilityId: string    // HFR ID
  hipId: string         // Health Information Provider
  hiuId: string         // Health Information User
}

// ABHA number format: XX-XXXX-XXXX-XXXX (14 digits)
export function formatAbhaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length !== 14) return raw
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`
}

export function isValidAbhaNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits.length === 14
}

export function isValidAbhaAddress(value: string): boolean {
  // Format: username@abdm or username@sbx (sandbox)
  return /^[a-zA-Z0-9._]+@(abdm|sbx)$/.test(value)
}

// Health Information types supported by ABDM
export const HEALTH_INFO_TYPES = [
  { value: "OPConsultation", label: "OP Consultation" },
  { value: "Prescription", label: "Prescription" },
  { value: "DischargeSummary", label: "Discharge Summary" },
  { value: "DiagnosticReport", label: "Diagnostic Report (Lab)" },
  { value: "ImmunizationRecord", label: "Immunization Record" },
  { value: "HealthDocumentRecord", label: "Health Document" },
  { value: "WellnessRecord", label: "Wellness Record" },
] as const

// Consent purpose codes per ABDM spec
export const CONSENT_PURPOSES = [
  { code: "CAREMGT", label: "Care Management", description: "Treatment and care coordination" },
  { code: "BTGACCESS", label: "Break the Glass", description: "Emergency access" },
  { code: "PUBHLTH", label: "Public Health", description: "Disease reporting and surveillance" },
  { code: "HPAYMT", label: "Healthcare Payment", description: "Insurance claims and billing" },
  { code: "DSRCH", label: "Disease Research", description: "Clinical research purposes" },
] as const

export function getEndpoints(env: AbdmEnvironment) {
  return ABDM_ENDPOINTS[env]
}
