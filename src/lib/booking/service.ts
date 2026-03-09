/**
 * Booking Service — Direct Supabase queries replacing ALL n8n booking webhooks
 *
 * Replaces: book-appointment, cancel-appointment, cal-availability,
 *           list-specialties, patient-lookup, save-patient
 */

import { createServerClient } from "@/lib/supabase/server"
import { scheduleReminders, cancelReminders } from "@/lib/queue/queues"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotInfo {
  date: string
  time: string
  available: boolean
}

interface DaySlots {
  date: string
  day: string
  slots: SlotInfo[]
}

interface BookingParams {
  tenant_id: string
  patient_phone: string
  patient_name: string
  patient_type?: string
  doctor_id: string
  doctor_name: string
  specialty: string
  date: string
  time: string
  source?: string
  booked_by_whatsapp_number?: string
}

interface CancelParams {
  tenant_id: string
  booking_id: string
  patient_phone?: string
}

interface PatientData {
  phone: string
  tenant_id: string
  name?: string
  age?: number
  gender?: string
  email?: string
  address?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get IST date string (YYYY-MM-DD) */
function getISTDate(offsetDays = 0): string {
  const now = new Date()
  // IST = UTC + 5:30
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000) + (offsetDays * 24 * 60 * 60 * 1000))
  return ist.toISOString().split("T")[0]
}

/** Get IST hours + minutes as "HH:MM" */
function getISTTime(): string {
  const now = new Date()
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
  return ist.toISOString().split("T")[1].substring(0, 5)
}

/** Parse "HH:MM" to minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

/** Minutes since midnight to "HH:MM" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Day of week string for schedule lookup */
function getDayOfWeek(dateStr: string): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return days[new Date(dateStr + "T00:00:00").getDay()]
}

// ─── Service Functions ────────────────────────────────────────────────────────

/** List unique specialties for a tenant */
export async function listSpecialties(tenantId: string) {
  const supabase = createServerClient()

  const { data: doctors, error } = await supabase
    .from("doctors")
    .select("specialty, doctor_id, name, consultation_fee")
    .eq("tenant_id", tenantId)
    .eq("status", "active")

  if (error) {
    console.error("[booking] listSpecialties error:", error.message)
    return { error: "Failed to fetch specialties" }
  }

  // Group doctors by specialty
  const specialtyMap = new Map<string, { doctor_id: string; name: string; consultation_fee: number }[]>()
  for (const doc of doctors || []) {
    if (!doc.specialty) continue
    const list = specialtyMap.get(doc.specialty) || []
    list.push({ doctor_id: doc.doctor_id, name: doc.name, consultation_fee: doc.consultation_fee || 0 })
    specialtyMap.set(doc.specialty, list)
  }

  const specialties = Array.from(specialtyMap.entries()).map(([specialty, doctors]) => ({
    specialty,
    doctors,
    doctor_count: doctors.length,
  }))

  return { specialties }
}

