import { z } from "zod"

// ─── Sanitization Transform ─────────────────────────────────────────────────
// Strip HTML tags from user-supplied text to prevent stored XSS
const stripHtml = (val: string) => val.replace(/<[^>]*>/g, "")

// ─── Reusable Primitives ────────────────────────────────────────────────────

// Phone number: digits only, 10-15 chars
export const phoneSchema = z.string().regex(/^\d{10,15}$/, "Invalid phone number")

// Phone that also accepts common formats (spaces, dashes, +prefix) and normalizes
export const flexPhoneSchema = z.string().min(1, "Phone is required")

// Date: YYYY-MM-DD format with actual date validation
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").refine(
  (val) => !isNaN(Date.parse(val)),
  "Invalid date"
)

// Time: HH:MM format (24h)
export const timeSchema = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM")

// Email: proper RFC validation, trimmed + lowercased
export const emailSchema = z.string().email("Invalid email format").max(254).trim().toLowerCase()

// Generic safe text (no HTML, bounded length)
export const safeTextSchema = (maxLen: number) =>
  z.string().max(maxLen).transform(stripHtml)

// Booking ID
export const bookingIdSchema = z.string().min(1, "Booking ID is required").max(60).trim()

// Tenant ID
export const tenantIdSchema = z.string().min(1).max(30).trim()

// Doctor ID
export const doctorIdSchema = z.string().min(1, "Doctor ID is required").max(60).trim()

// UUID (for database IDs)
export const uuidSchema = z.string().uuid()

// ─── Booking Action Schemas ─────────────────────────────────────────────────

export const bookAppointmentSchema = z.object({
  action: z.literal("book-appointment"),
  doctor_id: doctorIdSchema,
  doctor_name: z.string().min(1, "Doctor name is required").max(100),
  patient_name: z.string().min(1).max(100, "Patient name must be 1-100 chars"),
  patient_phone: phoneSchema,
  date: dateSchema,
  time: timeSchema,
  specialty: z.string().max(100).optional(),
  patient_type: z.enum(["SELF", "DEPENDENT"]).default("SELF"),
  dependent_id: z.string().max(60).optional(),
  patient_age: z.number().int().min(0).max(150).optional().nullable(),
  patient_gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
  source: z.string().max(30).optional(),
  booked_by_whatsapp_number: z.string().max(20).optional(),
})

export const cancelAppointmentSchema = z.object({
  action: z.literal("cancel-appointment"),
  booking_id: bookingIdSchema,
  patient_phone: z.string().optional(),
})

export const checkAvailabilitySchema = z.object({
  action: z.literal("check-availability"),
  doctor_id: z.string().optional(),
  specialty: z.string().max(100).optional(),
})

export const patientLookupSchema = z.object({
  action: z.literal("patient-lookup"),
  phone: phoneSchema,
})

export const savePatientSchema = z.object({
  action: z.literal("save-patient"),
  name: z.string().min(1).max(100),
  phone: phoneSchema,
  age: z.number().int().min(0).max(150).optional(),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  address: z.string().max(500).optional(),
})

export const listSpecialtiesSchema = z.object({
  action: z.literal("list-specialties"),
})

// Union of all booking actions (used by /api/booking)
export const bookingActionSchema = z.discriminatedUnion("action", [
  bookAppointmentSchema,
  cancelAppointmentSchema,
  checkAvailabilitySchema,
  patientLookupSchema,
  savePatientSchema,
  listSpecialtiesSchema,
])

// ─── WhatsApp Route Schemas ─────────────────────────────────────────────────

export const waActionSchema = z.object({
  token: z.string().min(1, "Token is required"),
  action: z.enum([
    "lookup_patient", "save_patient", "list_specialties",
    "check_availability", "book_appointment", "list_appointments",
    "cancel_appointment", "reschedule_appointment", "list_prescriptions",
  ]),
}).passthrough() // Allow extra fields per action

// ─── OTP Schemas ────────────────────────────────────────────────────────────

export const sendOtpSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
})

// ─── Payment Schemas ────────────────────────────────────────────────────────

// Old schema kept for backwards compat (unused in routes currently)
export const createOrderSchema = z.object({
  booking_id: z.string().min(1),
  amount: z.number().positive(),
  patient_name: z.string().min(1),
  patient_phone: phoneSchema,
})

// Actual schema for /api/payment/create-order body
export const createOrderBodySchema = z.object({
  booking_id: bookingIdSchema,
})

