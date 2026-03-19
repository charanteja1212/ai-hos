"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { AnimatePresence } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { getTodayIST } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import { createNotification } from "@/lib/notifications"
import { calculateEstimatedWait } from "@/lib/utils/estimated-wait"
import type { Doctor, Patient } from "@/types/database"
import { useTenant } from "@/hooks/use-tenant"
import type { Step, SlotInfo, TimeSlot, N8nSlot, N8nDateSlots } from "./booking/types"
import { STEPS } from "./booking/types"
import { PatientStep } from "./booking/patient-step"
import { DoctorStep } from "./booking/doctor-step"
import { SlotStep } from "./booking/slot-step"
import { ConfirmStep } from "./booking/confirm-step"
import { DoneStep } from "./booking/done-step"

export function BookingForm() {
  const { activeTenantId: tenantId } = useBranch()
  const { tenant } = useTenant(tenantId)

  const [step, setStep] = useState<Step>("patient")
  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  const [phone, setPhone] = useState("")
  const [patient, setPatient] = useState<Patient | null>(null)
  const [patientFound, setPatientFound] = useState<boolean | null>(null)
  const [patientName, setPatientName] = useState("")
  const [patientGender, setPatientGender] = useState("")
  const [patientAge, setPatientAge] = useState("")
  const [familyMembers, setFamilyMembers] = useState<string[]>([])
  const lookupDone = useRef(false)

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorSearch, setDoctorSearch] = useState("")
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [availability, setAvailability] = useState<SlotInfo[]>([])
  const [allSlots, setAllSlots] = useState<Record<string, N8nDateSlots>>({})
  const [selectedDate, setSelectedDate] = useState("")
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedTime, setSelectedTime] = useState("")

  const [bookingId, setBookingId] = useState("")
  const [waSent, setWaSent] = useState<boolean | null>(null)

  /* ── Fetch doctors ── */
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from("doctors")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("specialty")
      .then(({ data }) => { if (data) setDoctors(data as Doctor[]) })
  }, [tenantId])

  /* ── Patient lookup ── */
  const lookupPatient = useCallback(async (phoneVal: string) => {
    const digits = phoneVal.replace(/\D/g, "")
    if (digits.length < 10) {
      setPatientFound(null)
      setPatient(null)
      lookupDone.current = false
      return
    }
    if (lookupDone.current) return
    lookupDone.current = true
    setLookingUp(true)
    try {
      const supabase = createBrowserClient()
      const safeDigits = digits.replace(/[^a-zA-Z0-9]/g, "")
      const withPrefix = safeDigits.length === 10 ? `91${safeDigits}` : safeDigits
      const without = safeDigits.startsWith("91") && safeDigits.length === 12 ? safeDigits.slice(2) : safeDigits

      // Fetch patient record + all unique names from past appointments in parallel
      const [patientRes, apptRes] = await Promise.all([
        supabase
          .from("patients")
          .select("*")
          .eq("tenant_id", tenantId)
          .or(`phone.eq.${safeDigits},phone.eq.${withPrefix},phone.eq.${without}`)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("patient_name")
          .eq("tenant_id", tenantId)
          .or(`patient_phone.eq.${safeDigits},patient_phone.eq.${withPrefix},patient_phone.eq.${without}`)
          .order("created_at", { ascending: false })
          .limit(50),
      ])

      // Build unique family member names from appointments
      const names = new Set<string>()
      if (patientRes.data?.name) names.add(patientRes.data.name)
      for (const a of apptRes.data || []) {
        if (a.patient_name?.trim()) names.add(a.patient_name.trim())
      }
      setFamilyMembers([...names])

      if (patientRes.data) {
        const p = patientRes.data as Patient
        setPatient(p)
        setPatientFound(true)
        setPatientName(p.name || "")
        setPatientGender(p.gender || "")
        setPatientAge(p.age ? String(p.age) : "")
      } else if (names.size > 0) {
        // No patient record but has past appointments — treat as found
        const firstName = [...names][0]
        setPatient({ phone: safeDigits, name: firstName, tenant_id: tenantId } as Patient)
        setPatientFound(true)
        setPatientName(firstName)
        setPatientGender("")
        setPatientAge("")
      } else {
        setPatientFound(false)
        setPatient(null)
      }
    } catch {
      setPatientFound(false)
    } finally {
      setLookingUp(false)
    }
  }, [tenantId])

  const handlePhoneChange = (val: string) => {
    setPhone(val)
    const digits = val.replace(/\D/g, "")
    if (digits.length < 10) {
      lookupDone.current = false
      setPatientFound(null)
      setPatient(null)
      setPatientName("")
      setPatientGender("")
      setPatientAge("")
      setFamilyMembers([])
    }
    if (digits.length === 10 || digits.length === 12) {
      lookupPatient(val)
    }
  }

  /* ── Step: Patient → Doctor ── */
  const proceedFromPatient = useCallback(async () => {
    let digits = phone.replace(/\D/g, "")
    if (digits.length < 10) { toast.error("Enter a valid phone number"); return }
    if (digits.length === 10) digits = "91" + digits
    if (!patientName.trim()) { toast.error("Enter patient name"); return }

    if (!patientFound) {
      setLoading(true)
      try {
        const res = await fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-patient",
            phone: digits,
            name: patientName,
            gender: patientGender || "Not specified",
            age: patientAge ? parseInt(patientAge) : null,
            tenant_id: tenantId,
          }),
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          toast.error(errData.error || `Save failed (${res.status})`)
          setLoading(false)
          return
        }
        const data = await res.json()
        if (data.phone || data.success) {
          setPatient({ phone: digits, name: patientName, gender: patientGender || "Not specified", tenant_id: tenantId } as Patient)
          toast.success("Patient saved")
        } else {
          toast.error(data.error || "Failed to save patient")
          setLoading(false)
          return
        }
      } catch {
        toast.error("Error saving patient — check network")
        setLoading(false)
        return
      } finally {
        setLoading(false)
      }
    } else {
      setPatient({ ...(patient || {}), phone: digits, name: patientName, gender: patientGender || "Not specified", tenant_id: tenantId } as Patient)
    }
    setStep("doctor")
  }, [phone, patientName, patientGender, patientAge, patientFound, patient, tenantId])

  /* ── Step: Doctor → Slot ── */
  const fetchAvailability = useCallback(async (doctor: Doctor) => {
    setSelectedDoctor(doctor)
    setLoading(true)
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-availability", doctor_id: doctor.doctor_id, tenant_id: tenantId }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()

      if (data.availability && typeof data.availability === "object") {
        const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const docSlots = Object.values(data.availability)[0] as { date: string; day: string; slots: { date: string; time: string; available: boolean }[] }[] | undefined
        if (docSlots && Array.isArray(docSlots)) {
          const parsed: SlotInfo[] = docSlots.map((ds) => {
            const dateObj = new Date(ds.date + "T00:00:00")
            return { date: ds.date, dateKey: ds.date, day: DAYS[dateObj.getDay()] || ds.day, availableSlots: ds.slots.filter((s) => s.available).length }
          })
          const slotsByDate: Record<string, N8nDateSlots> = {}
          for (const ds of docSlots) {
            const morning: N8nSlot[] = [], afternoon: N8nSlot[] = [], evening: N8nSlot[] = []
            for (const s of ds.slots) {
              if (!s.available) continue
              const [h] = s.time.split(":").map(Number)
              const slot: N8nSlot = { time: s.time, capacity: 1, iso: `${s.date}T${s.time}:00` }
              if (h < 12) morning.push(slot)
              else if (h < 17) afternoon.push(slot)
              else evening.push(slot)
            }
            slotsByDate[ds.date] = { morning, afternoon, evening }
          }
          setAvailability(parsed)
          setAllSlots(slotsByDate)
          setStep("slot")
        } else {
          toast.error("No availability data found")
        }
      } else if (data.available_dates) {
        const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const parsed: SlotInfo[] = data.available_dates.map((d: { date: string; date_key: string; available_count: number }) => {
          const dateObj = new Date(d.date_key + "T00:00:00")
          return { date: d.date_key, dateKey: d.date_key, day: DAYS[dateObj.getDay()] || d.date, availableSlots: d.available_count }
        })
        setAvailability(parsed)
        if (data.slots_by_date) setAllSlots(data.slots_by_date)
        setStep("slot")
      } else if (data.dates) {
        setAvailability(data.dates)
        setStep("slot")
      } else if (data.error) {
        toast.error(data.error)
      } else {
        toast.error("Could not fetch availability")
      }
    } catch {
      toast.error("Error checking availability")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  /* ── Fetch time slots for a date ── */
  const fetchTimeSlots = useCallback((date: string) => {
    setSelectedDate(date)
    let dateSlots: N8nDateSlots | undefined
    for (const [key, val] of Object.entries(allSlots)) {
      if (key === date) { dateSlots = val; break }
      const entry = availability.find((a) => a.date === date)
      if (entry) {
        const d = new Date(date + "T00:00:00")
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        const expected = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
        if (key === expected) { dateSlots = val; break }
      }
    }
    if (dateSlots) {
      const flat: TimeSlot[] = [
        ...(dateSlots.morning || []), ...(dateSlots.afternoon || []), ...(dateSlots.evening || []),
      ].map((s) => ({ time: s.time, status: "available" as const, capacity: s.capacity, iso: s.iso }))
      setTimeSlots(flat)
    } else {
      setLoading(true)
      fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-availability", doctor_id: selectedDoctor?.doctor_id, tenant_id: tenantId, date }),
        signal: AbortSignal.timeout(15000),
      })
        .then((res) => res.json())
        .then((data) => {
          const slots = data.slots_by_date || data.slots || {}
          const firstKey = Object.keys(slots)[0]
          const firstVal = slots[firstKey]
          if (firstVal?.morning || firstVal?.afternoon || firstVal?.evening) {
            const flat: TimeSlot[] = [
              ...(firstVal.morning || []), ...(firstVal.afternoon || []), ...(firstVal.evening || []),
            ].map((s: N8nSlot) => ({ time: s.time, status: "available" as const }))
            setTimeSlots(flat)
          } else {
            const arr = data.time_slots || slots[date] || []
            setTimeSlots(Array.isArray(arr) ? arr : [])
          }
        })
        .catch(() => toast.error("Error fetching time slots"))
        .finally(() => setLoading(false))
    }
  }, [selectedDoctor, tenantId, allSlots, availability])

  /* ── Confirm booking ── */
  const confirmBooking = useCallback(async () => {
    if (!patient || !selectedDoctor || !selectedDate || !selectedTime) return
    setLoading(true)
    try {
      const to24h = (t: string): string => {
        const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
        if (!match) return t
        let h = parseInt(match[1])
        const m = match[2]
        const period = match[3].toUpperCase()
        if (period === "PM" && h !== 12) h += 12
        if (period === "AM" && h === 12) h = 0
        return `${h.toString().padStart(2, "0")}:${m}`
      }
      const time24 = to24h(selectedTime)
      const startTime = `${selectedDate} ${time24}`

      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book-appointment",
          patient_phone: patient.phone,
          patient_name: patient.name,
          patient_age: patientAge ? parseInt(patientAge) : null,
          patient_gender: patientGender || null,
          doctor_id: selectedDoctor.doctor_id,
          doctor_name: selectedDoctor.name,
          specialty: selectedDoctor.specialty,
          date: selectedDate,
          time: time24,
          start_time: startTime,
          tenant_id: tenantId,
          source: "reception_walkin",
          payment_status: "pending",
        }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.booking_id || data.bookingId) {
        setBookingId(data.booking_id || data.bookingId)
        setWaSent(data.wa_sent === true)
        setStep("done")
        toast.success("Appointment booked successfully!")

        const supabase = createBrowserClient()
        const today = getTodayIST()
        const now = new Date().toISOString()
        const bkId = data.booking_id || data.bookingId

        // Only auto-create queue entry + check-in for same-day walk-ins
        // Future-date bookings will be checked in by reception on the appointment day
        const isSameDay = selectedDate === today

        if (isSameDay) {
          const { count: queueCount } = await supabase
            .from("queue_entries")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .eq("date", today)

          const queueNumber = (queueCount || 0) + 1
          const { waitingAhead, estimatedWait } = await calculateEstimatedWait(tenantId, selectedDoctor.doctor_id)

          const { error: queueInsertError } = await supabase.from("queue_entries").insert({
            queue_id: `Q-${Date.now()}`,
            tenant_id: tenantId,
            booking_id: bkId,
            patient_phone: patient.phone,
            patient_name: patient.name,
            doctor_id: selectedDoctor.doctor_id,
            doctor_name: selectedDoctor.name,
            queue_number: queueNumber,
            status: "waiting",
            check_in_time: now,
            walk_in: true,
            priority: 0,
            estimated_wait_minutes: estimatedWait,
            date: today,
          })
          if (queueInsertError) {
            console.error("Queue insert failed:", queueInsertError)
            toast.error("Failed to create queue entry")
          }

          const { error: apptUpdateError } = await supabase
            .from("appointments")
            .update({ check_in_status: "checked_in", arrival_time: now, queue_number: queueNumber })
            .eq("booking_id", bkId)
            .eq("tenant_id", tenantId)
          if (apptUpdateError) console.error("Appointment update failed:", apptUpdateError)

          createNotification({
            tenantId,
            type: "queue_checkin",
            title: "Walk-in patient checked in",
            message: `${patient.name} is waiting for Dr. ${selectedDoctor.name} (Queue #${queueNumber})`,
            targetRole: "DOCTOR",
            targetUserId: selectedDoctor.doctor_id,
            referenceId: bkId,
            referenceType: "queue_entry",
          })

          fetch("/api/queue/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: patient.phone,
              patient_name: patient.name,
              queue_number: queueNumber,
              doctor_name: selectedDoctor.name,
              hospital_name: tenant?.hospital_name || "Hospital",
              estimated_wait: estimatedWait,
              waiting_ahead: waitingAhead || 0,
              queue_url: `${window.location.origin}/queue/${tenantId}`,
            }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => toast.warning("Queue assigned but WhatsApp notification may not have been sent"))

          toast.success(`Queue #${queueNumber} assigned`)
        }
      } else {
        toast.error(data.error || "Booking failed")
      }
    } catch {
      toast.error("Error creating booking")
    } finally {
      setLoading(false)
    }
  }, [patient, selectedDoctor, selectedDate, selectedTime, tenantId])

  const reset = () => {
    setStep("patient"); setPhone(""); setPatient(null); setPatientFound(null)
    setPatientName(""); setPatientGender(""); setPatientAge(""); setFamilyMembers([]); lookupDone.current = false
    setSelectedDoctor(null); setAvailability([]); setAllSlots({})
    setSelectedDate(""); setTimeSlots([]); setSelectedTime(""); setBookingId(""); setWaSent(null); setDoctorSearch("")
  }

  const goBack = () => {
    if (step === "doctor") setStep("patient")
    else if (step === "slot") { setSelectedDate(""); setTimeSlots([]); setSelectedTime(""); setStep("doctor") }
    else if (step === "confirm") setStep("slot")
  }

  const currentIdx = STEPS.findIndex((s) => s.key === step)
  const canProceedPatient = phone.replace(/\D/g, "").length >= 10 && patientName.trim().length > 0 && !lookingUp

  const handleSelectFamilyMember = useCallback((name: string) => {
    setPatientName(name)
    setPatient({ ...(patient || {}), phone: phone.replace(/\D/g, ""), name, tenant_id: tenantId } as Patient)
  }, [patient, phone, tenantId])

  /* ───────────────────── RENDER ───────────────────── */

  return (
    <div className="max-w-xl mx-auto pb-8">
      {/* ── Top bar ── */}
      {step !== "done" && (
        <div className="flex items-center gap-3 mb-6">
          {step !== "patient" && (
            <button
              onClick={goBack}
              aria-label="Go back to previous step"
              className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Walk-in Booking</h1>
            <p className="text-xs text-gray-400">{tenant?.hospital_name || "Hospital"}</p>
          </div>
          {/* Step pills */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i <= currentIdx ? "bg-cyan-600" : "bg-gray-200",
                  i === currentIdx ? "w-6" : "w-1.5"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Main card ── */}
      <div className={cn(
        "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden",
        step === "done" && "border-green-100"
      )}>
        <AnimatePresence mode="wait">

          {step === "patient" && (
            <PatientStep
              phone={phone}
              patientName={patientName}
              patientGender={patientGender}
              patientAge={patientAge}
              lookingUp={lookingUp}
              patientFound={patientFound}
              patient={patient}
              familyMembers={familyMembers}
              canProceedPatient={canProceedPatient}
              loading={loading}
              tenantId={tenantId}
              onPhoneChange={handlePhoneChange}
              onPatientNameChange={setPatientName}
              onPatientGenderChange={setPatientGender}
              onPatientAgeChange={setPatientAge}
              onSelectFamilyMember={handleSelectFamilyMember}
              onProceed={proceedFromPatient}
            />
          )}

          {step === "doctor" && (
            <DoctorStep
              patient={patient}
              patientFound={patientFound}
              doctors={doctors}
              doctorSearch={doctorSearch}
              loading={loading}
              onDoctorSearchChange={setDoctorSearch}
              onSelectDoctor={fetchAvailability}
            />
          )}

          {step === "slot" && (
            <SlotStep
              selectedDoctor={selectedDoctor}
              availability={availability}
              selectedDate={selectedDate}
              timeSlots={timeSlots}
              selectedTime={selectedTime}
              loading={loading}
              onSelectDate={fetchTimeSlots}
              onSelectTime={(time) => { setSelectedTime(time); setStep("confirm") }}
              onChangeDate={() => { setSelectedDate(""); setTimeSlots([]); setSelectedTime("") }}
            />
          )}

          {step === "confirm" && (
            <ConfirmStep
              selectedDoctor={selectedDoctor}
              patient={patient}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              loading={loading}
              onConfirm={confirmBooking}
            />
          )}

          {step === "done" && (
            <DoneStep
              bookingId={bookingId}
              patient={patient}
              selectedDoctor={selectedDoctor}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              waSent={waSent}
              tenant={tenant ? { hospital_name: tenant.hospital_name, whatsapp_phone_number: tenant.whatsapp_phone_number } : null}
              onReset={reset}
            />
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
