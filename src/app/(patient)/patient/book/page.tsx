"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Stethoscope,
  CalendarDays,
  Clock,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  User,
  ArrowRight,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createBrowserClient } from "@/lib/supabase/client"
import Link from "next/link"
import type { SessionUser } from "@/types/auth"

type Step = "specialty" | "doctor" | "slot" | "confirm" | "done"

interface DoctorOption {
  doctor_id: string
  doctor_name: string
  specialty: string
}

interface DaySlots {
  date: string
  day: string
  slots: string[]
}

export default function PatientBookPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser | undefined

  const [step, setStep] = useState<Step>("specialty")
  const [tenantId, setTenantId] = useState("")
  const [hospitals, setHospitals] = useState<{ tenant_id: string; hospital_name: string }[]>([])
  const [specialties, setSpecialties] = useState<string[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState("")
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null)
  const [availability, setAvailability] = useState<DaySlots[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookingResult, setBookingResult] = useState<{ booking_id?: string; payment_link?: string } | null>(null)

  // Resolve tenant: session → patient record → appointments → show hospital picker
  useEffect(() => {
    if (!user) return

    // 1. Session already has tenantId (most patients registered at a hospital)
    if (user.tenantId) {
      setTenantId(user.tenantId)
      return
    }

    // 2. Fallback: check appointments for tenant
    if (user.patientPhone) {
      const supabase = createBrowserClient()
      supabase
        .from("appointments")
        .select("tenant_id")
        .eq("patient_phone", user.patientPhone)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.tenant_id) {
            setTenantId(data.tenant_id)
          } else {
            // 3. New patient with no prior appointment — load active hospitals
            supabase
              .from("tenants")
              .select("tenant_id, hospital_name")
              .eq("status", "active")
              .order("hospital_name")
              .then(({ data: tenants }) => {
                if (tenants && tenants.length === 1) {
                  // Only one hospital — auto-select
                  setTenantId(tenants[0].tenant_id)
                } else if (tenants && tenants.length > 1) {
                  // Multiple hospitals — let patient choose
                  setHospitals(tenants)
                }
              })
          }
        })
    }
  }, [user])

  // Load specialties on mount
  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    fetch("/api/patient-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list-specialties", tenant_id: tenantId }),
    })
      .then((r) => r.json())
      .then((data) => {
        const specs = Array.isArray(data) ? data : data.specialties || []
        setSpecialties(specs.map((s: string | { specialty: string }) => typeof s === "string" ? s : s.specialty))
      })
      .catch(() => toast.error("Failed to load specialties"))
      .finally(() => setLoading(false))
  }, [tenantId])

  // Load doctors when specialty selected
  useEffect(() => {
    if (!selectedSpecialty || !tenantId) return
    const supabase = createBrowserClient()
    supabase
      .from("doctors")
      .select("doctor_id, name, specialty")
      .eq("tenant_id", tenantId)
      .eq("specialty", selectedSpecialty)
      .eq("is_active", true)
      .then(({ data }) => {
        setDoctors((data || []).map((d) => ({
          doctor_id: d.doctor_id,
          doctor_name: d.name,
          specialty: d.specialty,
        })))
      })
  }, [selectedSpecialty, tenantId])

  // Load availability when doctor selected
  const loadAvailability = async (doctor: DoctorOption) => {
    setLoading(true)
    try {
      const res = await fetch("/api/patient-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check-availability",
          tenant_id: tenantId,
          doctor_id: doctor.doctor_id,
          specialty: doctor.specialty,
        }),
      })
      const data = await res.json()
      // The availability endpoint returns an array of { date, day, slots }
      const days: DaySlots[] = Array.isArray(data) ? data : data.availability || []
      setAvailability(days.filter((d) => d.slots && d.slots.length > 0))
    } catch {
      toast.error("Failed to load availability")
    } finally {
      setLoading(false)
    }
  }

  const handleBooking = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) return
    setBooking(true)
    try {
      const res = await fetch("/api/patient-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book-appointment",
          tenant_id: tenantId,
          doctor_id: selectedDoctor.doctor_id,
          doctor_name: selectedDoctor.doctor_name,
          specialty: selectedDoctor.specialty,
          date: selectedDate,
          time: selectedTime,
        }),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        setBookingResult(data)
        setStep("done")
        toast.success("Appointment booked!")
      } else {
        toast.error("Booking failed", { description: data.error || data.message || "Please try again" })
      }
    } catch {
      toast.error("Booking failed", { description: "Network error" })
    } finally {
      setBooking(false)
    }
  }

  const goBack = () => {
    if (step === "doctor") { setStep("specialty"); setSelectedSpecialty(""); setDoctors([]) }
    else if (step === "slot") { setStep("doctor"); setSelectedDoctor(null); setAvailability([]) }
    else if (step === "confirm") { setStep("slot"); setSelectedDate(""); setSelectedTime("") }
  }

  // Hospital selection for new patients with multiple hospitals available
  if (!tenantId && hospitals.length > 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-lg font-bold">Book Appointment</h1>
          <p className="text-sm text-muted-foreground">Select your hospital</p>
        </div>
        <div className="space-y-2">
          {hospitals.map((h) => (
            <Card
              key={h.tenant_id}
              className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
              onClick={() => setTenantId(h.tenant_id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-sm font-medium">{h.hospital_name}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!tenantId && !loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No hospitals available</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Please contact the hospital reception for assistance</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step !== "specialty" && step !== "done" && (
          <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={goBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="text-lg font-bold">Book Appointment</h1>
          <p className="text-sm text-muted-foreground">
            {step === "specialty" && "Select a specialty"}
            {step === "doctor" && "Choose your doctor"}
            {step === "slot" && "Pick a date and time"}
            {step === "confirm" && "Review and confirm"}
            {step === "done" && "Booking confirmed!"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      {step !== "done" && (
        <div className="flex gap-1.5">
          {(["specialty", "doctor", "slot", "confirm"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= ["specialty", "doctor", "slot", "confirm"].indexOf(step)
                  ? "bg-primary"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Specialty */}
        {step === "specialty" && (
          <motion.div key="specialty" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
            ) : specialties.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No specialties available</p>
            ) : (
              specialties.map((spec) => (
                <Card
                  key={spec}
                  className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
                  onClick={() => { setSelectedSpecialty(spec); setStep("doctor") }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium">{spec}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))
            )}
          </motion.div>
        )}

        {/* Step 2: Doctor */}
        {step === "doctor" && (
          <motion.div key="doctor" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-2">
            <Badge variant="secondary" className="text-xs mb-2">{selectedSpecialty}</Badge>
            {doctors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No doctors available for this specialty</p>
            ) : (
              doctors.map((doc) => (
                <Card
                  key={doc.doctor_id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
                  onClick={() => { setSelectedDoctor(doc); setStep("slot"); loadAvailability(doc) }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{doc.doctor_name}</p>
                        <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))
            )}
          </motion.div>
        )}

        {/* Step 3: Slot */}
        {step === "slot" && (
          <motion.div key="slot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-xs">{selectedSpecialty}</Badge>
              <Badge variant="secondary" className="text-xs">{selectedDoctor?.doctor_name}</Badge>
            </div>

            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            ) : availability.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No available slots in the next 7 days</p>
                </CardContent>
              </Card>
            ) : (
              availability.map((day) => (
                <Card key={day.date} className={cn("border-0 shadow-sm", selectedDate === day.date && "ring-2 ring-primary")}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{day.day}, {day.date}</p>
                      <Badge variant="secondary" className="text-[10px] ml-auto">{day.slots.length} slots</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {day.slots.map((slot) => (
                        <button
                          key={`${day.date}-${slot}`}
                          onClick={() => { setSelectedDate(day.date); setSelectedTime(slot) }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
                            selectedDate === day.date && selectedTime === slot
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-accent/40 border-border text-foreground"
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {selectedDate && selectedTime && (
              <Button
                className="w-full rounded-xl"
                onClick={() => setStep("confirm")}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </motion.div>
        )}

        {/* Step 4: Confirm */}
        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold">Appointment Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Patient</p>
                      <p className="text-sm font-medium">{user?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Doctor</p>
                      <p className="text-sm font-medium">{selectedDoctor?.doctor_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedSpecialty}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{selectedDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="text-sm font-medium">{selectedTime}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full rounded-xl"
              size="lg"
              onClick={handleBooking}
              disabled={booking}
            >
              {booking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          </motion.div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
              <CardContent className="p-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                <h2 className="text-lg font-bold">Booking Confirmed!</h2>
                <p className="text-sm text-muted-foreground">
                  Your appointment with {selectedDoctor?.doctor_name} on {selectedDate} at {selectedTime} has been booked.
                </p>
                {bookingResult?.booking_id && (
                  <p className="text-xs font-mono text-muted-foreground">
                    Booking ID: {bookingResult.booking_id}
                  </p>
                )}
                {bookingResult?.payment_link && (
                  <Button asChild className="rounded-xl" variant="outline">
                    <a href={bookingResult.payment_link} target="_blank" rel="noopener noreferrer">
                      Pay Now
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" asChild>
                <Link href="/patient/appointments">View Appointments</Link>
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={() => {
                  setStep("specialty")
                  setSelectedSpecialty("")
                  setSelectedDoctor(null)
                  setSelectedDate("")
                  setSelectedTime("")
                  setAvailability([])
                  setBookingResult(null)
                }}
              >
                Book Another
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
