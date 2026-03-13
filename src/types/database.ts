// Database types matching Supabase schema

export interface Patient {
  phone: string
  name: string
  age?: number
  gender?: string
  email?: string
  address?: string
  date_of_birth?: string
  blood_group?: string
  allergies?: string
  chronic_diseases?: string
  emergency_contact?: string
  medical_conditions?: string
  visit_count?: number
  tenant_id?: string
  client_id?: string
  created_at?: string
  // ABDM / ABHA fields
  abha_number?: string        // 14-digit ABHA number (e.g. 91-1234-1234-1234)
  abha_address?: string       // ABHA address (e.g. user@abdm)
  abha_status?: "not_linked" | "linked" | "verified"
  health_id_number?: string   // PHR address (legacy)
}

export interface Doctor {
  doctor_id: string
  name: string
  specialty: string
  email?: string
  phone?: string
  pin?: string
  consultation_fee?: number
  status?: string
  tenant_id?: string
  client_id?: string
}

export interface Appointment {
  booking_id: string
  patient_phone: string
  patient_name: string
  patient_type?: string
  doctor_id: string
  doctor_name: string
  specialty?: string
  date: string
  time: string
  status: "confirmed" | "cancelled" | "pending_payment" | "completed" | "no_show"
  payment_status?: string
  payment_link?: string
  razorpay_payment_id?: string
  op_pass_id?: string
  booked_by_whatsapp_number?: string
  source?: string
  check_in_status?: string
  arrival_time?: string
  queue_number?: number
  consultation_start?: string
  consultation_end?: string
  follow_up_date?: string
  tenant_id?: string
  client_id?: string
  created_at?: string
}

export interface QueueEntry {
  queue_id: string
  tenant_id: string
  client_id?: string
  booking_id?: string
  patient_phone?: string
  patient_name?: string
  doctor_id?: string
  doctor_name?: string
  queue_number: number
  status: "waiting" | "in_consultation" | "completed" | "no_show" | "cancelled"
  check_in_time?: string
  consultation_start?: string
  consultation_end?: string
  estimated_wait_minutes?: number
  walk_in: boolean
  priority: number
  date: string
  notes?: string
  created_at?: string
}

// IPD sub-types for JSONB fields
export interface TransferRecord {
  id: string
  from_ward: string
  from_bed: string
  to_ward: string
  to_bed: string
  transferred_at: string
  transferred_by: string
  reason: string
}

export interface NursingNote {
  id: string
  timestamp: string
  author: string
  type: "vitals" | "observation" | "medication" | "general" | "rounds"
  vitals?: {
    bp_systolic?: number
    bp_diastolic?: number
    pulse?: number
    temperature?: number
    spo2?: number
    respiratory_rate?: number
  }
  observations?: string
  medications_given?: string[]
  note: string
  rounds?: {
    subjective?: string
    objective?: string
    assessment?: string
    plan?: string
  }
  content?: string
}

export interface DischargeSummary {
  final_diagnosis: string
  treatment_given: string
  medications_on_discharge: { medicine: string; dosage: string; frequency: string; duration: string }[]
  follow_up_instructions: string
  follow_up_date?: string
  discharged_by: string
}

export interface DailyCharge {
  date: string
  description: string
  amount: number
  category: "bed" | "medicine" | "procedure" | "consumable" | "other"
}

export interface WardConfig {
  beds: string[]
  daily_rate: number
  type: "general" | "semi_private" | "private" | "icu" | "nicu" | "maternity" | "pediatric" | "surgical"
}

export interface Admission {
  admission_id: string
  tenant_id: string
  client_id?: string
  patient_phone: string
  patient_name?: string
  doctor_id?: string
  doctor_name?: string
  ward?: string
  bed_number?: string
  diagnosis?: string
  admission_date?: string
  expected_discharge?: string
  actual_discharge?: string
  status: "admitted" | "discharged" | "transferred"
  notes?: string
  from_appointment?: string
  transfer_history?: TransferRecord[]
  nursing_notes?: NursingNote[]
  discharge_summary?: DischargeSummary | null
  daily_charges?: DailyCharge[]
  created_at?: string
}

export interface Medicine {
  medicine_id: string
  tenant_id: string
  client_id?: string
  medicine_name: string
  salt?: string
  dosage?: string
  form?: string
  stock: number
  min_stock: number
  expiry_date?: string
  price: number
  category?: string
  status?: string
  created_at?: string
}

