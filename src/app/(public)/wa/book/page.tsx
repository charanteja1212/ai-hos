"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Stethoscope,
  User,
  AlertCircle,
  Sun,
  Sunset,
  Moon,
  Mail,
  Users,
  MapPin,
  Heart,
} from "lucide-react";

type Step = "register" | "specialty" | "doctor" | "date" | "slot" | "confirm" | "success";

interface Doctor {
  doctor_id: string;
  name: string;
}

interface Specialty {
  specialty: string;
  doctors: Doctor[];
  doctor_count: number;
}

interface AvailableDate {
  date: string;
  date_key: string;
  available_count: number;
}

interface Slot {
  time: string;
  capacity: number;
}

interface SlotsByPeriod {
  morning: Slot[];
  afternoon: Slot[];
  evening: Slot[];
  total: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(token: string, action: string, params: Record<string, any> = {}) {
  const res = await fetch("/api/wa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action, ...params }),
  });
  return res.json();
}

const STEPS: Step[] = ["register", "specialty", "doctor", "date", "slot", "confirm", "success"];
const STEP_LABELS: Record<Step, string> = {
  register: "Details",
  specialty: "Department",
  doctor: "Doctor",
  date: "Date",
  slot: "Time",
  confirm: "Confirm",
  success: "Done",
};

const SPECIALTY_ICONS: Record<string, string> = {
  "General Medicine": "from-blue-400 to-blue-600",
  "Cardiology": "from-red-400 to-red-600",
  "Dermatology": "from-pink-400 to-pink-600",
  "ENT": "from-teal-400 to-teal-600",
  "Gastroenterology": "from-amber-400 to-amber-600",
  "Gynecology": "from-rose-400 to-rose-600",
  "Neurology": "from-purple-400 to-purple-600",
  "Ophthalmology": "from-cyan-400 to-cyan-600",
  "Orthopedics": "from-orange-400 to-orange-600",
  "Pediatrics": "from-green-400 to-green-600",
  "Psychiatry": "from-indigo-400 to-indigo-600",
  "Pulmonology": "from-sky-400 to-sky-600",
  "Urology": "from-yellow-400 to-yellow-600",
};

function getSpecialtyGradient(name: string): string {
  return SPECIALTY_ICONS[name] || "from-blue-400 to-indigo-600";
}

