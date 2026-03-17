"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useBranch } from "@/components/providers/branch-context"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  MapPin,
  Sun,
  Sunset,
  Moon,
  Shield,
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

const STEP_CONFIG = [
  { key: "patient" as const, label: "Patient", icon: User },
  { key: "doctor" as const, label: "Doctor", icon: Stethoscope },
  { key: "slot" as const, label: "Schedule", icon: Calendar },
  { key: "confirm" as const, label: "Confirm", icon: Shield },
]

const SPECIALTY_COLORS: Record<string, { gradient: string; glow: string; icon: string }> = {
  "Cardiology": { gradient: "from-red-500 to-rose-400", glow: "shadow-red-500/20", icon: "gradient-red" },
  "Dermatology": { gradient: "from-amber-500 to-orange-400", glow: "shadow-amber-500/20", icon: "gradient-orange" },
  "Neurology": { gradient: "from-purple-500 to-violet-400", glow: "shadow-purple-500/20", icon: "gradient-purple" },
  "Orthopedics": { gradient: "from-blue-500 to-cyan-400", glow: "shadow-blue-500/20", icon: "gradient-blue" },
  "Pediatrics": { gradient: "from-emerald-500 to-green-400", glow: "shadow-emerald-500/20", icon: "gradient-green" },
  "General Medicine": { gradient: "from-sky-500 to-blue-400", glow: "shadow-sky-500/20", icon: "gradient-blue" },
  "ENT": { gradient: "from-teal-500 to-cyan-400", glow: "shadow-teal-500/20", icon: "gradient-teal" },
}

function getSpecialtyStyle(specialty: string) {
  return SPECIALTY_COLORS[specialty] || { gradient: "from-blue-500 to-cyan-400", glow: "shadow-blue-500/20", icon: "gradient-blue" }
}