/** Check 7-day availability for a doctor (or all doctors of a specialty) */
export async function checkAvailability(params: {
  tenant_id: string
  doctor_id?: string
  specialty?: string
}) {
  const supabase = createServerClient()
  const { tenant_id, doctor_id, specialty } = params

  // Resolve doctor(s)
  let doctorIds: string[] = []
  if (doctor_id) {
    doctorIds = [doctor_id]
  } else if (specialty) {
    const { data: docs } = await supabase
      .from("doctors")
      .select("doctor_id")
      .eq("tenant_id", tenant_id)
      .eq("specialty", specialty)
      .eq("status", "active")
    doctorIds = (docs || []).map((d) => d.doctor_id)
  }

  if (doctorIds.length === 0) {
    return { error: "No doctors found" }
  }

  const today = getISTDate()
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    dates.push(getISTDate(i))
  }

  // Fetch schedules, overrides, and existing appointments in parallel
  const [schedulesRes, overridesRes, appointmentsRes, locksRes] = await Promise.all([
    supabase
      .from("doctor_schedules")
      .select("*")
      .in("doctor_id", doctorIds)
      .eq("tenant_id", tenant_id),
    supabase
      .from("date_overrides")
      .select("*")
      .in("doctor_id", doctorIds)
      .in("override_date", dates),
    supabase
      .from("appointments")
      .select("doctor_id, date, time")
      .in("doctor_id", doctorIds)
      .eq("tenant_id", tenant_id)
      .in("date", dates)
      .eq("status", "confirmed"),
    supabase
      .from("slot_locks")
      .select("doctor_id, slot_date, slot_time")
      .in("doctor_id", doctorIds)
      .in("slot_date", dates)
      .gt("expires_at", new Date().toISOString()),
  ])

  const schedules = schedulesRes.data || []
  const overrides = overridesRes.data || []
  const bookedAppointments = appointmentsRes.data || []
  const activeLocks = locksRes.data || []

  // Build booked set for O(1) lookup
  const bookedSet = new Set(
    bookedAppointments.map((a) => `${a.doctor_id}|${a.date}|${a.time}`)
  )
  const lockedSet = new Set(
    activeLocks.map((l) => `${l.doctor_id}|${l.slot_date}|${l.slot_time}`)
  )

  const currentTime = today === getISTDate() ? getISTTime() : "00:00"
  const results: Record<string, DaySlots[]> = {}

  for (const docId of doctorIds) {
    const docSchedules = schedules.filter((s) => s.doctor_id === docId)
    const docOverrides = overrides.filter((o) => o.doctor_id === docId)
    const availability: DaySlots[] = []

    for (const date of dates) {
      const dayOfWeek = getDayOfWeek(date)
      const override = docOverrides.find((o) => o.override_date === date)

      // Check if doctor is on leave
      if (override && !override.is_available) {
        availability.push({ date, day: dayOfWeek, slots: [] })
        continue
      }

      // Get schedule: override custom hours > doctor_schedules > legacy fallback
      let startTime: string
      let endTime: string
      let slotDuration: number

      if (override?.start_time && override?.end_time) {
        startTime = override.start_time
        endTime = override.end_time
        slotDuration = override.slot_duration_minutes || 20
      } else {
        const schedule = docSchedules.find((s) => s.day_of_week === dayOfWeek)
        if (schedule) {
          startTime = schedule.start_time
          endTime = schedule.end_time
          slotDuration = schedule.slot_duration || 20
        } else {
          // Legacy fallback: 10:30 AM – 9:00 PM, 20 min
          startTime = "10:30"
          endTime = "21:00"
          slotDuration = 20
        }
      }

      const startMin = timeToMinutes(startTime)
      const endMin = timeToMinutes(endTime)
      const slots: SlotInfo[] = []

      for (let min = startMin; min + slotDuration <= endMin; min += slotDuration) {
        const timeStr = minutesToTime(min)

        // Skip past slots for today
        if (date === today && timeStr <= currentTime) continue

        const key = `${docId}|${date}|${timeStr}`
        const isBooked = bookedSet.has(key)
        const isLocked = lockedSet.has(key)

        slots.push({
          date,
          time: timeStr,
          available: !isBooked && !isLocked,
        })
      }

      availability.push({ date, day: dayOfWeek, slots })
    }

    results[docId] = availability
  }

  return { availability: results }
}

/** Book an appointment — with slot lock to prevent race conditions */
export async function bookAppointment(params: BookingParams) {
  const supabase = createServerClient()
  const bookingId = `BK${Date.now()}`

  // 1. Try to acquire slot lock (5-minute expiry)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const { error: lockError } = await supabase
    .from("slot_locks")
    .insert({
      lock_id: `LK${Date.now()}`,
      doctor_id: params.doctor_id,
      slot_date: params.date,
      slot_time: params.time,
      expires_at: expiresAt,
      booking_id: bookingId,
      tenant_id: params.tenant_id,
    })

  if (lockError) {
    // UNIQUE constraint violation = slot already locked/booked
    if (lockError.code === "23505") {
      return { error: "This time slot is no longer available. Please choose another." }
    }
    console.error("[booking] Lock error:", lockError.message)
    return { error: "Failed to reserve slot" }
  }

  // 2. Double-check no existing confirmed appointment
  const { data: existing } = await supabase
    .from("appointments")
    .select("booking_id")
    .eq("doctor_id", params.doctor_id)
    .eq("date", params.date)
    .eq("time", params.time)
    .eq("status", "confirmed")
    .limit(1)

  if (existing && existing.length > 0) {
    // Release lock
    await supabase
      .from("slot_locks")
      .delete()
      .eq("doctor_id", params.doctor_id)
      .eq("slot_date", params.date)
      .eq("slot_time", params.time)
    return { error: "This time slot was just booked. Please choose another." }
  }

  // 3. Ensure patient exists (upsert)
  const normalizedPhone = params.patient_phone.replace(/\D/g, "")
  await supabase
    .from("patients")
    .upsert(
      {
        phone: normalizedPhone,
        name: params.patient_name,
        tenant_id: params.tenant_id,
      },
      { onConflict: "phone" }
    )

  // 4. Insert appointment
  const { error: insertError } = await supabase
    .from("appointments")
    .insert({
      booking_id: bookingId,
      tenant_id: params.tenant_id,
      patient_phone: normalizedPhone,
      patient_name: params.patient_name,
      patient_type: params.patient_type || "SELF",
      doctor_id: params.doctor_id,
      doctor_name: params.doctor_name,
      specialty: params.specialty,
      date: params.date,
      time: params.time,
      status: "confirmed",
      source: params.source || "dashboard",
      booked_by_whatsapp_number: params.booked_by_whatsapp_number,
    })

  // 5. Release slot lock (appointment now has the UNIQUE index protection)
  await supabase
    .from("slot_locks")
    .delete()
    .eq("doctor_id", params.doctor_id)
    .eq("slot_date", params.date)
    .eq("slot_time", params.time)

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "Double booking prevented. This slot is taken." }
    }
    console.error("[booking] Insert error:", insertError.message)
    return { error: "Failed to create appointment" }
  }

  // 6. Increment patient visit count
  try { await supabase.rpc("increment_visit_count", { p_phone: normalizedPhone }) } catch { /* non-critical */ }

  // 7. Schedule WhatsApp reminders (24h + 2h before appointment)
  // Fetch hospital name for reminder message
  const { data: tenant } = await supabase
    .from("tenants")
    .select("hospital_name")
    .eq("tenant_id", params.tenant_id)
    .single()

  scheduleReminders({
    booking_id: bookingId,
    patient_phone: normalizedPhone,
    patient_name: params.patient_name,
    doctor_name: params.doctor_name,
    specialty: params.specialty,
    date: params.date,
    time: params.time,
    tenant_id: params.tenant_id,
    hospital_name: tenant?.hospital_name || "Hospital",
  }).catch((err) => console.error("[booking] Failed to schedule reminders:", err))

  return {
    success: true,
    booking_id: bookingId,
    message: `Appointment booked successfully. Booking ID: ${bookingId}`,
    appointment: {
      booking_id: bookingId,
      doctor_name: params.doctor_name,
      specialty: params.specialty,
      date: params.date,
      time: params.time,
      status: "confirmed",
    },
  }
}

