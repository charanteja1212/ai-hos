/**
 * ABDM Consent Management Utilities
 *
 * Manages consent artifacts for Health Information Exchange:
 * - Consent request creation (HIU side)
 * - Consent grant/deny (HIP side)
 * - Consent status tracking
 * - Consent artifact validation
 */

import type { HealthConsent, HealthInfoType } from "@/types/database"

export interface ConsentRequest {
  purpose: HealthConsent["purpose"]
  hiTypes: HealthInfoType[]
  dateRangeFrom: string
  dateRangeTo: string
  expiry: string
  requesterName: string
  patientAbha: string
}

// Build consent artifact per ABDM spec
export function buildConsentArtifact(
  consent: HealthConsent,
  facilityId: string,
  hipId: string
) {
  return {
    schemaVersion: "v1.0",
    consentId: consent.consent_id,
    createdAt: consent.created_at || new Date().toISOString(),
    purpose: {
      text: getPurposeText(consent.purpose),
      code: consent.purpose,
      refUri: `https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-purpose/${consent.purpose}`,
    },
    patient: {
      id: consent.patient_abha || consent.patient_phone,
    },
    hip: {
      type: "HIP",
      id: hipId,
    },
    hiu: {
      type: "HIU",
      id: consent.requester_id || facilityId,
      name: consent.requester_name,
    },
    consentManager: {
      id: "sbx" // sandbox CM
    },
    hiTypes: consent.hi_types,
    permission: {
      accessMode: "VIEW",
      dateRange: {
        from: consent.date_range_from || new Date(Date.now() - 365 * 24 * 3600000).toISOString(),
        to: consent.date_range_to || new Date().toISOString(),
      },
      dataEraseAt: consent.expiry || new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      frequency: {
        unit: "HOUR",
        value: 1,
        repeats: 0,
      },
    },
  }
}

function getPurposeText(code: HealthConsent["purpose"]): string {
  const map: Record<string, string> = {
    CAREMGT: "Care Management",
    BTGACCESS: "Break the Glass — Emergency Access",
    PUBHLTH: "Public Health",
    HPAYMT: "Healthcare Payment",
    DSRCH: "Disease Research",
  }
  return map[code] || code
}

// Validate consent is still active and within date range
export function isConsentValid(consent: HealthConsent): boolean {
  if (consent.status !== "GRANTED") return false
  if (consent.expiry) {
    const expiryDate = new Date(consent.expiry)
    if (expiryDate < new Date()) return false
  }
  return true
}

// Check if a specific health info type is covered by consent
export function isInfoTypeCovered(consent: HealthConsent, hiType: HealthInfoType): boolean {
  if (!isConsentValid(consent)) return false
  return consent.hi_types.includes(hiType)
}

// Generate a unique consent ID
export function generateConsentId(): string {
  return `CONS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
