/**
 * FHIR R4 Bundle Builder for ABDM Health Records
 *
 * Converts internal data models to FHIR R4 bundles as required by ABDM HIE-CM.
 * Supports: OPConsultation, Prescription, DischargeSummary, DiagnosticReport
 */

import type { Prescription, Admission, LabOrder, ClinicalNote, Patient } from "@/types/database"

function uuid() {
  return crypto.randomUUID()
}

function fhirDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString()
  return new Date(dateStr).toISOString()
}

// Build a FHIR Patient resource from our Patient model
function buildPatientResource(patient: Patient, abhaNumber?: string) {
  return {
    resourceType: "Patient",
    id: uuid(),
    identifier: [
      ...(abhaNumber ? [{
        type: { coding: [{ system: "https://healthid.abdm.gov.in", code: "ABHA" }] },
        system: "https://healthid.abdm.gov.in",
        value: abhaNumber,
      }] : []),
      {
        type: { coding: [{ system: "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code", code: "MR" }] },
        system: "urn:hospital:mrn",
        value: patient.phone,
      },
    ],
    name: [{ text: patient.name, use: "official" }],
    gender: mapGender(patient.gender),
    birthDate: patient.date_of_birth || undefined,
    telecom: [
      { system: "phone", value: patient.phone, use: "mobile" },
      ...(patient.email ? [{ system: "email", value: patient.email }] : []),
    ],
    address: patient.address ? [{ text: patient.address, use: "home" }] : undefined,
  }
}

function mapGender(gender?: string): string {
  if (!gender) return "unknown"
  const g = gender.toLowerCase()
  if (g === "male" || g === "m") return "male"
  if (g === "female" || g === "f") return "female"
  if (g === "other") return "other"
  return "unknown"
}

// Build FHIR Bundle for OP Consultation
export function buildOPConsultationBundle(
  patient: Patient,
  note: ClinicalNote,
  hospitalName: string,
  doctorName: string
): Record<string, unknown> {
  const patientResource = buildPatientResource(patient, patient.abha_number)
  const patientRef = `Patient/${patientResource.id}`

  const practitionerResource = {
    resourceType: "Practitioner",
    id: uuid(),
    name: [{ text: doctorName }],
  }

  const encounterResource = {
    resourceType: "Encounter",
    id: uuid(),
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    subject: { reference: patientRef },
    period: {
      start: fhirDate(note.created_at),
      end: fhirDate(note.updated_at || note.created_at),
    },
  }

  const conditionResource = note.assessment ? {
    resourceType: "Condition",
    id: uuid(),
    code: { text: note.assessment },
    subject: { reference: patientRef },
    encounter: { reference: `Encounter/${encounterResource.id}` },
    recordedDate: fhirDate(note.created_at),
  } : null

  const compositionResource = {
    resourceType: "Composition",
    id: uuid(),
    status: "final",
    type: {
      coding: [{
        system: "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-document-type",
        code: "OPConsultRecord",
        display: "OP Consultation Record",
      }],
    },
    subject: { reference: patientRef },
    date: fhirDate(note.created_at),
    author: [{ reference: `Practitioner/${practitionerResource.id}` }],
    title: "OP Consultation Record",
    section: [
      ...(note.chief_complaint ? [{
        title: "Chief Complaint",
        code: { coding: [{ system: "http://snomed.info/sct", code: "422843007" }] },
        entry: [{ display: note.chief_complaint }],
      }] : []),
      ...(note.subjective ? [{
        title: "History of Present Illness",
        entry: [{ display: note.subjective }],
      }] : []),
      ...(note.objective ? [{
        title: "Physical Examination",
        entry: [{ display: note.objective }],
      }] : []),
      ...(note.assessment ? [{
        title: "Assessment",
        entry: [{ reference: conditionResource ? `Condition/${conditionResource.id}` : undefined, display: note.assessment }],
      }] : []),
      ...(note.plan ? [{
        title: "Plan of Treatment",
        entry: [{ display: note.plan }],
      }] : []),
    ],
  }

  const entries = [
    compositionResource,
    patientResource,
    practitionerResource,
    encounterResource,
    ...(conditionResource ? [conditionResource] : []),
  ]

  return {
    resourceType: "Bundle",
    id: uuid(),
    meta: { lastUpdated: new Date().toISOString() },
    type: "document",
    timestamp: new Date().toISOString(),
    entry: entries.map((resource) => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource,
    })),
  }
}