export interface PharmacyOrder {
  order_id: string
  tenant_id: string
  client_id?: string
  prescription_id?: string
  patient_phone?: string
  patient_name?: string
  doctor_name?: string
  items: PrescriptionItem[]
  total_amount: number
  status: "pending" | "preparing" | "ready" | "dispensed"
  prepared_by?: string
  dispensed_at?: string
  created_at?: string
}

export interface PrescriptionItem {
  medicine_name: string
  dosage: string
  frequency: string
  duration: string
  quantity?: number
  notes?: string
}

export interface LabTestMaster {
  test_id: string
  tenant_id: string
  client_id?: string
  test_name: string
  category?: string
  price: number
  normal_range?: string
  unit?: string
  sample_type?: string
  turnaround_hours?: number
  status?: string
}

export interface LabOrder {
  order_id: string
  tenant_id: string
  client_id?: string
  patient_phone: string
  patient_name?: string
  doctor_id?: string
  doctor_name?: string
  booking_id?: string
  tests: { test_id: string; test_name: string; status: string }[]
  status: "ordered" | "sample_collected" | "processing" | "completed"
  sample_collected_at?: string
  results_uploaded_at?: string
  results: Record<string, unknown>
  notes?: string
  total_amount?: number
  created_at?: string
}

export interface Invoice {
  invoice_id: string
  tenant_id: string
  client_id?: string
  patient_phone: string
  patient_name?: string
  type: "consultation" | "pharmacy" | "lab" | "admission" | "procedure"
  items: { description: string; amount: number; quantity: number }[]
  subtotal: number
  tax: number
  discount: number
  total: number
  payment_status: "unpaid" | "paid" | "partial"
  payment_method?: string
  booking_id?: string
  admission_id?: string
  // GST breakdown
  cgst?: number
  sgst?: number
  igst?: number
  gst_percentage?: number
  discount_type?: "flat" | "percent"
  discount_value?: number
  gstin?: string
  hsn_code?: string
  created_at?: string
}

export interface OPPass {
  op_pass_id: string
  patient_phone: string
  patient_name: string
  patient_type: string
  booking_id: string
  valid_from: string
  valid_until: string
  reschedules_remaining: number
  qr_code_url?: string
  status: string
  tenant_id?: string
  client_id?: string
}

export interface Staff {
  staff_id: string
  tenant_id: string
  client_id?: string
  name: string
  email?: string
  phone?: string
  role: "RECEPTION" | "ADMIN" | "LAB_TECH" | "PHARMACIST" | "BRANCH_ADMIN" | "CLIENT_ADMIN"
  pin: string
  status: string
  created_at?: string
}

export interface Tenant {
  tenant_id: string
  hospital_name: string
  address?: string
  phone?: string
  logo_url?: string
  whatsapp_phone_number?: string
  whatsapp_phone_id?: string
  whatsapp_display_name?: string
  whatsapp_verified?: boolean
  wa_token?: string
  wa_api_url?: string
  bot_languages?: string[]
  greeting_message?: string
  timezone?: string
  consultation_fee?: number
  currency?: string
  bot_name?: string
  admin_phone?: string
  admin_pin?: string
  reception_pin?: string
  client_id?: string
  city?: string
  branch_code?: string
  ward_beds?: Record<string, WardConfig> | null
  // GST configuration
  gstin?: string
  gst_percentage?: number
  hsn_code?: string
  enable_gst?: boolean
  state_code?: string
  // ABDM configuration
  abdm_enabled?: boolean
  abdm_facility_id?: string       // HFR (Health Facility Registry) ID
  abdm_hip_id?: string            // Health Information Provider ID
  abdm_hiu_id?: string            // Health Information User ID
  abdm_client_id?: string         // ABDM gateway client ID
  abdm_client_secret?: string     // ABDM gateway client secret
  abdm_environment?: "sandbox" | "production"
  status: string
  created_at?: string
}

export interface Document {
  document_id: string
  tenant_id: string
  patient_phone: string
  type: "xray" | "lab_report" | "prescription" | "discharge_summary" | "scan" | "consent" | "other"
  title: string
  description?: string
  file_url: string
  file_name: string
  file_size?: number
  mime_type?: string
  uploaded_by?: string
  uploaded_by_role?: string
  booking_id?: string
  lab_order_id?: string
  prescription_id?: string
  tags?: string[]
  created_at?: string
}

