import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getGatewayToken, requestAbhaOtp, verifyAbhaOtp } from "@/lib/abdm/abha"
import { buildConsentArtifact, generateConsentId } from "@/lib/abdm/consent"
import {
  buildOPConsultationBundle,
  buildPrescriptionBundle,
  buildDischargeSummaryBundle,
  buildDiagnosticReportBundle,
} from "@/lib/abdm/fhir"
import type { AbdmConfig } from "@/lib/abdm/config"
import type { HealthConsent, HealthInfoType } from "@/types/database"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getAbdmConfig(tenantId: string): Promise<AbdmConfig | null> {
  const { data } = await supabase
    .from("tenants")
    .select("abdm_enabled, abdm_facility_id, abdm_hip_id, abdm_hiu_id, abdm_client_id, abdm_client_secret, abdm_environment")
    .eq("tenant_id", tenantId)
    .single()

  if (!data?.abdm_enabled || !data.abdm_client_id || !data.abdm_client_secret) return null

  return {
    environment: data.abdm_environment || "sandbox",
    clientId: data.abdm_client_id,
    clientSecret: data.abdm_client_secret,
    facilityId: data.abdm_facility_id || "",
    hipId: data.abdm_hip_id || "",
    hiuId: data.abdm_hiu_id || "",
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, tenantId } = body

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 })
    }

    switch (action) {
      // ── ABHA Verification ──────────────────────────────────────────────────
      case "request-otp": {
        const config = await getAbdmConfig(tenantId)
        if (!config) return NextResponse.json({ error: "ABDM not configured for this facility" }, { status: 400 })

        const { abhaNumber, abhaAddress, authMethod } = body
        const token = await getGatewayToken(config)
        const result = await requestAbhaOtp(config, token.accessToken, {
          abhaNumber,
          abhaAddress,
          authMethod: authMethod || "MOBILE_OTP",
        })
        return NextResponse.json(result)
      }

      case "verify-otp": {
        const config = await getAbdmConfig(tenantId)
        if (!config) return NextResponse.json({ error: "ABDM not configured for this facility" }, { status: 400 })

        const { txnId, otp, patientPhone } = body
        const token = await getGatewayToken(config)
        const profile = await verifyAbhaOtp(config, token.accessToken, { txnId, otp })

        // Link ABHA to patient record
        if (patientPhone) {
          await supabase
            .from("patients")
            .update({
              abha_number: profile.abhaNumber,
              abha_address: profile.abhaAddress,
              abha_status: "verified",
            })
            .eq("phone", patientPhone)
        }

        return NextResponse.json({ profile, linked: !!patientPhone })
      }

      // ── Manual ABHA Link (without verification — for demo/testing) ────────
      case "link-abha": {
        const { patientPhone, abhaNumber, abhaAddress } = body
        if (!patientPhone || !abhaNumber) {
          return NextResponse.json({ error: "patientPhone and abhaNumber required" }, { status: 400 })
        }

        const { error } = await supabase
          .from("patients")
          .update({
            abha_number: abhaNumber.replace(/\D/g, ""),
            abha_address: abhaAddress || null,
            abha_status: "linked",
          })
          .eq("phone", patientPhone)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      case "unlink-abha": {
        const { patientPhone: unlinkPhone } = body
        if (!unlinkPhone) return NextResponse.json({ error: "patientPhone required" }, { status: 400 })

        await supabase
          .from("patients")
          .update({ abha_number: null, abha_address: null, abha_status: "not_linked" })
          .eq("phone", unlinkPhone)

        return NextResponse.json({ success: true })
      }

      // ── Consent Management ─────────────────────────────────────────────────
      case "create-consent": {
        const { patientPhone, patientAbha, purpose, hiTypes, dateRangeFrom, dateRangeTo, expiry, requesterName } = body

        const consent: HealthConsent = {
          consent_id: generateConsentId(),
          tenant_id: tenantId,
          patient_phone: patientPhone,
          patient_abha: patientAbha,
          requester_name: requesterName || "Self",
          purpose: purpose || "CAREMGT",
          hi_types: hiTypes || ["OPConsultation", "Prescription"],
          date_range_from: dateRangeFrom,
          date_range_to: dateRangeTo,
          expiry: expiry || new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
          status: "REQUESTED",
          created_at: new Date().toISOString(),
        }

        const { error } = await supabase.from("health_consents").insert(consent)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ consent_id: consent.consent_id })
      }

      case "update-consent": {
        const { consentId, status: consentStatus } = body
        if (!consentId || !consentStatus) {
          return NextResponse.json({ error: "consentId and status required" }, { status: 400 })
        }

        const updates: Record<string, unknown> = { status: consentStatus }
        if (consentStatus === "GRANTED") updates.granted_at = new Date().toISOString()
        if (consentStatus === "DENIED") updates.denied_at = new Date().toISOString()
        if (consentStatus === "REVOKED") updates.revoked_at = new Date().toISOString()

        const { error } = await supabase
          .from("health_consents")
          .update(updates)
          .eq("consent_id", consentId)
          .eq("tenant_id", tenantId)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      case "list-consents": {
        const { patientPhone: consentPhone } = body
        let query = supabase
          .from("health_consents")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })

        if (consentPhone) query = query.eq("patient_phone", consentPhone)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ consents: data || [] })
      }

      // ── FHIR Health Record Generation ──────────────────────────────────────
      case "generate-health-record": {
        const { recordType, sourceId, patientPhone: recordPhone } = body

        // Fetch patient
        const { data: patient } = await supabase
          .from("patients")
          .select("*")
          .eq("phone", recordPhone)
          .single()

        if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

        // Fetch tenant for hospital name
        const { data: tenant } = await supabase
          .from("tenants")
          .select("hospital_name, abdm_facility_id, abdm_hip_id")
          .eq("tenant_id", tenantId)
          .single()

        const hospitalName = tenant?.hospital_name || "Hospital"
        let bundle: Record<string, unknown> | null = null

        switch (recordType as HealthInfoType) {
          case "OPConsultation": {
            const { data: note } = await supabase
              .from("clinical_notes")
              .select("*")
              .eq("id", sourceId)
              .single()
            if (note) {
              bundle = buildOPConsultationBundle(patient, note, hospitalName, note.doctor_name || "Doctor")
            }
            break
          }
          case "Prescription": {
            const { data: rx } = await supabase
              .from("prescriptions")
              .select("*")
              .eq("prescription_id", sourceId)
              .single()
            if (rx) {
              bundle = buildPrescriptionBundle(patient, rx, hospitalName)
            }
            break
          }
          case "DischargeSummary": {
            const { data: admission } = await supabase
              .from("admissions")
              .select("*")
              .eq("admission_id", sourceId)
              .single()
            if (admission) {
              bundle = buildDischargeSummaryBundle(patient, admission, hospitalName, admission.doctor_name || "Doctor")
            }
            break
          }
          case "DiagnosticReport": {
            const { data: lab } = await supabase
              .from("lab_orders")
              .select("*")
              .eq("order_id", sourceId)
              .single()
            if (lab) {
              bundle = buildDiagnosticReportBundle(patient, lab, hospitalName)
            }
            break
          }
          default:
            return NextResponse.json({ error: `Unsupported record type: ${recordType}` }, { status: 400 })
        }

        if (!bundle) return NextResponse.json({ error: "Source record not found" }, { status: 404 })

        // Save to health_records table
        const record = {
          record_id: `HR-${Date.now()}`,
          tenant_id: tenantId,
          patient_phone: recordPhone,
          patient_abha: patient.abha_number || null,
          record_type: recordType,
          title: `${recordType} — ${new Date().toLocaleDateString("en-IN")}`,
          fhir_bundle: bundle,
          source_id: sourceId,
          source_type: recordType,
          created_at: new Date().toISOString(),
        }

        await supabase.from("health_records").insert(record)

        return NextResponse.json({ record_id: record.record_id, bundle })
      }

      case "list-health-records": {
        const { patientPhone: hrPhone, recordType: hrType } = body
        let query = supabase
          .from("health_records")
          .select("record_id, record_type, title, source_id, source_type, created_at, shared_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })

        if (hrPhone) query = query.eq("patient_phone", hrPhone)
        if (hrType) query = query.eq("record_type", hrType)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ records: data || [] })
      }

      // ── Consent Artifact (for ABDM gateway push) ──────────────────────────
      case "get-consent-artifact": {
        const { consentId: artifactConsentId } = body
        const config = await getAbdmConfig(tenantId)

        const { data: consent } = await supabase
          .from("health_consents")
          .select("*")
          .eq("consent_id", artifactConsentId)
          .single()

        if (!consent) return NextResponse.json({ error: "Consent not found" }, { status: 404 })

        const artifact = buildConsentArtifact(
          consent,
          config?.facilityId || "",
          config?.hipId || ""
        )

        return NextResponse.json({ artifact })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error("[ABDM API]", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