// Build FHIR Bundle for Prescription
export function buildPrescriptionBundle(
  patient: Patient,
  prescription: Prescription,
  hospitalName: string
): Record<string, unknown> {
  const patientResource = buildPatientResource(patient, patient.abha_number)
  const patientRef = `Patient/${patientResource.id}`

  const practitionerResource = {
    resourceType: "Practitioner",
    id: uuid(),
    name: [{ text: prescription.doctor_name }],
  }

  const medicationRequests = prescription.items.map((item) => ({
    resourceType: "MedicationRequest",
    id: uuid(),
    status: "active",
    intent: "order",
    medicationCodeableConcept: { text: item.medicine_name },
    subject: { reference: patientRef },
    authoredOn: fhirDate(prescription.created_at),
    requester: { reference: `Practitioner/${practitionerResource.id}` },
    dosageInstruction: [{
      text: `${item.dosage} — ${item.frequency} — ${item.duration}`,
      timing: { code: { text: item.frequency } },
      doseAndRate: [{ doseQuantity: { value: 1, unit: item.dosage } }],
    }],
    note: item.notes ? [{ text: item.notes }] : undefined,
  }))

  const compositionResource = {
    resourceType: "Composition",
    id: uuid(),
    status: "final",
    type: {
      coding: [{
        system: "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-document-type",
        code: "PrescriptionRecord",
        display: "Prescription",
      }],
    },
    subject: { reference: patientRef },
    date: fhirDate(prescription.created_at),
    author: [{ reference: `Practitioner/${practitionerResource.id}` }],
    title: "Prescription",
    section: [{
      title: "Medications",
      entry: medicationRequests.map((mr) => ({
        reference: `MedicationRequest/${mr.id}`,
        display: mr.medicationCodeableConcept.text,
      })),
    }],
  }

  const entries = [compositionResource, patientResource, practitionerResource, ...medicationRequests]

  return {
    resourceType: "Bundle",
    id: uuid(),
    meta: { lastUpdated: new Date().toISOString() },
    type: "document",
    timestamp: new Date().toISOString(),
    entry: entries.map((resource) => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource,
    })),
  }
}

