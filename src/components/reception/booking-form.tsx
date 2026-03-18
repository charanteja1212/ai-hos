"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Stethoscope,
  User,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Phone,
  Sun,
  Sunset,
  Moon,
  Search,
} from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { formatDate, formatTime, getTodayIST } from "@/lib/utils/date"
import { cn } from "@/lib/utils"
import { createNotification } from "@/lib/notifications"
import { calculateEstimatedWait } from "@/lib/utils/estimated-wait"
import type { Doctor, Patient } from "@/types/database"
import { useTenant } from "@/hooks/use-tenant"

type Step = "patient" | "doctor" | "slot" | "confirm" | "done"

interface SlotInfo {
  date: string
  dateKey: string
  day: string
  availableSlots: number
}

interface TimeSlot {
  time: string
  status: "available" | "booked"
  capacity?: number
  iso?: string
}

interface N8nSlot {
  time: string
  capacity: number
  iso: string
}

interface N8nDateSlots {
  morning?: N8nSlot[]
  afternoon?: N8nSlot[]
  evening?: N8nSlot[]
}

interface N8nAvailabilityResponse {
  success?: boolean
  available_dates?: { date: string; date_key: string; available_count: number }[]
  slots_by_date?: Record<string, N8nDateSlots>
  dates?: SlotInfo[]
  slots?: Record<string, TimeSlot[]>
}