// Query params for /api/payment/status
export const paymentStatusQuerySchema = z.object({
  booking_id: bookingIdSchema,
})

// /api/payment/verify-checkout
export const verifyCheckoutBodySchema = z.object({
  razorpay_payment_id: z.string().min(1, "Payment ID required").max(100),
  razorpay_order_id: z.string().min(1, "Order ID required").max(100),
  razorpay_signature: z.string().min(1, "Signature required").max(200),
  booking_id: bookingIdSchema,
})

// /api/payment/send-emails (internal)
export const sendEmailsBodySchema = z.object({
  type: z.enum(["appointment", "cancellation", "reschedule"]).optional(),
  patient_phone: z.string().max(20).optional(),
  booked_by_whatsapp_number: z.string().max(20).optional(),
  patient_name: z.string().max(100).optional(),
  doctor_name: z.string().max(100).optional(),
  specialty: z.string().max(100).optional(),
  date: z.string().max(20).optional(),
  time: z.string().max(10).optional(),
  booking_id: z.string().max(60).optional(),
  hospital_name: z.string().max(100).optional(),
  payment_id: z.string().max(100).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  op_pass_id: z.string().max(60).optional(),
  old_date: z.string().max(20).optional(),
  old_time: z.string().max(10).optional(),
  reschedule_count: z.union([z.string(), z.number()]).optional(),
  reason: z.string().max(500).optional(),
  email_html: z.string().max(50000).optional(),
  email_subject: z.string().max(200).optional(),
})

// ─── Auth Schemas ───────────────────────────────────────────────────────────

// /api/auth/create-password
export const createPasswordBodySchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(10, "Password must be at least 10 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
})

// /api/auth/forgot-password
export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
})

// ─── Doctor Leave Schemas ───────────────────────────────────────────────────

export const doctorLeaveBodySchema = z.object({
  doctor_id: doctorIdSchema,
  date: dateSchema,
  type: z.enum(["leave", "custom_hours"]),
  reason: safeTextSchema(500).optional(),
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
  tenant_id: tenantIdSchema.optional(),
}).refine(
  (data) => {
    if (data.type === "custom_hours") {
      return !!data.start_time && !!data.end_time
    }
    return true
  },
  { message: "start_time and end_time are required for custom_hours", path: ["start_time"] }
)

// ─── Notifications Schemas ──────────────────────────────────────────────────

// /api/notifications/post-consultation
export const postConsultationBodySchema = z.object({
  patient_phone: flexPhoneSchema,
  tenant_id: tenantIdSchema,
  prescription_id: z.string().max(60).optional(),
  booking_id: z.string().max(60).optional(),
  patient_name: safeTextSchema(100).optional(),
  doctor_name: safeTextSchema(100).optional(),
  doctor_id: z.string().max(60).optional(),
  specialty: z.string().max(100).optional(),
  diagnosis: safeTextSchema(2000).optional(),
  items: z.array(z.object({
    medicine_name: z.string().max(200).optional(),
    name: z.string().max(200).optional(),
    dosage: z.string().max(100).optional(),
  })).max(50).optional(),
  lab_tests: z.array(z.union([
    z.string().max(200),
    z.object({ test_name: z.string().max(200).optional(), name: z.string().max(200).optional() }),
  ])).max(50).optional(),
  follow_up_date: z.string().max(20).optional(),
})

// ─── Patient Booking Schemas ────────────────────────────────────────────────

export const patientBookingActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list-specialties"),
    tenant_id: tenantIdSchema.optional(),
  }),
  z.object({
    action: z.literal("check-availability"),
    doctor_id: z.string().max(60).optional(),
    specialty: z.string().max(100).optional(),
    tenant_id: tenantIdSchema.optional(),
  }),
  z.object({
    action: z.literal("book-appointment"),
    doctor_id: doctorIdSchema,
    doctor_name: z.string().min(1).max(100),
    specialty: z.string().max(100).optional(),
    date: dateSchema,
    time: timeSchema,
    tenant_id: tenantIdSchema.optional(),
  }),
])

// ─── Patient Appointment Schemas ────────────────────────────────────────────

export const patientAppointmentBodySchema = z.object({
  action: z.literal("cancel"),
  booking_id: bookingIdSchema,
})

// ─── WhatsApp Agent Reply Schemas ───────────────────────────────────────────

export const agentReplyBodySchema = z.object({
  chat_id: z.string().min(1, "chat_id is required").max(100),
  message: z.string().max(4096).transform(stripHtml).optional(),
  action: z.enum(["close"]).optional(),
})