/** Cancel an appointment */
export async function cancelAppointment(params: CancelParams) {
  const supabase = createServerClient()

  // 1. Verify booking exists and is cancellable
  const { data: booking, error: fetchError } = await supabase
    .from("appointments")
    .select("booking_id, status, patient_phone, patient_name, doctor_name, date, time, tenant_id")
    .eq("booking_id", params.booking_id)
    .eq("tenant_id", params.tenant_id)
    .single()

  if (fetchError || !booking) {
    return { error: "Appointment not found" }
  }

  if (booking.status !== "confirmed") {
    return { error: `Cannot cancel appointment with status: ${booking.status}` }
  }

  // 2. Update status to cancelled
  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("booking_id", params.booking_id)

  if (updateError) {
    console.error("[booking] Cancel error:", updateError.message)
    return { error: "Failed to cancel appointment" }
  }

  // 3. Cancel scheduled reminders
  cancelReminders(params.booking_id).catch(() => {})

  // 4. Free the slot lock if any
  try {
    await supabase
      .from("slot_locks")
      .delete()
      .eq("doctor_id", booking.doctor_name) // TODO: needs doctor_id on appointments
      .eq("slot_date", booking.date)
      .eq("slot_time", booking.time)
  } catch { /* non-critical */ }

  return {
    success: true,
    message: `Appointment ${params.booking_id} cancelled successfully.`,
    cancelled_booking: {
      booking_id: params.booking_id,
      patient_name: booking.patient_name,
      doctor_name: booking.doctor_name,
      date: booking.date,
      time: booking.time,
    },
  }
}

/** Look up a patient by phone */
export async function patientLookup(tenantId: string, phone: string) {
  const supabase = createServerClient()
  const normalizedPhone = phone.replace(/\D/g, "")

  // Build phone variants
  const phoneVariants = [normalizedPhone]
  if (normalizedPhone.startsWith("91") && normalizedPhone.length === 12) {
    phoneVariants.push(normalizedPhone.slice(2))
  } else if (normalizedPhone.length === 10) {
    phoneVariants.push(`91${normalizedPhone}`)
  }

  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .in("phone", phoneVariants)
    .limit(1)

  const patient = patients?.[0]
  if (!patient) {
    return { found: false, patient: null }
  }

  // Fetch recent appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select("booking_id, doctor_name, specialty, date, time, status")
    .in("patient_phone", phoneVariants)
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false })
    .limit(5)

  return {
    found: true,
    patient,
    recent_appointments: appointments || [],
  }
}

/** Save (create/update) a patient */
export async function savePatient(data: PatientData) {
  const supabase = createServerClient()
  const normalizedPhone = data.phone.replace(/\D/g, "")

  const { error } = await supabase
    .from("patients")
    .upsert(
      {
        phone: normalizedPhone,
        name: data.name,
        age: data.age,
        gender: data.gender,
        email: data.email,
        address: data.address,
        tenant_id: data.tenant_id,
      },
      { onConflict: "phone" }
    )

  if (error) {
    console.error("[booking] savePatient error:", error.message)
    return { error: "Failed to save patient" }
  }

  return { success: true, phone: normalizedPhone }
}

/** List appointments for a patient */
export async function listAppointments(phone: string, tenantId: string) {
  const supabase = createServerClient()
  const normalizedPhone = phone.replace(/\D/g, "")

  const phoneVariants = [normalizedPhone]
  if (normalizedPhone.startsWith("91") && normalizedPhone.length === 12) {
    phoneVariants.push(normalizedPhone.slice(2))
  } else if (normalizedPhone.length === 10) {
    phoneVariants.push(`91${normalizedPhone}`)
  }

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*")
    .in("patient_phone", phoneVariants)
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false })
    .limit(20)

  if (error) {
    console.error("[booking] listAppointments error:", error.message)
    return { error: "Failed to fetch appointments" }
  }

  return { appointments: appointments || [] }
}