const STEPS: { key: Step; label: string; num: number }[] = [
  { key: "patient", label: "Patient", num: 1 },
  { key: "doctor", label: "Doctor", num: 2 },
  { key: "slot", label: "Schedule", num: 3 },
  { key: "confirm", label: "Confirm", num: 4 },
]

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

  const getHour = (t: string) => {
    const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!match) return parseInt(t.split(":")[0]) || 0
    let h = parseInt(match[1])
    const period = match[3]?.toUpperCase()
    if (period === "PM" && h !== 12) h += 12
    if (period === "AM" && h === 12) h = 0
    return h
  }

  const specialties = [...new Set(doctors.map((d) => d.specialty))]
  const filteredDoctors = doctorSearch
    ? doctors.filter((d) => d.name.toLowerCase().includes(doctorSearch.toLowerCase()) || d.specialty.toLowerCase().includes(doctorSearch.toLowerCase()))
    : doctors

  /* ───────────────────── RENDER ───────────────────── */

  return (
    <div className="max-w-xl mx-auto pb-8">
      {/* ── Top bar ── */}
      {step !== "done" && (
        <div className="flex items-center gap-3 mb-6">
          {step !== "patient" && (
            <button
              onClick={goBack}
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
                  i <= currentIdx ? "bg-blue-500" : "bg-gray-200",
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

          {/* ═══════════ STEP 1: PATIENT ═══════════ */}
          {step === "patient" && (
            <motion.div
              key="patient"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6 space-y-5"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">Patient Details</p>
                <p className="text-xs text-gray-400 mt-0.5">Enter phone to auto-fill existing records</p>
              </div>

              {/* Phone */}
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Phone className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <Input
                  className="h-12 pl-14 pr-24 text-sm rounded-xl border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-gray-50/50"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  autoFocus
                  maxLength={13}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {lookingUp && (
                    <div className="flex items-center gap-1 text-blue-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-[10px] font-medium">Searching</span>
                    </div>
                  )}
                  {patientFound === true && !lookingUp && (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] font-semibold gap-1 h-6">
                      <CheckCircle2 className="w-3 h-3" /> Found
                    </Badge>
                  )}
                  {patientFound === false && !lookingUp && (
                    <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] font-semibold gap-1 h-6">
                      <Sparkles className="w-3 h-3" /> New
                    </Badge>
                  )}
                </div>
              </div>

              {/* Family member selector — shows all known names for this phone */}
              {patientFound === true && familyMembers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2"
                >
                  <p className="text-xs font-medium text-gray-500">
                    {familyMembers.length === 1 ? "Patient found" : `${familyMembers.length} members found — select or add new`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {familyMembers.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { setPatientName(name); setPatient({ ...(patient || {}), phone: phone.replace(/\D/g, ""), name, tenant_id: tenantId } as Patient) }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                          patientName === name
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-gray-50/50 text-gray-700 hover:border-blue-300 hover:bg-blue-50/30"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                          patientName === name ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"
                        )}>
                          {name[0]?.toUpperCase()}
                        </div>
                        {name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newName = ""
                        setPatientName(newName)
                        setPatientGender("")
                        setPatientAge("")
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                        patientName === "" || !familyMembers.includes(patientName)
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-dashed border-gray-300 text-gray-400 hover:border-emerald-400 hover:text-emerald-600"
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      New member
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Full Name</label>
                <Input
                  className="h-12 text-sm rounded-xl border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-gray-50/50"
                  placeholder="Patient full name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>

              {/* Gender + Age */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Gender</label>
                  <Select value={patientGender} onValueChange={setPatientGender}>
                    <SelectTrigger className="h-12 text-sm rounded-xl border-gray-200 bg-gray-50/50">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Age</label>
                  <Input
                    className="h-12 text-sm rounded-xl border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-gray-50/50"
                    type="number"
                    placeholder="Age"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                  />
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={proceedFromPatient}
                disabled={!canProceedPatient || loading}
                className="w-full h-12 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                Continue
              </Button>
            </motion.div>
          )}

          {/* ═══════════ STEP 2: DOCTOR ═══════════ */}
          {step === "doctor" && (
            <motion.div
              key="doctor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6 space-y-4"
            >
              {/* Patient summary */}
              {patient && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                    {patient.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{patient.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{patient.phone}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-medium bg-gray-100 text-gray-500">
                    {patientFound ? "Existing" : "New"}
                  </Badge>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-900">Select Doctor</p>
                <p className="text-xs text-gray-400 mt-0.5">{doctors.length} doctors available</p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <Input
                  className="h-10 pl-9 text-sm rounded-xl border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-gray-50/50"
                  placeholder="Search doctor or specialty..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                />
              </div>

              {/* Doctor list */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto -mx-1 px-1">
                {(doctorSearch ? [{ specialty: "Results", doctors: filteredDoctors }] : specialties.map(s => ({ specialty: s, doctors: doctors.filter(d => d.specialty === s) }))).map(({ specialty, doctors: specDoctors }) => (
                  <div key={specialty}>
                    {!doctorSearch && (
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-3 first:mt-0">{specialty}</p>
                    )}
                    {specDoctors.map((doctor, di) => (
                      <motion.button
                        key={doctor.doctor_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: di * 0.03 }}
                        onClick={() => fetchAvailability(doctor)}
                        disabled={loading}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-transparent hover:bg-blue-50/50 hover:border-blue-100 transition-all text-left group mb-1"
                      >
                        {(doctor as Doctor & { image_url?: string }).image_url ? (
                          <img
                            src={(doctor as Doctor & { image_url?: string }).image_url!}
                            alt={doctor.name}
                            className="w-10 h-10 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <Stethoscope className="w-4 h-4 text-blue-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{doctor.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{doctor.specialty}</span>
                            {(doctor as Doctor & { consultation_fee?: number }).consultation_fee && (
                              <span className="text-xs text-gray-300 font-mono">
                                ₹{(doctor as Doctor & { consultation_fee?: number }).consultation_fee}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center py-6 gap-2 text-blue-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Loading availability...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════ STEP 3: DATE & TIME ═══════════ */}
          {step === "slot" && (
            <motion.div
              key="slot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6 space-y-5"
            >
              {/* Doctor summary */}
              {selectedDoctor && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedDoctor.name}</p>
                    <p className="text-xs text-gray-400">{selectedDoctor.specialty}</p>
                  </div>
                </div>
              )}

              {/* Date strip */}
              {!selectedDate && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-3">Pick a date</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    {availability.map((slot, i) => {
                      const isToday = slot.date === getTodayIST()
                      const hasSlots = slot.availableSlots > 0
                      const d = new Date(slot.date + "T00:00:00")
                      return (
                        <motion.button
                          key={slot.date}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => fetchTimeSlots(slot.date)}
                          disabled={!hasSlots || loading}
                          className={cn(
                            "flex flex-col items-center min-w-[68px] py-3 px-3 rounded-xl border transition-all",
                            !hasSlots
                              ? "border-gray-100 opacity-30 cursor-not-allowed"
                              : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50",
                            isToday && hasSlots && "border-blue-300 bg-blue-50/50"
                          )}
                        >
                          <span className="text-[10px] font-medium text-gray-400 uppercase">
                            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}
                          </span>
                          <span className="text-xl font-bold text-gray-900 mt-0.5 leading-none">{d.getDate()}</span>
                          <span className="text-[10px] text-gray-300 mt-0.5">
                            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}
                          </span>
                          <div className={cn(
                            "mt-2 text-[9px] font-semibold px-2 py-0.5 rounded-full",
                            slot.availableSlots > 10
                              ? "bg-emerald-50 text-emerald-600"
                              : slot.availableSlots > 3
                                ? "bg-amber-50 text-amber-600"
                                : "bg-red-50 text-red-500"
                          )}>
                            {slot.availableSlots}
                          </div>
                          {isToday && <span className="text-[8px] font-bold text-blue-500 mt-0.5">TODAY</span>}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Time slots */}
              {selectedDate && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-gray-500">{formatDate(selectedDate)}</p>
                    <button
                      onClick={() => { setSelectedDate(""); setTimeSlots([]); setSelectedTime("") }}
                      className="text-xs text-blue-500 font-medium hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                    </div>
                  ) : (() => {
                    const available = timeSlots.filter((s) => s.status === "available")
                    if (available.length === 0) {
                      return (
                        <div className="text-center py-10">
                          <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">No slots available</p>
                          <p className="text-xs text-gray-300 mt-1">Try another date</p>
                        </div>
                      )
                    }
                    const morning = available.filter((s) => getHour(s.time) < 12)
                    const afternoon = available.filter((s) => { const h = getHour(s.time); return h >= 12 && h < 17 })
                    const evening = available.filter((s) => getHour(s.time) >= 17)
                    const groups = [
                      { label: "Morning", slots: morning, Icon: Sun, accent: "text-amber-500", bg: "bg-amber-50" },
                      { label: "Afternoon", slots: afternoon, Icon: Sunset, accent: "text-orange-500", bg: "bg-orange-50" },
                      { label: "Evening", slots: evening, Icon: Moon, accent: "text-indigo-500", bg: "bg-indigo-50" },
                    ].filter((g) => g.slots.length > 0)

                    return (
                      <div className="space-y-4">
                        {groups.map((group) => (
                          <div key={group.label}>
                            <div className="flex items-center gap-2 mb-2">
                              <group.Icon className={cn("w-3.5 h-3.5", group.accent)} />
                              <span className="text-xs font-medium text-gray-500">{group.label}</span>
                              <span className="text-[10px] text-gray-300 ml-auto">{group.slots.length} slots</span>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {group.slots.map((slot) => (
                                <button
                                  key={slot.time}
                                  onClick={() => { setSelectedTime(slot.time); setStep("confirm") }}
                                  className={cn(
                                    "py-2.5 px-2 rounded-lg text-sm font-medium border transition-all",
                                    selectedTime === slot.time
                                      ? "border-blue-500 bg-blue-500 text-white"
                                      : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-gray-700"
                                  )}
                                >
                                  {formatTime(slot.time)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════ STEP 4: CONFIRM ═══════════ */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6 space-y-5"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">Review Appointment</p>
                <p className="text-xs text-gray-400 mt-0.5">Confirm the details below</p>
              </div>

              {/* Summary card */}
              <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
                {/* Doctor */}
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{selectedDoctor?.name}</p>
                    <p className="text-xs text-gray-400">{selectedDoctor?.specialty}</p>
                  </div>
                </div>

                {/* Patient */}
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{patient?.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{patient?.phone}</p>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  <div className="flex items-center gap-3 p-4">
                    <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium">Date</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(selectedDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium">Time</p>
                      <p className="text-sm font-semibold text-gray-900">{formatTime(selectedTime)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={confirmBooking}
                disabled={loading}
                className="w-full h-12 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Booking...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Confirm & Assign Queue</>
                )}
              </Button>
            </motion.div>
          )}

          {/* ═══════════ STEP 5: DONE ═══════════ */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="p-6 text-center space-y-5"
            >
              {/* Success icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </motion.div>

              <div>
                <h2 className="text-lg font-bold text-gray-900">Appointment Booked</h2>
                <p className="text-xs text-gray-400 mt-1">Queue assigned automatically</p>
              </div>

              {/* Booking summary */}
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Booking ID</span>
                  <span className="text-xs font-mono font-semibold text-blue-600">{bookingId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Patient</span>
                  <span className="text-xs font-semibold text-gray-700">{patient?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Doctor</span>
                  <span className="text-xs font-semibold text-gray-700">{selectedDoctor?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Schedule</span>
                  <span className="text-xs font-semibold text-gray-700">{formatDate(selectedDate)} · {formatTime(selectedTime)}</span>
                </div>
              </div>

              {/* WhatsApp status */}
              {waSent === true && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-left"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">WhatsApp confirmation sent</p>
                </motion.div>
              )}
              {waSent === false && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-left space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">WhatsApp not delivered</p>
                  </div>
                  <a
                    href={`https://wa.me/${tenant?.whatsapp_phone_number || "918125442376"}?text=${encodeURIComponent(`Hi, I just booked appointment ${bookingId}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" />
                    Open WhatsApp
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </motion.div>
              )}

              <Button
                onClick={reset}
                className="w-full h-12 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Book Another
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