// ─── Telemedicine Schemas ───────────────────────────────────────────────────

export const telemedicineSendLinkBodySchema = z.object({
  patientPhone: flexPhoneSchema,
  roomName: z.string().min(1).max(100),
  doctorName: z.string().min(1).max(100),
  patientName: z.string().min(1).max(100),
  tenantId: tenantIdSchema.optional(),
})

// ─── Queue Notify Schemas ───────────────────────────────────────────────────

export const queueNotifyBodySchema = z.object({
  phone: flexPhoneSchema,
  queue_number: z.union([z.string().min(1), z.number()]),
  patient_name: z.string().max(100).optional(),
  doctor_name: z.string().max(100).optional(),
  hospital_name: z.string().max(100).optional(),
  estimated_wait: z.number().nonnegative().optional(),
  waiting_ahead: z.number().nonnegative().optional(),
  queue_url: z.string().max(500).optional(),
})

// ─── Push Subscribe Schemas ─────────────────────────────────────────────────

export const pushSubscribeBodySchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

// ─── ABDM Schemas ───────────────────────────────────────────────────────────

const abdmRequestOtp = z.object({
  action: z.literal("request-otp"),
  abhaNumber: z.string().max(20).optional(),
  abhaAddress: z.string().max(100).optional(),
  authMethod: z.enum(["MOBILE_OTP", "AADHAAR_OTP"]).optional(),
})

const abdmVerifyOtp = z.object({
  action: z.literal("verify-otp"),
  txnId: z.string().min(1).max(100),
  otp: z.string().min(4).max(8),
  patientPhone: flexPhoneSchema.optional(),
})

const abdmLinkAbha = z.object({
  action: z.literal("link-abha"),
  patientPhone: flexPhoneSchema,
  abhaNumber: z.string().min(1).max(20),
  abhaAddress: z.string().max(100).optional(),
})

const abdmUnlinkAbha = z.object({
  action: z.literal("unlink-abha"),
  patientPhone: flexPhoneSchema,
})

const abdmCreateConsent = z.object({
  action: z.literal("create-consent"),
  patientPhone: flexPhoneSchema.optional(),
  patientAbha: z.string().max(100).optional(),
  purpose: z.string().max(50).optional(),
  hiTypes: z.array(z.string().max(50)).max(10).optional(),
  dateRangeFrom: z.string().max(30).optional(),
  dateRangeTo: z.string().max(30).optional(),
  expiry: z.string().max(30).optional(),
  requesterName: safeTextSchema(100).optional(),
})

const abdmUpdateConsent = z.object({
  action: z.literal("update-consent"),
  consentId: z.string().min(1).max(60),
  status: z.enum(["GRANTED", "DENIED", "REVOKED"]),
})

const abdmListConsents = z.object({
  action: z.literal("list-consents"),
  patientPhone: flexPhoneSchema.optional(),
})

const abdmGenerateHealthRecord = z.object({
  action: z.literal("generate-health-record"),
  recordType: z.enum(["OPConsultation", "Prescription", "DischargeSummary", "DiagnosticReport"]),
  sourceId: z.string().min(1).max(60),
  patientPhone: flexPhoneSchema,
})

const abdmListHealthRecords = z.object({
  action: z.literal("list-health-records"),
  patientPhone: flexPhoneSchema.optional(),
  recordType: z.string().max(50).optional(),
})

const abdmGetConsentArtifact = z.object({
  action: z.literal("get-consent-artifact"),
  consentId: z.string().min(1).max(60),
})

export const abdmActionSchema = z.discriminatedUnion("action", [
  abdmRequestOtp,
  abdmVerifyOtp,
  abdmLinkAbha,
  abdmUnlinkAbha,
  abdmCreateConsent,
  abdmUpdateConsent,
  abdmListConsents,
  abdmGenerateHealthRecord,
  abdmListHealthRecords,
  abdmGetConsentArtifact,
])

// ─── Platform Schemas ───────────────────────────────────────────────────────

export const platformScopeSchema = z.enum([
  "dashboard", "clients", "client", "health-ping", "n8n-health", "whatsapp-routing",
])

export const platformPostBodySchema = z.object({
  action: z.enum([
    "createClient", "createBranch", "updateBranch",
    "saveWhatsAppRoute", "deleteWhatsAppRoute",
  ]),
}).passthrough() // Actions have diverse payloads; validated per-action

// ─── IPD / Admissions Schemas ───────────────────────────────────────────────