export interface Client {
  client_id: string
  name: string
  slug: string
  logo_url?: string
  subscription_plan: string
  max_branches: number
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  admin_pin?: string
  status: string
  trial_ends_at?: string
  created_at?: string
  updated_at?: string
}

export interface PlatformAdmin {
  admin_id: string
  email: string
  name: string
  pin: string
  status: string
  created_at?: string
}

export interface Prescription {
  prescription_id: string
  booking_id: string
  patient_phone: string
  patient_email?: string
  doctor_id: string
  doctor_name: string
  type: string
  items: PrescriptionItem[]
  notes?: string
  diagnosis?: string
  symptoms?: string
  vitals?: Record<string, unknown>
  follow_up_date?: string
  payment_status?: string
  patient_name?: string
  tenant_id?: string
  client_id?: string
  created_at?: string
}

export interface Notification {
  id: string
  tenant_id: string
  client_id?: string
  type: string
  title: string
  message: string
  target_role: string
  target_user_id?: string
  reference_id?: string
  reference_type?: string
  is_read: boolean
  created_at: string
}

// ─── EMR Types ─────────────────────────────────────────────────────────────

export interface Vitals {
  id: number
  patient_phone: string
  tenant_id: string
  booking_id?: string
  recorded_by?: string
  recorded_by_name?: string
  recorded_at: string
  bp_systolic?: number
  bp_diastolic?: number
  pulse?: number
  temperature?: number
  spo2?: number
  weight?: number
  height?: number
  bmi?: number
  respiratory_rate?: number
  blood_sugar_fasting?: number
  blood_sugar_pp?: number
  notes?: string
  client_id?: string
}

export interface ClinicalNote {
  id: number
  patient_phone: string
  tenant_id: string
  booking_id?: string
  doctor_id?: string
  doctor_name?: string
  note_type: "consultation" | "follow_up" | "procedure" | "discharge" | "referral"
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  chief_complaint?: string
  history_of_illness?: string
  examination_findings?: Record<string, string>
  created_at: string
  updated_at?: string
  client_id?: string
}

export interface MedicalCondition {
  id: number
  patient_phone: string
  tenant_id: string
  condition_name: string
  icd_code?: string
  category: "chronic" | "acute" | "resolved" | "surgical_history"
  severity: "mild" | "moderate" | "severe"
  onset_date?: string
  resolved_date?: string
  status: "active" | "resolved" | "managed"
  diagnosed_by?: string
  diagnosed_by_name?: string
  notes?: string
  created_at: string
  client_id?: string
}

export interface Allergy {
  id: number
  patient_phone: string
  tenant_id: string
  allergen: string
  allergy_type: "drug" | "food" | "environmental" | "other"
  severity: "mild" | "moderate" | "severe" | "life_threatening"
  reaction?: string
  status: "active" | "resolved" | "suspected"
  recorded_by?: string
  recorded_by_name?: string
  notes?: string
  created_at: string
  client_id?: string
}

// ─── ABDM / ABHA Types ──────────────────────────────────────────────────────

export interface HealthConsent {
  consent_id: string
  tenant_id: string
  patient_phone: string
  patient_abha?: string
  requester_name: string        // HIU name requesting data
  requester_id?: string         // HIU ID
  purpose: "CAREMGT" | "BTGACCESS" | "PUBHLTH" | "HPAYMT" | "DSRCH"
  purpose_text?: string
  hi_types: HealthInfoType[]    // Types of health info requested
  date_range_from?: string
  date_range_to?: string
  expiry?: string
  status: "REQUESTED" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED"
  granted_at?: string
  denied_at?: string
  revoked_at?: string
  created_at?: string
}

export type HealthInfoType =
  | "OPConsultation"
  | "Prescription"
  | "DischargeSummary"
  | "DiagnosticReport"
  | "ImmunizationRecord"
  | "HealthDocumentRecord"
  | "WellnessRecord"

export interface HealthRecord {
  record_id: string
  tenant_id: string
  patient_phone: string
  patient_abha?: string
  record_type: HealthInfoType
  title: string
  fhir_bundle?: Record<string, unknown>  // FHIR R4 Bundle JSON
  source_id?: string            // booking_id, admission_id, prescription_id, etc.
  source_type?: string
  created_at?: string
  shared_at?: string
}