const RELATIONSHIP_OPTIONS = [
  { value: "PARENT", label: "Parent" },
  { value: "SPOUSE", label: "Spouse" },
  { value: "CHILD", label: "Child" },
  { value: "FRIEND", label: "Friend" },
  { value: "OTHER", label: "Other" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function BookPage() {
  const { auth, loading: authLoading, error: authError } = useWaAuth();
  const [step, setStep] = useState<Step>("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patient data
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  // Dependent data (book for someone else)
  const [depName, setDepName] = useState("");
  const [depAge, setDepAge] = useState("");
  const [depGender, setDepGender] = useState("");
  const [relationship, setRelationship] = useState("");

  // Booking data
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, SlotsByPeriod>>({});
  const [selectedDate, setSelectedDate] = useState<AvailableDate | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookingResult, setBookingResult] = useState<any>(null);

  const mode = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("mode") || "self"
    : "self";
  const isDependent = mode === "dependent";

  // Step 1: Check if patient is registered
  const checkPatient = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const result = await api(auth.token, "lookup_patient");
      if (result.found) {
        setPatientName(result.name);
        setIsRegistered(true);
        if (isDependent) {
          setStep("register"); // show dependent form
        } else {
          setStep("specialty");
        }
      } else {
        setStep("register");
      }
    } catch {
      setError("Failed to check registration");
    } finally {
      setLoading(false);
    }
  }, [auth, isDependent]);

  useEffect(() => {
    if (auth) checkPatient();
  }, [auth, checkPatient]);

  // Register patient
  const handleRegister = async () => {
    if (!auth) return;
    if (!isRegistered) {
      if (!patientName.trim()) { setError("Name is required"); return; }
      setLoading(true);
      setError(null);
      const result = await api(auth.token, "save_patient", {
        name: patientName,
        age: patientAge || undefined,
        email: patientEmail || undefined,
        gender: patientGender || undefined,
      });
      if (!result.success) { setError(result.message); setLoading(false); return; }
      setIsRegistered(true);
    }
    if (isDependent) {
      if (!depName.trim()) { setError("Patient name is required"); setLoading(false); return; }
      if (!relationship) { setError("Relationship is required"); setLoading(false); return; }
    }
    setLoading(false);
    setStep("specialty");
  };

  // Load specialties
  useEffect(() => {
    if (step === "specialty" && auth && specialties.length === 0) {
      setLoading(true);
      api(auth.token, "list_specialties").then((r) => {
        setSpecialties(r.specialties || []);
        setLoading(false);
      });
    }
  }, [step, auth, specialties.length]);

  // Select specialty -> pick doctor
  const handleSpecialtySelect = (spec: Specialty) => {
    setSelectedSpecialty(spec);
    if (spec.doctors.length === 1) {
      setSelectedDoctor(spec.doctors[0]);
      setStep("date");
      loadAvailability(spec.doctors[0].doctor_id);
    } else {
      setStep("doctor");
    }
  };

  // Select doctor -> load availability
  const handleDoctorSelect = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setStep("date");
    loadAvailability(doc.doctor_id);
  };

  const loadAvailability = async (doctorId: string) => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    const result = await api(auth.token, "check_availability", { doctor_id: doctorId });
    if (result.success) {
      setAvailableDates(result.available_dates || []);
      setSlotsByDate(result.slots_by_date || {});
    } else {
      setError(result.error || "No availability found");
    }
    setLoading(false);
  };

  // Select date -> show slots
  const handleDateSelect = (date: AvailableDate) => {
    setSelectedDate(date);
    setStep("slot");
  };

  // Select slot -> confirm
  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    setStep("confirm");
  };

  // Confirm booking
  const handleConfirm = async () => {
    if (!auth || !selectedDoctor || !selectedDate || !selectedSlot) return;
    setLoading(true);
    setError(null);

    const bookingName = isDependent ? depName : patientName;
    const bookingPhone = auth.phone;

    const result = await api(auth.token, "book_appointment", {
      patient_phone: bookingPhone,
      patient_name: bookingName,
      age: isDependent ? depAge : patientAge,
      doctor_id: selectedDoctor.doctor_id,
      doctor_name: selectedDoctor.name,
      specialty: selectedSpecialty?.specialty,
      start_time: selectedDate.date_key + " " + convertTo24h(selectedSlot.time),
      patient_type: isDependent ? "DEPENDENT" : "SELF",
      relationship: isDependent ? relationship : "SELF",
    });

    if (result.success) {
      setBookingResult(result);
      setStep("success");
    } else {
      setError(result.error || "Booking failed");
    }
    setLoading(false);
  };

  // Go back
  const goBack = () => {
    setError(null);
    switch (step) {
      case "doctor": setStep("specialty"); break;
      case "date": setStep(selectedSpecialty && selectedSpecialty.doctors.length > 1 ? "doctor" : "specialty"); break;
      case "slot": setStep("date"); break;
      case "confirm": setStep("slot"); break;
      default: break;
    }
  };

  // Auth states
  if (authLoading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading...</p>
      </div>
    </div>
  );
  if (authError) return <ErrorState message={authError} />;
  if (!auth) return null;

  const currentStepIndex = STEPS.indexOf(step);
  const displaySteps = STEPS.filter(s => s !== "success");

  return (
    <div className="min-h-screen pb-8">
      {/* Step Progress Bar */}
      {step !== "success" && (
        <div className="mb-8 px-2">
          <div className="flex items-start justify-between relative">
            {displaySteps.map((s, i) => {
              const isActive = currentStepIndex === i;
              const isComplete = currentStepIndex > i;
              return (
                <div key={s} className="flex flex-col items-center relative z-10" style={{ flex: i < displaySteps.length - 1 ? 1 : "none" }}>
                  <div className="relative">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                        isComplete
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                          : isActive
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40 ring-4 ring-blue-500/20"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-4.5 h-4.5" />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 animate-ping opacity-20" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-2 font-semibold tracking-wide uppercase transition-colors duration-300 ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : isComplete
                        ? "text-slate-600 dark:text-slate-300"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
              );
            })}
            {/* Connector lines */}
            <div className="absolute top-[18px] left-0 right-0 flex items-center z-0 px-[18px]">
              {displaySteps.slice(0, -1).map((_, i) => (
                <div key={i} className="flex-1 h-[2px] mx-0">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentStepIndex > i
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header with Back Button */}
      <div className="flex items-center gap-3 mb-6">
        {step !== "register" && step !== "specialty" && step !== "success" && (
          <button
            onClick={goBack}
            className="w-11 h-11 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/40 flex items-center justify-center shrink-0 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isDependent ? "Book for Family Member" : "Book Appointment"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {step === "success" ? "Booking confirmed" : stepLabel(step)}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-5 p-4 bg-red-50/80 dark:bg-red-950/30 backdrop-blur-sm border border-red-200/60 dark:border-red-800/50 rounded-2xl text-sm text-red-600 dark:text-red-400 flex items-start gap-3" style={{ animation: "fadeSlideIn 0.3s ease-out both" }}>
          <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="pt-1">{error}</div>
        </div>
      )}

      {/* ============ STEP 1: REGISTER ============ */}
      {step === "register" && (
        <div
          className="rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/40 shadow-lg shadow-slate-200/50 dark:shadow-black/20 overflow-hidden"
          style={{ animation: "fadeSlideIn 0.4s ease-out both" }}
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {!isRegistered ? "Your Details" : "Patient Details"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fill in the information below</p>
              </div>
            </div>

            <div className="space-y-5">
              {!isRegistered && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Enter your name"
                        className="pl-11 h-12 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Age</Label>
                      <Input
                        type="number"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="Age"
                        className="h-12 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gender</Label>
                      <div className="flex gap-2">
                        {GENDER_OPTIONS.map((g) => (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setPatientGender(g.value)}
                            className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all duration-200 ${
                              patientGender === g.value
                                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                                : "bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600"
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="Optional"
                        className="pl-11 h-12 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {isDependent && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white dark:bg-slate-900 px-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Patient Information</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Relationship *</Label>
                    <div className="flex flex-wrap gap-2">
                      {RELATIONSHIP_OPTIONS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRelationship(r.value)}
                          className={`px-5 h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
                            relationship === r.value
                              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                              : "bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Patient Name *</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={depName}
                        onChange={(e) => setDepName(e.target.value)}
                        placeholder="Patient's full name"
                        className="pl-11 h-12 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Age</Label>
                      <Input
                        type="number"
                        value={depAge}
                        onChange={(e) => setDepAge(e.target.value)}
                        placeholder="Age"
                        className="h-12 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gender</Label>
                      <div className="flex gap-2">
                        {GENDER_OPTIONS.map((g) => (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setDepGender(g.value)}
                            className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all duration-200 ${
                              depGender === g.value
                                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                                : "bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600"
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2">
                <Button
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-base shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all duration-200 border-0"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 2: SPECIALTY ============ */}
      {step === "specialty" && (
        <div style={{ animation: "fadeSlideIn 0.4s ease-out both" }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-slate-500">Loading departments...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {specialties.map((spec, index) => {
                const gradient = getSpecialtyGradient(spec.specialty);
                return (
                  <button
                    key={spec.specialty}
                    onClick={() => handleSpecialtySelect(spec)}
                    className="group text-left p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/40 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.97] transition-all duration-300"
                    style={{ animationDelay: `${index * 50}ms`, animation: "fadeSlideIn 0.4s ease-out both" }}
                  >
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-md group-hover:shadow-lg transition-shadow duration-300`}>
                      <Stethoscope className="w-5.5 h-5.5 text-white" />
                    </div>
                    <p className="font-semibold text-sm leading-tight text-slate-900 dark:text-white">{spec.specialty}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      {spec.doctor_count} doctor{spec.doctor_count > 1 ? "s" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ STEP 3: DOCTOR ============ */}
      {step === "doctor" && selectedSpecialty && (
        <div style={{ animation: "fadeSlideIn 0.4s ease-out both" }}>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Doctors in <span className="font-semibold text-slate-900 dark:text-white">{selectedSpecialty.specialty}</span>
          </p>
          <div className="space-y-3">
            {selectedSpecialty.doctors.map((doc, index) => {
              const initials = doc.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
              const gradient = getSpecialtyGradient(selectedSpecialty.specialty);
              return (
                <button
                  key={doc.doctor_id}
                  onClick={() => handleDoctorSelect(doc)}
                  className="w-full text-left p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/40 shadow-sm hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 group"
                  style={{ animationDelay: `${index * 80}ms`, animation: "fadeSlideIn 0.4s ease-out both" }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300`}>
                      <span className="text-white font-bold text-base">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-[15px]">Dr. {doc.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedSpecialty.specialty}</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                      <ArrowLeft className="w-4 h-4 rotate-180 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ STEP 4: DATE ============ */}
      {step === "date" && (
        <div style={{ animation: "fadeSlideIn 0.4s ease-out both" }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-slate-500">Checking availability...</p>
            </div>
          ) : availableDates.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-inner">
                <CalendarDays className="w-10 h-10 text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-semibold mb-1">No Available Dates</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">No slots in the next 7 days</p>
              <Button
                variant="outline"
                onClick={() => setStep("specialty")}
                className="mt-5 rounded-xl h-12 px-6 font-medium"
              >
                Try another department
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Available dates for <span className="font-semibold text-slate-900 dark:text-white">Dr. {selectedDoctor?.name}</span>
              </p>
              <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
                {availableDates.map((d, index) => {
                  const dateObj = new Date(d.date_key);
                  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const month = dateObj.toLocaleDateString("en-US", { month: "short" });
                  const isSelected = selectedDate?.date_key === d.date_key;
                  const isToday = d.date_key === new Date().toISOString().split("T")[0];
                  return (
                    <button
                      key={d.date_key}
                      onClick={() => handleDateSelect(d)}
                      className={`flex-shrink-0 snap-center w-20 py-4 px-2 rounded-2xl text-center transition-all duration-300 active:scale-95 ${
                        isSelected
                          ? "bg-gradient-to-b from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/30 scale-105"
                          : isToday
                          ? "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-2 border-blue-300 dark:border-blue-600 shadow-sm"
                          : "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/40 shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                      }`}
                      style={{ animationDelay: `${index * 60}ms`, animation: "fadeSlideIn 0.3s ease-out both" }}
                    >
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${isSelected ? "text-blue-100" : isToday ? "text-blue-500" : "text-slate-400"}`}>
                        {isToday ? "Today" : dayName}
                      </p>
                      <p className={`text-2xl font-bold my-1 ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>{dayNum}</p>
                      <p className={`text-[11px] font-medium ${isSelected ? "text-blue-100" : "text-slate-500"}`}>{month}</p>
                      <Badge className={`text-[10px] mt-2 h-5 px-2 font-semibold ${
                        isSelected
                          ? "bg-white/20 text-white border-white/30 hover:bg-white/30"
                          : "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-100"
                      }`}>
                        {d.available_count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ STEP 5: SLOT ============ */}
      {step === "slot" && selectedDate && (
        <div style={{ animation: "fadeSlideIn 0.4s ease-out both" }}>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Available times for <span className="font-semibold text-slate-900 dark:text-white">{selectedDate.date}</span>
          </p>
          {(() => {
            const slots = slotsByDate[selectedDate.date];
            if (!slots) return (
              <div className="text-center py-12">
                <p className="text-slate-500 font-medium">No slots available</p>
              </div>
            );
            return (
              <div className="space-y-6">
                {slots.morning.length > 0 && (
                  <SlotGroup label="Morning" icon={<Sun className="w-4.5 h-4.5 text-amber-500" />} gradient="from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20" borderColor="border-amber-200/60 dark:border-amber-800/30" slots={slots.morning} selected={selectedSlot} onSelect={handleSlotSelect} />
                )}
                {slots.afternoon.length > 0 && (
                  <SlotGroup label="Afternoon" icon={<Sunset className="w-4.5 h-4.5 text-orange-500" />} gradient="from-orange-50 to-rose-50 dark:from-orange-950/20 dark:to-rose-950/20" borderColor="border-orange-200/60 dark:border-orange-800/30" slots={slots.afternoon} selected={selectedSlot} onSelect={handleSlotSelect} />
                )}
                {slots.evening.length > 0 && (
                  <SlotGroup label="Evening" icon={<Moon className="w-4.5 h-4.5 text-indigo-500" />} gradient="from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20" borderColor="border-indigo-200/60 dark:border-indigo-800/30" slots={slots.evening} selected={selectedSlot} onSelect={handleSlotSelect} />
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ============ STEP 6: CONFIRM ============ */}
      {step === "confirm" && (
        <div
          className="rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/40 shadow-lg shadow-slate-200/50 dark:shadow-black/20 overflow-hidden"
          style={{ animation: "fadeSlideIn 0.4s ease-out both" }}
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review Appointment</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Please confirm the details below</p>
              </div>
            </div>

            <div className="space-y-3 mb-7">
              <ConfirmRow icon={<User className="w-4 h-4" />} label="Patient" value={isDependent ? depName : patientName} />
              <ConfirmRow icon={<Stethoscope className="w-4 h-4" />} label="Doctor" value={`Dr. ${selectedDoctor?.name}`} />
              <ConfirmRow icon={<MapPin className="w-4 h-4" />} label="Department" value={selectedSpecialty?.specialty || ""} />
              <ConfirmRow icon={<CalendarDays className="w-4 h-4" />} label="Date" value={selectedDate?.date || ""} />
              <ConfirmRow icon={<Clock className="w-4 h-4" />} label="Time" value={selectedSlot?.time || ""} />
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-base shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all duration-200 border-0"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                Confirm & Book
              </Button>
              <Button
                variant="outline"
                onClick={goBack}
                className="w-full h-12 rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Change Time
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 7: SUCCESS ============ */}
      {step === "success" && bookingResult && (
        <SuccessCard bookingResult={bookingResult} auth={auth} />
      )}

      {/* Animation Keyframes + Scrollbar Hide */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
        }
        @keyframes checkBounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// ---- Helper Components ----

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-16" style={{ animation: "fadeSlideIn 0.5s ease-out both" }}>
      <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 flex items-center justify-center shadow-lg shadow-red-100/50 dark:shadow-none">
        <AlertCircle className="w-10 h-10 text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Link Expired</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-5">
        Please go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ConfirmRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/30">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 border border-blue-100/60 dark:border-blue-800/30">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm py-1.5">
      <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-white text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

function SlotGroup({ label, icon, gradient, borderColor, slots, selected, onSelect }: {
  label: string;
  icon: React.ReactNode;
  gradient: string;
  borderColor: string;
  slots: Slot[];
  selected: Slot | null;
  onSelect: (s: Slot) => void;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} border ${borderColor} p-4`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-800/80 flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-bold text-slate-900 dark:text-white">{label}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto">{slots.length} slot{slots.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot, index) => {
          const isSelected = selected?.time === slot.time;
          return (
            <button
              key={slot.time}
              onClick={() => onSelect(slot)}
              className={`py-3 px-2 text-sm font-semibold rounded-xl text-center transition-all duration-200 active:scale-95 ${
                isSelected
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                  : "bg-white/90 dark:bg-slate-800/90 border border-white/60 dark:border-slate-600/40 shadow-sm text-slate-700 dark:text-slate-200 hover:shadow-md hover:-translate-y-0.5"
              }`}
              style={{ animationDelay: `${index * 40}ms`, animation: "fadeSlideIn 0.3s ease-out both" }}
            >
              {slot.time}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function stepLabel(step: Step): string {
  switch (step) {
    case "register": return "Step 1 -- Your details";
    case "specialty": return "Step 2 -- Select department";
    case "doctor": return "Step 3 -- Select doctor";
    case "date": return "Step 4 -- Pick a date";
    case "slot": return "Step 5 -- Choose time";
    case "confirm": return "Step 6 -- Review & confirm";
    case "success": return "Done!";
  }
}

function convertTo24h(time12: string): string {
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return "10:00";
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ap = match[3].toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return String(h).padStart(2, "0") + ":" + m;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SuccessCard({ bookingResult, auth }: { bookingResult: any; auth: { token: string } }) {
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid" | "checking">(
    bookingResult.payment_required ? "pending" : "paid"
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkPayment = useCallback(async () => {
    try {
      const res = await fetch("/api/wa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: auth.token, action: "list_appointments" }),
      });
      const data = await res.json();
      if (Array.isArray(data.appointments)) {
        const appt = data.appointments.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any) => a.booking_id === bookingResult.booking_id
        );
        if (appt && appt.status === "confirmed" && appt.payment_status === "paid") {
          setPaymentStatus("paid");
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    } catch { /* ignore */ }
  }, [auth.token, bookingResult.booking_id]);

  // Poll for payment status after user clicks Pay Now
  useEffect(() => {
    if (paymentStatus !== "checking") return;

    // Check immediately, then every 5 seconds
    checkPayment();
    intervalRef.current = setInterval(checkPayment, 5000);

    // Stop after 10 minutes
    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }, 10 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [paymentStatus, checkPayment]);

  // When user returns to this tab (e.g. after closing Razorpay error page), check immediately
  useEffect(() => {
    if (paymentStatus !== "checking") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") checkPayment();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [paymentStatus, checkPayment]);

  const handlePayClick = () => {
    setPaymentStatus("checking");
  };

  const isPaid = paymentStatus === "paid";

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-lg ${
        isPaid
          ? "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-emerald-100/50 dark:shadow-emerald-900/20"
          : "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-2 border-amber-300 dark:border-amber-700 shadow-amber-100/50 dark:shadow-amber-900/20"
      }`}
      style={{ animation: "fadeSlideIn 0.5s ease-out both" }}
    >
      <div className="p-6 text-center space-y-5">
        {/* Status Icon */}
        <div className="relative inline-flex">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl ${
            isPaid
              ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30"
              : paymentStatus === "checking"
              ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30"
              : "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30"
          }`}>
            {isPaid ? (
              <CheckCircle2 className="w-10 h-10 text-white" style={{ animation: "checkBounce 0.5s ease-out both" }} />
            ) : paymentStatus === "checking" ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : (
              <Clock className="w-10 h-10 text-white" />
            )}
          </div>
          {isPaid && (
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 animate-ping opacity-20" />
          )}
        </div>

        {/* Status Text */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {isPaid
              ? "Booking Confirmed!"
              : paymentStatus === "checking"
              ? "Waiting for Payment..."
              : "Appointment Reserved"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
            {isPaid
              ? "Your appointment has been booked and paid"
              : paymentStatus === "checking"
              ? "Pay using the link below, then come back here. This page updates automatically."
              : "Complete payment to confirm your appointment"}
          </p>
        </div>

        {/* Booking Details */}
        <div className="text-left bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 space-y-2 border border-slate-100 dark:border-slate-700/30">
          <InfoRow label="Booking ID" value={bookingResult.booking_id} />
          <div className="border-t border-slate-200/60 dark:border-slate-700/30" />
          <InfoRow label="Patient" value={bookingResult.patient_name} />
          <InfoRow label="Doctor" value={bookingResult.doctor_name} />
          <InfoRow label="Date" value={bookingResult.date} />
          <InfoRow label="Time" value={bookingResult.time} />
          {bookingResult.consultation_fee && (
            <>
              <div className="border-t border-slate-200/60 dark:border-slate-700/30" />
              <InfoRow label="Fee" value={`\u20B9${bookingResult.consultation_fee}`} />
            </>
          )}
        </div>

        {/* Pay Now - Pending */}
        {bookingResult.payment_link && paymentStatus === "pending" && (
          <a
            href={bookingResult.payment_link}
            onClick={handlePayClick}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl py-4 font-semibold text-base text-center shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all duration-200"
          >
            Pay Now {"\u2014"} {"\u20B9"}{bookingResult.consultation_fee || "200"}
          </a>
        )}

        {/* Open Payment - Checking */}
        {bookingResult.payment_link && paymentStatus === "checking" && (
          <a
            href={bookingResult.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl py-4 font-semibold text-base text-center shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all duration-200"
          >
            Open Payment Page
          </a>
        )}

        {/* Checking Status Indicator */}
        {paymentStatus === "checking" && (
          <div className="flex items-center justify-center gap-2.5 text-sm text-slate-500 dark:text-slate-400 py-1">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>Checking payment status...</span>
          </div>
        )}

        {/* Success Message */}
        {isPaid && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            You can close this page. A confirmation with your OP Pass has been sent to your WhatsApp.
          </p>
        )}

        {/* Payment Instructions */}
        {paymentStatus === "checking" && (
          <div className="text-xs text-left space-y-1.5 bg-blue-50/80 dark:bg-blue-950/30 rounded-2xl p-4 border border-blue-200/60 dark:border-blue-800/40">
            <p className="font-bold text-blue-700 dark:text-blue-300">After paying, come back to this page.</p>
            <p className="text-blue-600/80 dark:text-blue-400/80 leading-relaxed">If the payment page shows an error after UPI payment, you can ignore it {"\u2014"} your payment is processed. Check WhatsApp for your OP Pass.</p>
          </div>
        )}

        {/* Pending Footer */}
        {paymentStatus === "pending" && (
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Payment link expires in 20 minutes. After payment, your confirmation will be sent to WhatsApp.
          </p>
        )}
      </div>
    </div>
  );
}