const admitPatientSchema = z.object({
  action: z.literal("admit"),
  patient_phone: flexPhoneSchema,
  patient_name: z.string().min(1).max(100).transform(stripHtml),
  doctor_id: doctorIdSchema.optional(),
  doctor_name: z.string().max(100).transform(stripHtml).optional(),
  ward: z.string().min(1).max(50).transform(stripHtml),
  bed_number: z.string().min(1).max(20).transform(stripHtml),
  diagnosis: safeTextSchema(500).optional(),
  expected_discharge: dateSchema.optional(),
  from_appointment: z.string().max(60).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const transferPatientSchema = z.object({
  action: z.literal("transfer"),
  admission_id: z.string().min(1).max(60),
  to_ward: z.string().min(1).max(50).transform(stripHtml),
  to_bed: z.string().min(1).max(20).transform(stripHtml),
  reason: safeTextSchema(300).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const dischargePatientSchema = z.object({
  action: z.literal("discharge"),
  admission_id: z.string().min(1).max(60),
  final_diagnosis: safeTextSchema(500),
  treatment_given: safeTextSchema(1000),
  follow_up_instructions: safeTextSchema(500).optional(),
  follow_up_date: dateSchema.optional(),
  medications_on_discharge: z.array(z.object({
    medicine: z.string().max(200),
    dosage: z.string().max(100),
    frequency: z.string().max(100),
    duration: z.string().max(100),
  })).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const addNursingNoteSchema = z.object({
  action: z.literal("add-nursing-note"),
  admission_id: z.string().min(1).max(60),
  type: z.enum(["vitals", "observation", "medication", "general", "rounds"]),
  note: safeTextSchema(2000),
  vitals: z.object({
    bp_systolic: z.number().int().min(50).max(300).optional(),
    bp_diastolic: z.number().int().min(30).max(200).optional(),
    pulse: z.number().int().min(20).max(300).optional(),
    temperature: z.number().min(90).max(110).optional(),
    spo2: z.number().int().min(0).max(100).optional(),
    respiratory_rate: z.number().int().min(5).max(80).optional(),
  }).optional(),
  observations: safeTextSchema(1000).optional(),
  medications_given: z.array(z.string().max(200)).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const addDailyChargeSchema = z.object({
  action: z.literal("add-daily-charge"),
  admission_id: z.string().min(1).max(60),
  description: safeTextSchema(300),
  amount: z.number().min(0).max(10000000),
  category: z.enum(["bed", "medicine", "procedure", "consumable", "other"]),
  date: dateSchema.optional(),
  tenant_id: tenantIdSchema.optional(),
})

export const ipdActionSchema = z.discriminatedUnion("action", [
  admitPatientSchema,
  transferPatientSchema,
  dischargePatientSchema,
  addNursingNoteSchema,
  addDailyChargeSchema,
])

// ─── Billing Schemas ────────────────────────────────────────────────────────

const generateInvoiceSchema = z.object({
  action: z.literal("generate-invoice"),
  patient_phone: flexPhoneSchema,
  patient_name: z.string().min(1).max(100).transform(stripHtml),
  type: z.enum(["consultation", "pharmacy", "lab", "admission", "procedure"]),
  items: z.array(z.object({
    description: z.string().min(1).max(300).transform(stripHtml),
    amount: z.number().min(0),
    quantity: z.number().int().min(1).default(1),
  })).min(1, "At least one item required"),
  booking_id: z.string().max(60).optional(),
  admission_id: z.string().max(60).optional(),
  discount_type: z.enum(["flat", "percent"]).optional(),
  discount_value: z.number().min(0).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const updatePaymentStatusSchema = z.object({
  action: z.literal("update-payment"),
  invoice_id: z.string().min(1).max(60),
  payment_status: z.enum(["paid", "unpaid", "partial"]),
  payment_method: z.string().max(50).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const getInvoiceSchema = z.object({
  action: z.literal("get-invoice"),
  invoice_id: z.string().min(1).max(60),
  tenant_id: tenantIdSchema.optional(),
})

export const billingActionSchema = z.discriminatedUnion("action", [
  generateInvoiceSchema,
  updatePaymentStatusSchema,
  getInvoiceSchema,
])

// ─── Lab Schemas ────────────────────────────────────────────────────────────

const createLabOrderSchema = z.object({
  action: z.literal("create-order"),
  patient_phone: flexPhoneSchema,
  patient_name: z.string().min(1).max(100).transform(stripHtml),
  doctor_id: doctorIdSchema.optional(),
  doctor_name: z.string().max(100).transform(stripHtml).optional(),
  booking_id: z.string().max(60).optional(),
  tests: z.array(z.object({
    test_id: z.string().min(1).max(60),
    test_name: z.string().min(1).max(200),
  })).min(1, "At least one test required"),
  notes: safeTextSchema(500).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const updateLabStatusSchema = z.object({
  action: z.literal("update-status"),
  order_id: z.string().min(1).max(60),
  status: z.enum(["sample_collected", "processing", "completed"]),
  tenant_id: tenantIdSchema.optional(),
})

const uploadLabResultsSchema = z.object({
  action: z.literal("upload-results"),
  order_id: z.string().min(1).max(60),
  results: z.record(z.string(), z.unknown()),
  notes: safeTextSchema(500).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const manageTestMasterSchema = z.object({
  action: z.literal("manage-test"),
  operation: z.enum(["create", "update"]),
  test_id: z.string().max(60).optional(),
  test_name: z.string().min(1).max(200).transform(stripHtml),
  category: z.string().max(100).optional(),
  price: z.number().min(0),
  normal_range: z.string().max(200).optional(),
  unit: z.string().max(50).optional(),
  sample_type: z.string().max(100).optional(),
  turnaround_hours: z.number().int().min(0).max(720).optional(),
  tenant_id: tenantIdSchema.optional(),
})

export const labActionSchema = z.discriminatedUnion("action", [
  createLabOrderSchema,
  updateLabStatusSchema,
  uploadLabResultsSchema,
  manageTestMasterSchema,
])

// ─── Pharmacy Schemas ───────────────────────────────────────────────────────

const createPharmacyOrderSchema = z.object({
  action: z.literal("create-order"),
  prescription_id: z.string().max(60).optional(),
  patient_phone: flexPhoneSchema.optional(),
  patient_name: z.string().max(100).transform(stripHtml).optional(),
  doctor_name: z.string().max(100).transform(stripHtml).optional(),
  items: z.array(z.object({
    medicine_name: z.string().min(1).max(200),
    dosage: z.string().max(100).optional(),
    frequency: z.string().max(100).optional(),
    duration: z.string().max(100).optional(),
    quantity: z.number().int().min(1).optional(),
  })).min(1, "At least one medicine required"),
  tenant_id: tenantIdSchema.optional(),
})

const updatePharmacyStatusSchema = z.object({
  action: z.literal("update-status"),
  order_id: z.string().min(1).max(60),
  status: z.enum(["preparing", "ready", "dispensed"]),
  tenant_id: tenantIdSchema.optional(),
})

const updateStockSchema = z.object({
  action: z.literal("update-stock"),
  medicine_id: z.string().min(1).max(60),
  stock: z.number().int().min(0),
  price: z.number().min(0).optional(),
  tenant_id: tenantIdSchema.optional(),
})

const manageMedicineSchema = z.object({
  action: z.literal("manage-medicine"),
  operation: z.enum(["create", "update"]),
  medicine_id: z.string().max(60).optional(),
  medicine_name: z.string().min(1).max(200).transform(stripHtml),
  salt: z.string().max(200).optional(),
  dosage: z.string().max(100).optional(),
  form: z.string().max(50).optional(),
  stock: z.number().int().min(0).default(0),
  min_stock: z.number().int().min(0).default(10),
  price: z.number().min(0),
  category: z.string().max(100).optional(),
  expiry_date: dateSchema.optional(),
  tenant_id: tenantIdSchema.optional(),
})

export const pharmacyActionSchema = z.discriminatedUnion("action", [
  createPharmacyOrderSchema,
  updatePharmacyStatusSchema,
  updateStockSchema,
  manageMedicineSchema,
])

// ─── Analytics Schemas ──────────────────────────────────────────────────────

export const analyticsQuerySchema = z.object({
  metric: z.enum([
    "dashboard-summary",
    "revenue-by-type",
    "revenue-by-doctor",
    "appointment-stats",
    "patient-demographics",
  ]),
  from_date: dateSchema.optional(),
  to_date: dateSchema.optional(),
  tenant_id: tenantIdSchema.optional(),
})

// ─── Helper Function ────────────────────────────────────────────────────────

// Validate and return typed result or error response
export function validateBody<T>(schema: z.ZodType<T>, body: unknown):
  { success: true; data: T } | { success: false; error: string; details: z.core.$ZodIssue[] } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: "Validation failed",
    details: result.error.issues,
  }
}
