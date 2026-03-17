"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
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
} from "lucide-react";

type Step = "register" | "specialty" | "doctor" | "date" | "slot" | "confirm" | "success";

interface Doctor {
  doctor_id: string;
  name: string;
  image_url?: string;
  designation?: string;
  consultation_fee?: number;
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground font-medium">Loading...</p>
      </div>
    </div>
  );
  if (authError) return <ErrorState message={authError} />;
  if (!auth) return null;

  const currentStepIndex = STEPS.indexOf(step);
  const displaySteps = STEPS.filter(s => s !== "success");

  return (
    <div className="min-h-screen pb-8 px-4">
      {/* Progress Bar */}
      {step !== "success" && (
        <div className="mb-6 pt-2">
          <div className="flex items-center justify-between relative">
            {/* Connector line */}
            <div className="absolute top-[14px] left-[14px] right-[14px] h-[2px] bg-slate-200 dark:bg-slate-700" />
            <div
              className="absolute top-[14px] left-[14px] h-[2px] bg-blue-600 transition-all duration-500"
              style={{ width: `calc(${(Math.min(currentStepIndex, displaySteps.length - 1) / (displaySteps.length - 1)) * 100}% - 28px)` }}
            />
            {displaySteps.map((s, i) => {
              const isActive = currentStepIndex === i;
              const isComplete = currentStepIndex > i;
              return (
                <div key={s} className="flex flex-col items-center relative z-10">
                  <div className="relative">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                        isComplete
                          ? "bg-blue-600 text-white"
                          : isActive
                          ? "bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    {isActive && (
                      <div className="absolute inset-0 rounded-full border-2 border-blue-600 animate-ping opacity-20" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-1.5 font-medium transition-colors duration-300 ${
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
          </div>
        </div>
      )}

      {/* Header with Back Button */}
      {step !== "success" && (
        <div className="flex items-center gap-3 mb-4">
          {step !== "register" && step !== "specialty" && (
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isDependent ? "Book for Family Member" : "Book Appointment"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {stepLabel(step)}
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ============ STEP 1: REGISTER ============ */}
      {step === "register" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {!isRegistered ? "Your Details" : "Patient Details"}
                </h2>
                <p className="text-xs text-muted-foreground">Fill in the information below</p>
              </div>
            </div>

            <div className="space-y-4">
              {!isRegistered && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name *</Label>
                    <Input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter your name"
                      className="h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Age</Label>
                      <Input
                        type="number"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="Age"
                        className="h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender</Label>
                      <div className="flex gap-1.5">
                        {GENDER_OPTIONS.map((g) => (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setPatientGender(g.value)}
                            className={`flex-1 h-12 rounded-full text-sm font-medium transition-colors ${
                              patientGender === g.value
                                ? "bg-blue-600 text-white"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="Optional"
                        className="pl-10 h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {isDependent && (
                <>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Patient Information</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Relationship *</Label>
                    <div className="flex flex-wrap gap-2">
                      {RELATIONSHIP_OPTIONS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRelationship(r.value)}
                          className={`px-4 h-10 rounded-full text-sm font-medium transition-colors ${
                            relationship === r.value
                              ? "bg-blue-600 text-white"
                              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Patient Name *</Label>
                    <Input
                      value={depName}
                      onChange={(e) => setDepName(e.target.value)}
                      placeholder="Patient's full name"
                      className="h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Age</Label>
                      <Input
                        type="number"
                        value={depAge}
                        onChange={(e) => setDepAge(e.target.value)}
                        placeholder="Age"
                        className="h-12 rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Gender</Label>
                      <div className="flex gap-1.5">
                        {GENDER_OPTIONS.map((g) => (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => setDepGender(g.value)}
                            className={`flex-1 h-12 rounded-full text-sm font-medium transition-colors ${
                              depGender === g.value
                                ? "bg-blue-600 text-white"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
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

              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold border-0"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 2: SPECIALTY ============ */}
      {step === "specialty" && (
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">Loading departments...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {specialties.map((spec) => {
                const doc = spec.doctors[0];
                const initials = doc ? doc.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "";
                return (
                  <button
                    key={spec.specialty}
                    onClick={() => handleSpecialtySelect(spec)}
                    className="w-full text-left p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {spec.doctor_count === 1 && doc ? (
                        doc.image_url ? (
                          <img src={doc.image_url} alt={doc.name} className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">{initials}</span>
                          </div>
                        )
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 dark:text-white">{spec.specialty}</p>
                        {spec.doctor_count === 1 && doc ? (
                          <>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{doc.name}</p>
                            {doc.designation && (
                              <p className="text-[11px] text-blue-600 dark:text-blue-400">{doc.designation}</p>
                            )}
                            {doc.consultation_fee ? (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{"\u20B9"}{doc.consultation_fee}</p>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {spec.doctor_count} doctors
                          </p>
                        )}
                      </div>
                      <ChevronLeft className="w-4 h-4 rotate-180 text-slate-400 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ STEP 3: DOCTOR ============ */}
      {step === "doctor" && selectedSpecialty && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Doctors in <span className="font-medium text-slate-900 dark:text-white">{selectedSpecialty.specialty}</span>
          </p>
          <div className="space-y-3">
            {selectedSpecialty.doctors.map((doc) => {
              const initials = doc.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <button
                  key={doc.doctor_id}
                  onClick={() => handleDoctorSelect(doc)}
                  className="w-full text-left p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    {doc.image_url ? (
                      <img src={doc.image_url} alt={doc.name} className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">{initials}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">Dr. {doc.name}</p>
                      {doc.designation && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{doc.designation}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedSpecialty.specialty}
                        {doc.consultation_fee ? ` · ₹${doc.consultation_fee}` : ""}
                      </p>
                    </div>
                    <ChevronLeft className="w-4 h-4 rotate-180 text-slate-400 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ STEP 4: DATE ============ */}
      {step === "date" && (
        <div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">Checking availability...</p>
            </div>
          ) : availableDates.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <CalendarDays className="w-8 h-8 text-slate-400" />
              </div>
              <p className="font-medium text-slate-900 dark:text-white mb-1">No Available Dates</p>
              <p className="text-sm text-muted-foreground">No slots in the next 7 days</p>
              <Button
                variant="outline"
                onClick={() => setStep("specialty")}
                className="mt-4 rounded-xl h-12 px-6 font-medium"
              >
                Try another department
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Available dates for <span className="font-medium text-slate-900 dark:text-white">Dr. {selectedDoctor?.name}</span>
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                {availableDates.map((d) => {
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
                      className={`flex-shrink-0 snap-center w-16 py-3 rounded-xl text-center transition-all active:scale-95 ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : isToday
                          ? "bg-white dark:bg-slate-900 border-2 border-blue-500 dark:border-blue-500"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <p className={`text-[10px] font-medium uppercase tracking-wide ${isSelected ? "text-blue-100" : isToday ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                        {isToday ? "Today" : dayName}
                      </p>
                      <p className={`text-xl font-semibold my-0.5 ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>{dayNum}</p>
                      <p className={`text-[10px] font-medium ${isSelected ? "text-blue-100" : "text-muted-foreground"}`}>{month}</p>
                      <div className={`text-[9px] font-semibold mt-1.5 mx-auto w-fit px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                      }`}>
                        {d.available_count}
                      </div>
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
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Available times for <span className="font-medium text-slate-900 dark:text-white">{selectedDate.date}</span>
          </p>
          {(() => {
            const slots = slotsByDate[selectedDate.date];
            if (!slots) return (
              <div className="text-center py-12">
                <p className="text-muted-foreground font-medium">No slots available</p>
              </div>
            );
            return (
              <div className="space-y-5">
                {slots.morning.length > 0 && (
                  <SlotGroup label="Morning" icon={<Sun className="w-4 h-4 text-amber-500" />} slots={slots.morning} selected={selectedSlot} onSelect={handleSlotSelect} />
                )}
                {slots.afternoon.length > 0 && (
                  <SlotGroup label="Afternoon" icon={<Sunset className="w-4 h-4 text-orange-500" />} slots={slots.afternoon} selected={selectedSlot} onSelect={handleSlotSelect} />
                )}
                {slots.evening.length > 0 && (
                  <SlotGroup label="Evening" icon={<Moon className="w-4 h-4 text-indigo-500" />} slots={slots.evening} selected={selectedSlot} onSelect={handleSlotSelect} />
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ============ STEP 6: CONFIRM ============ */}
      {step === "confirm" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Review Appointment</h2>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 mb-5">
              <ConfirmRow icon={<User className="w-4 h-4" />} label="Patient" value={isDependent ? depName : patientName} />
              <ConfirmRow icon={<Stethoscope className="w-4 h-4" />} label="Doctor" value={`Dr. ${selectedDoctor?.name}`} />
              <ConfirmRow icon={<MapPin className="w-4 h-4" />} label="Department" value={selectedSpecialty?.specialty || ""} />
              <ConfirmRow icon={<CalendarDays className="w-4 h-4" />} label="Date" value={selectedDate?.date || ""} />
              <ConfirmRow icon={<Clock className="w-4 h-4" />} label="Time" value={selectedSlot?.time || ""} />
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold border-0"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                Confirm & Book
              </Button>
              <Button
                variant="outline"
                onClick={goBack}
                className="w-full h-12 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-medium"
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

      {/* Scrollbar Hide */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// ---- Helper Components ----

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Link Expired</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
        Please go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
    </div>
  );
}

function ConfirmRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-slate-900 dark:text-white text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

function SlotGroup({ label, icon, slots, selected, onSelect }: {
  label: string;
  icon: React.ReactNode;
  slots: Slot[];
  selected: Slot | null;
  onSelect: (s: Slot) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
        <span className="text-xs text-muted-foreground ml-auto">{slots.length} slot{slots.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => {
          const isSelected = selected?.time === slot.time;
          return (
            <button
              key={slot.time}
              onClick={() => onSelect(slot)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors active:scale-95 ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-700"
              }`}
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
    <div className="px-4">
      {/* Status Icon */}
      <div className="flex justify-center mb-5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
          isPaid
            ? "bg-green-100 dark:bg-green-950/40"
            : paymentStatus === "checking"
            ? "bg-blue-100 dark:bg-blue-950/40"
            : "bg-slate-100 dark:bg-slate-800"
        }`}>
          {isPaid ? (
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          ) : paymentStatus === "checking" ? (
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          ) : (
            <Clock className="w-8 h-8 text-slate-400" />
          )}
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {isPaid
            ? "Booking Confirmed!"
            : paymentStatus === "checking"
            ? "Waiting for Payment..."
            : "Appointment Reserved"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          {isPaid
            ? "Your appointment has been booked and paid"
            : paymentStatus === "checking"
            ? "Pay using the link below, then come back here. This page updates automatically."
            : "Complete payment to confirm your appointment"}
        </p>
      </div>

      {/* Booking Details */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-2 mb-4">
        <InfoRow label="Booking ID" value={bookingResult.booking_id} />
        <div className="border-t border-slate-200 dark:border-slate-800" />
        <InfoRow label="Patient" value={bookingResult.patient_name} />
        <InfoRow label="Doctor" value={bookingResult.doctor_name} />
        <InfoRow label="Date" value={bookingResult.date} />
        <InfoRow label="Time" value={bookingResult.time} />
        {bookingResult.consultation_fee && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-800" />
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
          className="block w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-center leading-[3rem] transition-colors mb-4"
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
          className="block w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-center leading-[3rem] transition-colors mb-4"
        >
          Open Payment Page
        </a>
      )}

      {/* Checking Status Indicator */}
      {paymentStatus === "checking" && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1 mb-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Checking payment status...</span>
        </div>
      )}

      {/* Success Message */}
      {isPaid && (
        <p className="text-xs text-muted-foreground text-center">
          You can close this page. A confirmation with your OP Pass has been sent to your WhatsApp.
        </p>
      )}

      {/* Payment Instructions */}
      {paymentStatus === "checking" && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 p-3 text-xs space-y-1">
          <p className="font-semibold text-blue-700 dark:text-blue-300">After paying, you will be redirected back automatically.</p>
          <p className="text-blue-600/80 dark:text-blue-400/80">Your OP Pass will be sent to WhatsApp.</p>
        </div>
      )}

      {/* Pending Footer */}
      {paymentStatus === "pending" && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
          Payment link expires in 20 minutes. After payment, your confirmation will be sent to WhatsApp.
        </p>
      )}
    </div>
  );
}
