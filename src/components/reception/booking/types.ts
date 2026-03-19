import type { Doctor, Patient } from "@/types/database"

export type Step = "patient" | "doctor" | "slot" | "confirm" | "done"

export interface SlotInfo {
  date: string
  dateKey: string
  day: string
  availableSlots: number
}

export interface TimeSlot {
  time: string
  status: "available" | "booked"
  capacity?: number
  iso?: string
}

export interface N8nSlot {
  time: string
  capacity: number
  iso: string
}

export interface N8nDateSlots {
  morning?: N8nSlot[]
  afternoon?: N8nSlot[]
  evening?: N8nSlot[]
}

export interface N8nAvailabilityResponse {
  success?: boolean
  available_dates?: { date: string; date_key: string; available_count: number }[]
  slots_by_date?: Record<string, N8nDateSlots>
  dates?: SlotInfo[]
  slots?: Record<string, TimeSlot[]>
}

export const STEPS: { key: Step; label: string; num: number }[] = [
  { key: "patient", label: "Patient", num: 1 },
  { key: "doctor", label: "Doctor", num: 2 },
  { key: "slot", label: "Schedule", num: 3 },
  { key: "confirm", label: "Confirm", num: 4 },
]

/* ── Prop types for each step component ── */

export interface PatientStepProps {
  phone: string
  patientName: string
  patientGender: string
  patientAge: string
  lookingUp: boolean
  patientFound: boolean | null
  patient: Patient | null
  familyMembers: string[]
  canProceedPatient: boolean
  loading: boolean
  tenantId: string
  onPhoneChange: (val: string) => void
  onPatientNameChange: (val: string) => void
  onPatientGenderChange: (val: string) => void
  onPatientAgeChange: (val: string) => void
  onSelectFamilyMember: (name: string) => void
  onProceed: () => void
}

export interface DoctorStepProps {
  patient: Patient | null
  patientFound: boolean | null
  doctors: Doctor[]
  doctorSearch: string
  loading: boolean
  onDoctorSearchChange: (val: string) => void
  onSelectDoctor: (doctor: Doctor) => void
}

export interface SlotStepProps {
  selectedDoctor: Doctor | null
  availability: SlotInfo[]
  selectedDate: string
  timeSlots: TimeSlot[]
  selectedTime: string
  loading: boolean
  onSelectDate: (date: string) => void
  onSelectTime: (time: string) => void
  onChangeDate: () => void
}

export interface ConfirmStepProps {
  selectedDoctor: Doctor | null
  patient: Patient | null
  selectedDate: string
  selectedTime: string
  loading: boolean
  onConfirm: () => void
}

export interface Tenant {
  hospital_name?: string
  whatsapp_phone_number?: string
}

export interface DoneStepProps {
  bookingId: string
  patient: Patient | null
  selectedDoctor: Doctor | null
  selectedDate: string
  selectedTime: string
  waSent: boolean | null
  tenant: Tenant | null
  onReset: () => void
}