// Build FHIR Bundle for Discharge Summary
export function buildDischargeSummaryBundle(
  patient: Patient,
  admission: Admission,
  hospitalName: string,
  doctorName: string
): Record<string, unknown> {
  const patientResource = buildPatientResource(patient, patient.abha_number)
  const patientRef = `Patient/${patientResource.id}`

  const practitionerResource = {
    resourceType: "Practitioner",
    id: uuid(),
    name: [{ text: doctorName }],
  }

  const encounterResource = {
    resourceType: "Encounter",
    id: uuid(),
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP", display: "inpatient encounter" },
    subject: { reference: patientRef },
    period: {
      start: fhirDate(admission.admission_date),
      end: fhirDate(admission.actual_discharge || admission.expected_discharge),
    },
    hospitalization: {
      admitSource: { text: admission.from_appointment ? "Referral from OPD" : "Direct admission" },
      dischargeDisposition: { text: "Discharged" },
    },
  }

  const ds = admission.discharge_summary
  const sections = [
    ...(admission.diagnosis ? [{
      title: "Admitting Diagnosis",
      entry: [{ display: admission.diagnosis }],
    }] : []),
    ...(ds?.final_diagnosis ? [{
      title: "Final Diagnosis",
      entry: [{ display: ds.final_diagnosis }],
    }] : []),
    ...(ds?.treatment_given ? [{
      title: "Treatment Summary",
      entry: [{ display: ds.treatment_given }],
    }] : []),
    ...(ds?.medications_on_discharge?.length ? [{
      title: "Medications on Discharge",
      entry: ds.medications_on_discharge.map((m) => ({
        display: `${m.medicine} — ${m.dosage} — ${m.frequency} — ${m.duration}`,
      })),
    }] : []),
    ...(ds?.follow_up_instructions ? [{
      title: "Follow-up Instructions",
      entry: [{ display: ds.follow_up_instructions }],
    }] : []),
  ]

  const compositionResource = {
    resourceType: "Composition",
    id: uuid(),
    status: "final",
    type: {
      coding: [{
        system: "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-document-type",
        code: "DischargeSummaryRecord",
        display: "Discharge Summary",
      }],
    },
    subject: { reference: patientRef },
    date: fhirDate(admission.actual_discharge),
    author: [{ reference: `Practitioner/${practitionerResource.id}` }],
    title: "Discharge Summary",
    section: sections,
  }

  const entries = [compositionResource, patientResource, practitionerResource, encounterResource]

  return {
    resourceType: "Bundle",
    id: uuid(),
    meta: { lastUpdated: new Date().toISOString() },
    type: "document",
    timestamp: new Date().toISOString(),
    entry: entries.map((resource) => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource,
    })),
  }
}

// Build FHIR Bundle for Diagnostic Report (Lab)
export function buildDiagnosticReportBundle(
  patient: Patient,
  labOrder: LabOrder,
  hospitalName: string
): Record<string, unknown> {
  const patientResource = buildPatientResource(patient, patient.abha_number)
  const patientRef = `Patient/${patientResource.id}`

  const observations = labOrder.tests.map((test) => {
    const resultData = labOrder.results?.[test.test_id] as Record<string, unknown> | undefined
    return {
      resourceType: "Observation",
      id: uuid(),
      status: test.status === "completed" ? "final" : "registered",
      code: { text: test.test_name },
      subject: { reference: patientRef },
      effectiveDateTime: fhirDate(labOrder.results_uploaded_at || labOrder.created_at),
      valueString: resultData?.value ? String(resultData.value) : undefined,
      referenceRange: resultData?.normal_range ? [{ text: String(resultData.normal_range) }] : undefined,
    }
  })

  const diagnosticReport = {
    resourceType: "DiagnosticReport",
    id: uuid(),
    status: labOrder.status === "completed" ? "final" : "registered",
    code: { text: `Lab Report — ${labOrder.tests.map((t) => t.test_name).join(", ")}` },
    subject: { reference: patientRef },
    effectiveDateTime: fhirDate(labOrder.results_uploaded_at || labOrder.created_at),
    issued: fhirDate(labOrder.results_uploaded_at),
    result: observations.map((obs) => ({
      reference: `Observation/${obs.id}`,
      display: obs.code.text,
    })),
  }

  const compositionResource = {
    resourceType: "Composition",
    id: uuid(),
    status: "final",
    type: {
      coding: [{
        system: "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-document-type",
        code: "DiagnosticReportRecord",
        display: "Diagnostic Report",
      }],
    },
    subject: { reference: patientRef },
    date: fhirDate(labOrder.results_uploaded_at || labOrder.created_at),
    title: "Diagnostic Report",
    section: [{
      title: "Lab Results",
      entry: [{ reference: `DiagnosticReport/${diagnosticReport.id}` }],
    }],
  }

  const entries = [compositionResource, patientResource, diagnosticReport, ...observations]

  return {
    resourceType: "Bundle",
    id: uuid(),
    meta: { lastUpdated: new Date().toISOString() },
    type: "document",
    timestamp: new Date().toISOString(),
    entry: entries.map((resource) => ({
      fullUrl: `urn:uuid:${resource.id}`,
      resource,
    })),
  }
}
