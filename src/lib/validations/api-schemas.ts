import { z } from "zod"

// Phone number: digits only, 10-15 chars
export const phoneSchema = z.string().regex(/^\d{10,15}$/, "Invalid phone number")

// Date: YYYY-MM-DD format
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")

// Time: HH:MM format (24h)
export const timeSchema = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM")

// Booking action schemas
export const bookAppointmentSchema = z.object({
  action: z.literal("book-appointment"),
  doctor_id: z.string().min(1, "Doctor ID is required"),
  doctor_name: z.string().min(1, "Doctor name is required"),
  patient_name: z.string().min(1).max(100, "Patient name must be 1-100 chars"),
  patient_phone: phoneSchema,
  date: dateSchema,
  time: timeSchema,
  specialty: z.string().optional(),
  patient_type: z.enum(["SELF", "DEPENDENT"]).default("SELF"),
  dependent_id: z.string().optional(),
})

export const cancelAppointmentSchema = z.object({
  action: z.literal("cancel-appointment"),
  booking_id: z.string().min(1, "Booking ID is required"),
})

export const checkAvailabilitySchema = z.object({
  action: z.literal("check-availability"),
  doctor_id: z.string().min(1, "Doctor ID is required"),
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

// WhatsApp route schemas
export const waActionSchema = z.object({
  token: z.string().min(1, "Token is required"),
  action: z.enum([
    "lookup_patient", "save_patient", "list_specialties",
    "check_availability", "book_appointment", "list_appointments",
    "cancel_appointment", "reschedule_appointment", "list_prescriptions",
  ]),
}).passthrough() // Allow extra fields per action

// OTP schemas
export const sendOtpSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
})

// Payment schemas
export const createOrderSchema = z.object({
  booking_id: z.string().min(1),
  amount: z.number().positive(),
  patient_name: z.string().min(1),
  patient_phone: phoneSchema,
})

// List specialties (no params needed beyond action)
export const listSpecialtiesSchema = z.object({
  action: z.literal("list-specialties"),
})

// Union of all booking actions
export const bookingActionSchema = z.discriminatedUnion("action", [
  bookAppointmentSchema,
  cancelAppointmentSchema,
  checkAvailabilitySchema,
  patientLookupSchema,
  savePatientSchema,
  listSpecialtiesSchema,
])

// Helper to validate and return typed result or error response
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
