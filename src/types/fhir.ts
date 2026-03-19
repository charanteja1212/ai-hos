/**
 * FHIR R4 resource type mappings for AI-HOS data model.
 * Maps internal database schema to HL7 FHIR standard resources.
 *
 * Reference: https://hl7.org/fhir/R4/
 */

// ─── FHIR Patient Resource ─────────────────────────────────────────────────

export interface FHIRPatient {
  resourceType: "Patient"
  id: string
  identifier: Array<{
    system: string
    value: string
    type?: { coding: Array<{ system: string; code: string }> }
  }>
  name: Array<{
    use: "official" | "usual"
    text: string
    given?: string[]
    family?: string
  }>
  telecom: Array<{
    system: "phone" | "email"
    value: string
    use: "mobile" | "home" | "work"
  }>
  gender?: "male" | "female" | "other" | "unknown"
  birthDate?: string
  address?: Array<{
    use: "home"
    text: string
  }>
}

// ─── FHIR Encounter (Appointment/Visit) ────────────────────────────────────

export interface FHIREncounter {
  resourceType: "Encounter"
  id: string
  status: "planned" | "arrived" | "in-progress" | "finished" | "cancelled"
  class: {
    system: "http://terminology.hl7.org/CodeSystem/v3-ActCode"
    code: "AMB" | "IMP" | "EMER"
    display: "ambulatory" | "inpatient" | "emergency"
  }
  subject: { reference: string; display: string }
  participant: Array<{
    individual: { reference: string; display: string }
    type?: Array<{ coding: Array<{ code: string }> }>
  }>
  period: {
    start: string
    end?: string
  }
}

// ─── FHIR Observation (Vitals) ──────────────────────────────────────────────

export interface FHIRObservation {
  resourceType: "Observation"
  id: string
  status: "final" | "preliminary" | "amended"
  category: Array<{
    coding: Array<{
      system: "http://terminology.hl7.org/CodeSystem/observation-category"
      code: "vital-signs"
    }>
  }>
  code: {
    coding: Array<{
      system: "http://loinc.org"
      code: string
      display: string
    }>
  }
  subject: { reference: string }
  effectiveDateTime: string
  valueQuantity?: {
    value: number
    unit: string
    system: "http://unitsofmeasure.org"
    code: string
  }
  component?: Array<{
    code: { coding: Array<{ system: string; code: string; display: string }> }
    valueQuantity: { value: number; unit: string }
  }>
}

// ─── FHIR MedicationRequest (Prescription) ──────────────────────────────────

export interface FHIRMedicationRequest {
  resourceType: "MedicationRequest"
  id: string
  status: "active" | "completed" | "stopped"
  intent: "order"
  medicationCodeableConcept: {
    text: string
  }
  subject: { reference: string }
  requester: { reference: string; display: string }
  dosageInstruction: Array<{
    text: string
    timing?: { repeat?: { frequency: number; period: number; periodUnit: string } }
    doseAndRate?: Array<{ doseQuantity?: { value: number; unit: string } }>
  }>
  dispenseRequest?: {
    numberOfRepeatsAllowed?: number
    quantity?: { value: number; unit: string }
  }
}

// ─── FHIR DiagnosticReport (Lab Result) ─────────────────────────────────────

export interface FHIRDiagnosticReport {
  resourceType: "DiagnosticReport"
  id: string
  status: "registered" | "partial" | "preliminary" | "final"
  category: Array<{
    coding: Array<{ system: string; code: string; display: string }>
  }>
  code: { text: string }
  subject: { reference: string }
  effectiveDateTime: string
  result: Array<{ reference: string }>
}

// ─── Mapping functions (AI-HOS → FHIR) ─────────────────────────────────────

/**
 * Map internal patient record to FHIR Patient resource.
 */
export function toFHIRPatient(patient: {
  phone: string
  name: string
  age?: number | null
  gender?: string | null
  email?: string | null
  address?: string | null
  abha_number?: string | null
}): FHIRPatient {
  const identifiers: FHIRPatient["identifier"] = [
    { system: "urn:ai-hos:phone", value: patient.phone },
  ]
  if (patient.abha_number) {
    identifiers.push({
      system: "https://healthid.ndhm.gov.in",
      value: patient.abha_number,
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR" }] },
    })
  }

  const telecom: FHIRPatient["telecom"] = [
    { system: "phone", value: patient.phone, use: "mobile" },
  ]
  if (patient.email) {
    telecom.push({ system: "email", value: patient.email, use: "home" })
  }

  return {
    resourceType: "Patient",
    id: patient.phone,
    identifier: identifiers,
    name: [{ use: "official", text: patient.name }],
    telecom,
    gender: mapGender(patient.gender),
    address: patient.address ? [{ use: "home", text: patient.address }] : undefined,
  }
}

/**
 * Map internal vitals to FHIR Observation resources (one per vital sign).
 */
export function toFHIRVitals(vitals: {
  id?: string
  bp_systolic?: number | null
  bp_diastolic?: number | null
  pulse?: number | null
  temperature?: number | null
  spo2?: number | null
  weight?: number | null
  recorded_at?: string
  patient_phone?: string
}): FHIRObservation[] {
  const observations: FHIRObservation[] = []
  const OBSERVATION_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category" as const
  const base = {
    status: "final" as const,
    category: [{ coding: [{ system: OBSERVATION_CATEGORY, code: "vital-signs" as const }] }],
    subject: { reference: `Patient/${vitals.patient_phone || "unknown"}` },
    effectiveDateTime: vitals.recorded_at || new Date().toISOString(),
  }

  if (vitals.bp_systolic != null && vitals.bp_diastolic != null) {
    observations.push({
      ...base,
      resourceType: "Observation",
      id: `${vitals.id}-bp`,
      code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure" }] },
      component: [
        { code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic" }] }, valueQuantity: { value: vitals.bp_systolic, unit: "mmHg" } },
        { code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic" }] }, valueQuantity: { value: vitals.bp_diastolic, unit: "mmHg" } },
      ],
    })
  }

  if (vitals.pulse != null) {
    observations.push({
      ...base,
      resourceType: "Observation",
      id: `${vitals.id}-pulse`,
      code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] },
      valueQuantity: { value: vitals.pulse, unit: "beats/min", system: "http://unitsofmeasure.org", code: "/min" },
    })
  }

  if (vitals.temperature != null) {
    observations.push({
      ...base,
      resourceType: "Observation",
      id: `${vitals.id}-temp`,
      code: { coding: [{ system: "http://loinc.org", code: "8310-5", display: "Body temperature" }] },
      valueQuantity: { value: vitals.temperature, unit: "degF", system: "http://unitsofmeasure.org", code: "[degF]" },
    })
  }

  if (vitals.spo2 != null) {
    observations.push({
      ...base,
      resourceType: "Observation",
      id: `${vitals.id}-spo2`,
      code: { coding: [{ system: "http://loinc.org", code: "2708-6", display: "Oxygen saturation" }] },
      valueQuantity: { value: vitals.spo2, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
    })
  }

  return observations
}

function mapGender(gender?: string | null): FHIRPatient["gender"] {
  if (!gender) return "unknown"
  switch (gender.toLowerCase()) {
    case "male": return "male"
    case "female": return "female"
    case "other": return "other"
    default: return "unknown"
  }
}