export function BookingForm() {
  const { activeTenantId: tenantId } = useBranch()
  const { tenant } = useTenant(tenantId)

  const [step, setStep] = useState<Step>("patient")
  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  // Unified patient form
  const [phone, setPhone] = useState("")
  const [patient, setPatient] = useState<Patient | null>(null)
  const [patientFound, setPatientFound] = useState<boolean | null>(null)
  const [patientName, setPatientName] = useState("")
  const [patientGender, setPatientGender] = useState("")
  const [patientAge, setPatientAge] = useState("")
  const lookupDone = useRef(false)

  // Doctor & slot state
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [availability, setAvailability] = useState<SlotInfo[]>([])
  const [allSlots, setAllSlots] = useState<Record<string, N8nDateSlots>>({})
  const [selectedDate, setSelectedDate] = useState("")
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedTime, setSelectedTime] = useState("")

  // Booking result
  const [bookingId, setBookingId] = useState("")
  const [waSent, setWaSent] = useState<boolean | null>(null)

  // Fetch doctors on mount
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from("doctors")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("specialty")
      .then(({ data }) => {
        if (data) setDoctors(data as Doctor[])
      })
  }, [tenantId])

  // Auto-lookup patient when phone reaches 10+ digits
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
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("tenant_id", tenantId)
        .or(`phone.eq.${digits.replace(/[^a-zA-Z0-9\s\-\.]/g, "")},phone.eq.+${digits.replace(/[^a-zA-Z0-9\s\-\.]/g, "")}`)
        .limit(1)
        .maybeSingle()

      if (data) {
        const p = data as Patient
        setPatient(p)
        setPatientFound(true)
        setPatientName(p.name || "")
        setPatientGender(p.gender || "")
        setPatientAge(p.age ? String(p.age) : "")
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
    // Reset lookup when phone changes
    if (digits.length < 10) {
      lookupDone.current = false
      setPatientFound(null)
      setPatient(null)
      setPatientName("")
      setPatientGender("")
      setPatientAge("")
    }
    if (digits.length === 10 || digits.length === 12) {
      lookupPatient(val)
    }
  }

  const proceedFromPatient = useCallback(async () => {
    let digits = phone.replace(/\D/g, "")
    if (digits.length < 10) {
      toast.error("Enter a valid phone number")
      return
    }
    // Normalize to 12-digit format with country code
    if (digits.length === 10) {
      digits = "91" + digits
    }
    if (!patientName.trim()) {
      toast.error("Enter patient name")
      return
    }

    // If new patient, save first
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
          setPatient({
            phone: digits,
            name: patientName,
            gender: patientGender || "Not specified",
            tenant_id: tenantId,
          } as Patient)
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
      // Existing patient — update local state
      setPatient({
        ...(patient || {}),
        phone: digits,
        name: patientName,
        gender: patientGender || "Not specified",
        tenant_id: tenantId,
      } as Patient)
    }

    setStep("doctor")
  }, [phone, patientName, patientGender, patientAge, patientFound, patient, tenantId])

  const fetchAvailability = useCallback(
    async (doctor: Doctor) => {
      setSelectedDoctor(doctor)
      setLoading(true)
      try {
        const res = await fetch("/api/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "check-availability",
            doctor_id: doctor.doctor_id,
            tenant_id: tenantId,
          }),
          signal: AbortSignal.timeout(15000),
        })
        const data = await res.json()

        // Handle direct Supabase service response: { availability: { [doctorId]: DaySlots[] } }
        if (data.availability && typeof data.availability === "object") {
          const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          // Get the first doctor's slots (we query one doctor at a time)
          const docSlots = Object.values(data.availability)[0] as { date: string; day: string; slots: { date: string; time: string; available: boolean }[] }[] | undefined
          if (docSlots && Array.isArray(docSlots)) {
            const parsed: SlotInfo[] = docSlots.map((ds) => {
              const dateObj = new Date(ds.date + "T00:00:00")
              const availCount = ds.slots.filter((s) => s.available).length
              return {
                date: ds.date,
                dateKey: ds.date,
                day: DAYS[dateObj.getDay()] || ds.day,
                availableSlots: availCount,
              }
            })
            // Build slots_by_date in the morning/afternoon/evening format
            const slotsByDate: Record<string, N8nDateSlots> = {}
            for (const ds of docSlots) {
              const morning: N8nSlot[] = []
              const afternoon: N8nSlot[] = []
              const evening: N8nSlot[] = []
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
          // Legacy n8n format
          const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          const parsed: SlotInfo[] = data.available_dates.map((d: { date: string; date_key: string; available_count: number }) => {
            const dateObj = new Date(d.date_key + "T00:00:00")
            return {
              date: d.date_key,
              dateKey: d.date_key,
              day: DAYS[dateObj.getDay()] || d.date,
              availableSlots: d.available_count,
            }
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
    },
    [tenantId]
  )

  const fetchTimeSlots = useCallback(
    (date: string) => {
      setSelectedDate(date)
      let dateSlots: N8nDateSlots | undefined
      for (const [key, val] of Object.entries(allSlots)) {
        if (key === date) { dateSlots = val; break }
        const entry = availability.find((a) => a.date === date)
        if (entry) {
          const d = new Date(date + "T00:00:00")
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
          const expected = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
          if (key === expected) { dateSlots = val; break }
        }
      }

      if (dateSlots) {
        const flat: TimeSlot[] = [
          ...(dateSlots.morning || []),
          ...(dateSlots.afternoon || []),
          ...(dateSlots.evening || []),
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
    },
    [selectedDoctor, tenantId, allSlots, availability]
  )

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
          phone: patient.phone,
          patient_name: patient.name,
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

        if (apptUpdateError) {
          console.error("Appointment update failed:", apptUpdateError)
        }

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

        // Send WhatsApp token notification (fire-and-forget)
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
    setStep("patient")
    setPhone("")
    setPatient(null)
    setPatientFound(null)
    setPatientName("")
    setPatientGender("")
    setPatientAge("")
    lookupDone.current = false
    setSelectedDoctor(null)
    setAvailability([])
    setAllSlots({})
    setSelectedDate("")
    setTimeSlots([])
    setSelectedTime("")
    setBookingId("")
    setWaSent(null)
  }

  const goBack = () => {
    if (step === "doctor") setStep("patient")
    else if (step === "slot") {
      setSelectedDate("")
      setTimeSlots([])
      setSelectedTime("")
      setStep("doctor")
    }
    else if (step === "confirm") setStep("slot")
  }

  const specialties = [...new Set(doctors.map((d) => d.specialty))]
  const currentStepIdx = STEP_CONFIG.findIndex((s) => s.key === step)

  const getShortDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]
  }
  const getDayNum = (dateStr: string) => new Date(dateStr + "T00:00:00").getDate()
  const getMonthShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]
  }

  const canProceedPatient = phone.replace(/\D/g, "").length >= 10 && patientName.trim().length > 0 && !lookingUp

  return (
    <div className="max-w-2xl mx-auto">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-t-2xl gradient-blue-premium p-6 pb-8">
        <div className="noise-overlay absolute inset-0 rounded-t-2xl" />
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMC43IiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjA4Ii8+PC9zdmc+')] opacity-60" />
        {/* Decorative gradient orbs */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            {step !== "patient" && step !== "done" && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={goBack}
                className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors ring-1 ring-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.button>
            )}
            <div className={cn("flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5", step === "patient" || step === "done" ? "" : "ml-auto")}>
              <MapPin className="w-3 h-3 text-white/80" />
              <span className="text-[11px] text-white/80 font-semibold">{tenant?.hospital_name || "Hospital"}</span>
            </div>
          </div>
          <motion.h1
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-black text-white mt-3 tracking-tight"
          >
            {step === "done" ? "Booking Confirmed!" : "Walk-in Appointment"}
          </motion.h1>
          <motion.p
            key={`sub-${step}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-white/60 mt-1 font-medium"
          >
            {step === "patient" && "Enter patient details to get started"}
            {step === "doctor" && "Choose your specialist"}
            {step === "slot" && "Pick a convenient time"}
            {step === "confirm" && "Review and confirm your appointment"}
            {step === "done" && "Appointment has been scheduled successfully"}
          </motion.p>
        </div>
      </div>

      {/* Step Indicator — Connected Progress */}
      {step !== "done" && (
        <div className="relative -mt-4 z-10 px-4 mb-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center">
              {STEP_CONFIG.map((s, i) => {
                const isActive = i === currentStepIdx
                const isDone = i < currentStepIdx
                const Icon = s.icon
                return (
                  <div key={s.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5 relative">
                      <motion.div
                        animate={{
                          scale: isActive ? 1.15 : 1,
                          backgroundColor: isDone ? "var(--success)" : isActive ? "var(--primary)" : "var(--muted)",
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center transition-all relative z-10",
                          isDone && "glow-green shadow-lg shadow-green-500/25",
                          isActive && "glow-blue shadow-lg shadow-primary/25 ring-4 ring-primary/10",
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        ) : (
                          <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-muted-foreground")} />
                        )}
                      </motion.div>
                      <span className={cn(
                        "text-[10px] font-bold tracking-wider",
                        isDone ? "text-green-600 dark:text-green-400" : isActive ? "text-primary" : "text-muted-foreground/40"
                      )}>
                        {s.label}
                      </span>
                    </div>
                    {/* Connecting line */}
                    {i < STEP_CONFIG.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 rounded-full bg-muted/50 relative overflow-hidden mb-5">
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{ width: isDone ? "100%" : isActive ? "50%" : "0%" }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full",
                            isDone ? "bg-green-500" : "bg-primary"
                          )}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={cn(
        "bg-card rounded-b-2xl border border-border border-t-0 shadow-sm",
        step === "done" && "rounded-2xl border-t -mt-4"
      )}>
        <div className="p-5">
          <AnimatePresence mode="wait">
            {/* ========== PATIENT (single form) ========== */}
            {step === "patient" && (
              <motion.div
                key="patient"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Phone number */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                    Phone Number
                  </Label>
                  <div className="relative group">
                    <Input
                      className="h-13 text-base rounded-xl border-2 border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-muted/20 pr-28 transition-all pl-4"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      autoFocus
                      maxLength={13}
                    />
                    {/* Status indicator inside input */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {lookingUp && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5 bg-primary/10 rounded-full px-2.5 py-1"
                        >
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          <span className="text-[10px] text-primary font-bold">Searching...</span>
                        </motion.div>
                      )}
                      {patientFound === true && !lookingUp && (
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px] font-bold gap-1 shadow-sm shadow-green-500/10">
                            <CheckCircle2 className="w-3 h-3" /> FOUND
                          </Badge>
                        </motion.div>
                      )}
                      {patientFound === false && !lookingUp && (
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px] font-bold gap-1 shadow-sm shadow-amber-500/10">
                            <Sparkles className="w-3 h-3" /> NEW
                          </Badge>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient found card */}
                {patientFound === true && patient && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30 p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 text-sm font-bold shrink-0">
                      {(patient.name || "P")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">{patient.name}</p>
                      <p className="text-[10px] text-green-600/70 dark:text-green-400/60">Existing patient record loaded</p>
                    </div>
                  </motion.div>
                )}

                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                    Full Name
                  </Label>
                  <Input
                    className="h-13 text-base rounded-xl border-2 border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-muted/20 transition-all"
                    placeholder="Patient full name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>

                {/* Gender + Age in row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                      Gender
                    </Label>
                    <Select value={patientGender} onValueChange={setPatientGender}>
                      <SelectTrigger className="w-full h-13 text-base rounded-xl border-2 border-border/50 bg-muted/20">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                      Age
                    </Label>
                    <Input
                      className="w-full h-13 text-base rounded-xl border-2 border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-muted/20 transition-all"
                      type="number"
                      placeholder="Age"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                    />
                  </div>
                </div>

                <motion.div whileHover={{ scale: canProceedPatient && !loading ? 1.01 : 1 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={proceedFromPatient}
                    disabled={!canProceedPatient || loading}
                    className="w-full h-13 rounded-xl text-base font-bold gradient-blue hover:opacity-90 transition-all border-0 shadow-lg shadow-primary/20"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <ChevronRight className="w-5 h-5 mr-2" />
                    )}
                    Continue to Doctor Selection
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ========== DOCTOR SELECTION ========== */}
            {step === "doctor" && (
              <motion.div
                key="doctor"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Patient summary pill */}
                {patient && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/10">
                      <span className="text-sm font-bold text-primary">
                        {patient.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{patient.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{patient.phone}</p>
                    </div>
                    <Badge variant="secondary" className={cn(
                      "text-[10px] font-bold",
                      patientFound
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {patientFound ? "EXISTING" : "NEW"}
                    </Badge>
                  </div>
                )}

                <div className="space-y-5">
                  {specialties.map((specialty, si) => {
                    const style = getSpecialtyStyle(specialty)
                    const specDoctors = doctors.filter((d) => d.specialty === specialty)
                    return (
                      <motion.div
                        key={specialty}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: si * 0.08 }}
                      >
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className={cn("w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center", style.gradient)}>
                            <Stethoscope className="w-3 h-3 text-white" />
                          </div>
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {specialty}
                          </p>
                          <Badge variant="secondary" className="text-[9px] font-mono ml-auto">
                            {specDoctors.length} doctor{specDoctors.length > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="space-y-2.5">
                          {specDoctors.map((doctor, di) => (
                              <motion.button
                                key={doctor.doctor_id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: si * 0.08 + di * 0.04 }}
                                whileHover={{ scale: 1.01, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => fetchAvailability(doctor)}
                                disabled={loading}
                                className={cn(
                                  "w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border/40",
                                  "hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all text-left",
                                  "bg-gradient-to-r from-card via-card to-muted/10 group relative overflow-hidden"
                                )}
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                                {(doctor as Doctor & { image_url?: string }).image_url ? (
                                  <img src={(doctor as Doctor & { image_url?: string }).image_url!} alt={doctor.name} className="w-12 h-12 rounded-2xl object-cover shadow-lg shrink-0 relative border border-border/30" />
                                ) : (
                                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 relative", style.icon)}>
                                    <Stethoscope className="w-5 h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 relative">
                                  <p className="text-sm font-bold text-foreground">{doctor.name}</p>
                                  {(doctor as Doctor & { designation?: string }).designation && (
                                    <p className="text-[11px] text-primary/80 font-medium mt-0.5">{(doctor as Doctor & { designation?: string }).designation}</p>
                                  )}
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{doctor.specialty}</p>
                                  {(doctor as Doctor & { consultation_fee?: number }).consultation_fee && (
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                                      ₹{(doctor as Doctor & { consultation_fee?: number }).consultation_fee}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 relative">
                                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                                </div>
                              </motion.button>
                            ))}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                {loading && (
                  <div className="space-y-2">
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                  </div>
                )}
              </motion.div>
            )}

            {/* ========== DATE & TIME ========== */}
            {step === "slot" && (
              <motion.div
                key="slot"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {selectedDoctor && (
                  <div className="flex items-center gap-3 p-3 rounded-xl glass-subtle">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getSpecialtyStyle(selectedDoctor.specialty).icon)}>
                      <Stethoscope className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{selectedDoctor.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedDoctor.specialty}</p>
                    </div>
                  </div>
                )}

                {/* Date cards */}
                {!selectedDate && (
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" /> Select Date
                    </Label>
                    <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                      {availability.map((slot, i) => {
                        const isToday = slot.date === getTodayIST()
                        const hasSlots = slot.availableSlots > 0
                        return (
                          <motion.button
                            key={slot.date}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            whileHover={hasSlots ? { scale: 1.05, y: -4 } : {}}
                            whileTap={hasSlots ? { scale: 0.95 } : {}}
                            onClick={() => fetchTimeSlots(slot.date)}
                            disabled={!hasSlots || loading}
                            className={cn(
                              "flex flex-col items-center min-w-[76px] p-3.5 rounded-2xl border-2 transition-all relative overflow-hidden",
                              !hasSlots
                                ? "border-border/20 opacity-35 cursor-not-allowed"
                                : "border-border/40 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10",
                              isToday && hasSlots && "border-primary/40 bg-primary/5 ring-2 ring-primary/10"
                            )}
                          >
                            {isToday && hasSlots && (
                              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-blue-400" />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {getShortDay(slot.date)}
                            </span>
                            <span className="text-2xl font-black mt-1 leading-none tracking-tight">{getDayNum(slot.date)}</span>
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5 font-medium">{getMonthShort(slot.date)}</span>
                            <div className={cn(
                              "mt-2.5 px-2.5 py-0.5 rounded-full text-[9px] font-black",
                              slot.availableSlots > 10
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : slot.availableSlots > 3
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}>
                              {slot.availableSlots} slot{slot.availableSlots !== 1 ? "s" : ""}
                            </div>
                            {isToday && <span className="text-[8px] font-black text-primary mt-1 tracking-wider">TODAY</span>}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Time slots */}
                {selectedDate && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> {formatDate(selectedDate)}
                      </Label>
                      <button
                        onClick={() => { setSelectedDate(""); setTimeSlots([]); setSelectedTime(""); }}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Change
                      </button>
                    </div>
                    {loading ? (
                      <div className="grid grid-cols-4 gap-2.5">
                        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                      </div>
                    ) : (() => {
                      const available = timeSlots.filter((s) => s.status === "available")
                      if (available.length === 0) {
                        return (
                          <div className="text-center py-10">
                            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                              <Clock className="w-7 h-7 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">No slots available</p>
                            <p className="text-[11px] text-muted-foreground/50 mt-1">Try a different date</p>
                          </div>
                        )
                      }
                      const getHour = (t: string) => {
                        const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
                        if (!match) return parseInt(t.split(":")[0]) || 0
                        let h = parseInt(match[1])
                        const period = match[3]?.toUpperCase()
                        if (period === "PM" && h !== 12) h += 12
                        if (period === "AM" && h === 12) h = 0
                        return h
                      }
                      const morning = available.filter((s) => getHour(s.time) < 12)
                      const afternoon = available.filter((s) => { const h = getHour(s.time); return h >= 12 && h < 17 })
                      const evening = available.filter((s) => getHour(s.time) >= 17)
                      const groups = [
                        { label: "Morning", slots: morning, Icon: Sun, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-100 dark:border-amber-900/30" },
                        { label: "Afternoon", slots: afternoon, Icon: Sunset, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-100 dark:border-orange-900/30" },
                        { label: "Evening", slots: evening, Icon: Moon, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/20", border: "border-indigo-100 dark:border-indigo-900/30" },
                      ].filter((g) => g.slots.length > 0)

                      return (
                        <div className="space-y-4">
                          {groups.map((group, gi) => (
                            <motion.div
                              key={group.label}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: gi * 0.1 }}
                              className={cn("rounded-xl p-3.5 border", group.bg, group.border)}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <group.Icon className={cn("w-4 h-4", group.color)} />
                                <span className="text-xs font-bold text-foreground">{group.label}</span>
                                <Badge variant="secondary" className="text-[9px] font-mono ml-auto">
                                  {group.slots.length}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {group.slots.map((slot, si) => (
                                  <motion.button
                                    key={slot.time}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: gi * 0.1 + si * 0.02 }}
                                    whileHover={{ scale: 1.05, y: -1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setSelectedTime(slot.time); setStep("confirm"); }}
                                    className={cn(
                                      "py-2.5 px-2 rounded-xl text-sm font-bold transition-all border-2",
                                      selectedTime === slot.time
                                        ? "border-primary bg-primary text-white shadow-lg shadow-primary/30"
                                        : "border-border/30 hover:border-primary/40 bg-card hover:shadow-md"
                                    )}
                                  >
                                    {formatTime(slot.time)}
                                  </motion.button>
                                ))}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </motion.div>
            )}

            {/* ========== CONFIRM — Premium Ticket ========== */}
            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border-2 border-border/40 overflow-hidden shadow-lg shadow-black/5">
                  {/* Doctor hero */}
                  <div className={cn("p-5 relative", getSpecialtyStyle(selectedDoctor?.specialty || "").icon)}>
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMC43IiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjA4Ii8+PC9zdmc+')] opacity-50" />
                    <div className="relative flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/10">
                        <Stethoscope className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-white">
                        <p className="font-black text-lg tracking-tight">{selectedDoctor?.name}</p>
                        <p className="text-sm text-white/70 font-medium">{selectedDoctor?.specialty}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tear line */}
                  <div className="relative h-4 bg-card">
                    <div className="absolute -top-2 left-0 w-4 h-4 bg-background rounded-full" />
                    <div className="absolute -top-2 right-0 w-4 h-4 bg-background rounded-full" />
                    <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 border-t-2 border-dashed border-border/40" />
                  </div>

                  {/* Booking details */}
                  <div className="p-5 space-y-4 bg-card">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Patient</p>
                        <p className="text-sm font-bold mt-0.5">{patient?.name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Date</p>
                          <p className="text-sm font-bold mt-0.5">{formatDate(selectedDate)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Time</p>
                          <p className="text-sm font-bold mt-0.5">{formatTime(selectedTime)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <motion.div whileHover={{ scale: !loading ? 1.01 : 1 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={confirmBooking}
                    disabled={loading}
                    className="w-full h-14 rounded-xl text-base font-black gradient-green hover:opacity-90 transition-all border-0 shadow-lg shadow-green-500/20"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Booking...</>
                    ) : (
                      <><CheckCircle2 className="w-5 h-5 mr-2" /> Confirm Appointment</>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ========== DONE — Celebration ========== */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="text-center space-y-5 py-2"
              >
                {/* Celebration icon with floating particles */}
                <div className="relative inline-block">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                    className="w-24 h-24 rounded-3xl gradient-green glow-green flex items-center justify-center mx-auto shadow-2xl shadow-green-500/30"
                  >
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full gradient-blue flex items-center justify-center shadow-lg"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </motion.div>
                  {/* Floating particles */}
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                        x: [0, (i % 2 === 0 ? 1 : -1) * (30 + i * 10)],
                        y: [0, -(20 + i * 15)],
                      }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 1.2, ease: "easeOut" }}
                      className={cn(
                        "absolute top-1/2 left-1/2 w-2 h-2 rounded-full",
                        i === 0 && "bg-green-400",
                        i === 1 && "bg-blue-400",
                        i === 2 && "bg-amber-400",
                        i === 3 && "bg-purple-400",
                      )}
                    />
                  ))}
                </div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <h2 className="text-2xl font-black tracking-tight">All Set!</h2>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Appointment booked & queue assigned</p>
                </motion.div>

                {/* Premium booking ticket */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border-2 border-border/40 overflow-hidden text-left shadow-lg shadow-black/5"
                >
                  <div className="p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-bold">{patient?.name}</span>
                      </div>
                      <Badge className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20 px-2.5 py-1">
                        {bookingId}
                      </Badge>
                    </div>
                  </div>
                  {/* Tear line */}
                  <div className="relative h-3">
                    <div className="absolute -top-1.5 left-0 w-3 h-3 bg-background rounded-full" />
                    <div className="absolute -top-1.5 right-0 w-3 h-3 bg-background rounded-full" />
                    <div className="absolute top-1/2 -translate-y-1/2 left-3 right-3 border-t border-dashed border-border/50" />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Doctor</p>
                        <p className="font-bold mt-0.5">{selectedDoctor?.name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Specialty</p>
                        <p className="font-bold mt-0.5">{selectedDoctor?.specialty}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Date</p>
                        <p className="font-bold mt-0.5">{formatDate(selectedDate)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Time</p>
                        <p className="font-bold mt-0.5">{formatTime(selectedTime)}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* WhatsApp status */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  {waSent === true && (
                    <div className="rounded-xl bg-green-50/80 dark:bg-green-950/30 border border-green-200/60 dark:border-green-800/40 p-3.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium text-left">WhatsApp confirmation sent to patient</p>
                    </div>
                  )}
                  {waSent === false && (
                    <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 p-4 space-y-3 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                          <MessageCircle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">WhatsApp not delivered</p>
                          <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70 mt-0.5">
                            Ask the patient to send &quot;Hi&quot; to receive their QR code
                          </p>
                        </div>
                      </div>
                      <a
                        href={`https://wa.me/${tenant?.whatsapp_phone_number || "918125442376"}?text=${encodeURIComponent(`Hi, I just booked appointment ${bookingId}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shadow-md shadow-green-600/20"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Open WhatsApp
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={reset}
                      className="w-full h-13 rounded-xl text-base font-bold gradient-blue hover:opacity-90 transition-all border-0 shadow-lg shadow-primary/20"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Book Another Appointment
                    </Button>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
