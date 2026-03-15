"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  if (authLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (authError) return <ErrorState message={authError} />;
  if (!auth) return null;

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <div>
      {/* Progress Bar */}
      {step !== "success" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STEPS.filter(s => s !== "success").map((s, i) => {
              const stepIdx = i;
              const isActive = currentStepIndex === stepIdx;
              const isComplete = currentStepIndex > stepIdx;
              return (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      isComplete
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/30"
                        : isActive
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/40 scale-110"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        stepIdx + 1
                      )}
                    </div>
                    <span className={`text-[10px] mt-1 font-medium ${
                      isActive ? "text-blue-600 dark:text-blue-400" : isComplete ? "text-slate-600 dark:text-slate-300" : "text-slate-400"
                    }`}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                  {i < STEPS.length - 2 && (
                    <div className={`flex-1 h-0.5 mx-1 mt-[-14px] rounded-full transition-all duration-300 ${
                      currentStepIndex > stepIdx
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        {step !== "register" && step !== "specialty" && step !== "success" && (
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/30 flex items-center justify-center shrink-0 active:scale-95 transition-transform shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold">
            {isDependent ? "Book for Family Member" : "Book Appointment"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "success" ? "Booking confirmed" : stepLabel(step)}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Registration Step */}
      {step === "register" && (
        <div
          className="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm overflow-hidden"
          style={{ animation: 'fadeSlideIn 0.4s ease-out both' }}
        >
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                <User className="w-4.5 h-4.5 text-white" />
              </div>
              <h2 className="text-lg font-bold">
                {!isRegistered ? "Your Details" : "Patient Details"}
              </h2>
            </div>
            <div className="space-y-4">
              {!isRegistered && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Enter your name"
                        className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Age</Label>
                      <Input
                        type="number"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="Age"
                        className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Gender</Label>
                      <Select value={patientGender} onValueChange={setPatientGender}>
                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="Optional"
                        className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {isDependent && (
                <>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-indigo-500" />
                      <p className="text-sm font-semibold">Who is the appointment for?</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Patient Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={depName}
                        onChange={(e) => setDepName(e.target.value)}
                        placeholder="Patient's full name"
                        className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Age</Label>
                      <Input
                        type="number"
                        value={depAge}
                        onChange={(e) => setDepAge(e.target.value)}
                        placeholder="Age"
                        className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Gender</Label>
                      <Select value={depGender} onValueChange={setDepGender}>
                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Relationship *</Label>
                    <div className="relative">
                      <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Select value={relationship} onValueChange={setRelationship}>
                        <SelectTrigger className="h-12 rounded-xl pl-10 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PARENT">Parent</SelectItem>
                          <SelectItem value="SPOUSE">Spouse</SelectItem>
                          <SelectItem value="CHILD">Child</SelectItem>
                          <SelectItem value="FRIEND">Friend</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Specialty Selection */}
      {step === "specialty" && (
        <div style={{ animation: 'fadeSlideIn 0.4s ease-out both' }}>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {specialties.map((spec, index) => {
                const gradient = getSpecialtyGradient(spec.specialty);
                return (
                  <button
                    key={spec.specialty}
                    onClick={() => handleSpecialtySelect(spec)}
                    className="text-left p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
                    style={{ animationDelay: `${index * 60}ms`, animation: 'fadeSlideIn 0.4s ease-out both' }}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-sm`}>
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-semibold text-sm leading-tight">{spec.specialty}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {spec.doctor_count} doctor{spec.doctor_count > 1 ? "s" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Doctor Selection */}
      {step === "doctor" && selectedSpecialty && (
        <div style={{ animation: 'fadeSlideIn 0.4s ease-out both' }}>
          <p className="text-sm text-muted-foreground mb-3">
            Doctors in <span className="font-semibold text-foreground">{selectedSpecialty.specialty}</span>
          </p>
          <div className="space-y-3">
            {selectedSpecialty.doctors.map((doc, index) => {
              const initials = doc.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
              const gradient = getSpecialtyGradient(selectedSpecialty.specialty);
              return (
                <button
                  key={doc.doctor_id}
                  onClick={() => handleDoctorSelect(doc)}
                  className="w-full text-left p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
                  style={{ animationDelay: `${index * 80}ms`, animation: 'fadeSlideIn 0.4s ease-out both' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                      <span className="text-white font-bold text-sm">{initials}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Dr. {doc.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedSpecialty.specialty}</p>
                    </div>
                    <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date Selection */}
      {step === "date" && (
        <div style={{ animation: 'fadeSlideIn 0.4s ease-out both' }}>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : availableDates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                <CalendarDays className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-muted-foreground font-medium">No available dates in the next 7 days</p>
              <Button
                variant="outline"
                onClick={() => setStep("specialty")}
                className="mt-4 rounded-xl h-11"
              >
                Try another department
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Available dates for <span className="font-semibold text-foreground">Dr. {selectedDoctor?.name}</span>
              </p>
              {/* Horizontal scrollable date carousel */}
              <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                {availableDates.map((d, index) => {
                  const dateObj = new Date(d.date_key);
                  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const month = dateObj.toLocaleDateString("en-US", { month: "short" });
                  const isSelected = selectedDate?.date_key === d.date_key;
                  return (
                    <button
                      key={d.date_key}
                      onClick={() => handleDateSelect(d)}
                      className={`flex-shrink-0 w-[76px] py-3 px-2 rounded-2xl text-center transition-all duration-200 active:scale-95 ${
                        isSelected
                          ? "bg-gradient-to-b from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30"
                          : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm hover:shadow-md"
                      }`}
                      style={{ animationDelay: `${index * 60}ms`, animation: 'fadeSlideIn 0.3s ease-out both' }}
                    >
                      <p className={`text-[11px] font-medium ${isSelected ? "text-blue-100" : "text-muted-foreground"}`}>{dayName}</p>
                      <p className="text-2xl font-bold my-0.5">{dayNum}</p>
                      <p className={`text-[11px] ${isSelected ? "text-blue-100" : "text-muted-foreground"}`}>{month}</p>
                      <Badge className={`text-[10px] mt-1.5 h-5 px-1.5 ${
                        isSelected
                          ? "bg-white/20 text-white border-white/30"
                          : "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                      }`}>
                        {d.available_count} slots
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Slot Selection */}
      {step === "slot" && selectedDate && (
        <div style={{ animation: 'fadeSlideIn 0.4s ease-out both' }}>
          <p className="text-sm text-muted-foreground mb-4">
            Slots for <span className="font-semibold text-foreground">{selectedDate.date}</span>
          </p>
          {(() => {
            const slots = slotsByDate[selectedDate.date];
            if (!slots) return <p className="text-muted-foreground">No slots available</p>;
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

      {/* Confirm */}
      {step === "confirm" && (
        <div
          className="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm overflow-hidden"
          style={{ animation: 'fadeSlideIn 0.4s ease-out both' }}
        >
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5 text-white" />
              </div>
              <h2 className="text-lg font-bold">Confirm Appointment</h2>
            </div>

            <div className="space-y-3 mb-6">
              <ConfirmRow icon={<User className="w-4 h-4" />} label="Patient" value={isDependent ? depName : patientName} />
              <ConfirmRow icon={<Stethoscope className="w-4 h-4" />} label="Doctor" value={`Dr. ${selectedDoctor?.name}`} />
              <ConfirmRow icon={<MapPin className="w-4 h-4" />} label="Department" value={selectedSpecialty?.specialty || ""} />
              <ConfirmRow icon={<CalendarDays className="w-4 h-4" />} label="Date" value={selectedDate?.date || ""} />
              <ConfirmRow icon={<Clock className="w-4 h-4" />} label="Time" value={selectedSlot?.time || ""} />
            </div>

            <div className="space-y-2.5">
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm & Book
              </Button>
              <Button
                variant="outline"
                onClick={goBack}
                className="w-full h-11 rounded-xl"
              >
                Change Time
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {step === "success" && bookingResult && (
        <SuccessCard bookingResult={bookingResult} auth={auth} />
      )}

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
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
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 flex items-center justify-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
      </div>
      <h2 className="text-lg font-bold mb-2">Link Expired</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70 mt-4">
        Please go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
    </div>
  );
}

function ConfirmRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="font-medium text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SlotGroup({ label, icon, slots, selected, onSelect }: { label: string; icon: React.ReactNode; slots: Slot[]; selected: Slot | null; onSelect: (s: Slot) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[11px] text-muted-foreground ml-1">({slots.length})</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot, index) => {
          const isSelected = selected?.time === slot.time;
          return (
            <button
              key={slot.time}
              onClick={() => onSelect(slot)}
              className={`py-3 px-3 text-sm font-medium rounded-xl text-center transition-all duration-200 active:scale-95 ${
                isSelected
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30"
                  : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-white/20 dark:border-slate-700/30 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              }`}
              style={{ animationDelay: `${index * 40}ms`, animation: 'fadeSlideIn 0.3s ease-out both' }}
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

  // Poll for payment status after user clicks Pay Now
  useEffect(() => {
    if (paymentStatus !== "checking") return;

    const check = async () => {
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
    };

    // Check immediately, then every 5 seconds
    check();
    intervalRef.current = setInterval(check, 5000);

    // Stop after 10 minutes
    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }, 10 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [paymentStatus, auth.token, bookingResult.booking_id]);

  const handlePayClick = () => {
    setPaymentStatus("checking");
  };

  const isPaid = paymentStatus === "paid";

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-sm ${
        isPaid
          ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-emerald-200 dark:border-emerald-800"
          : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-amber-200 dark:border-amber-800"
      }`}
      style={{ animation: 'fadeSlideIn 0.5s ease-out both' }}
    >
      <div className="p-6 text-center space-y-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg ${
          isPaid
            ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30"
            : paymentStatus === "checking"
            ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30"
            : "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30"
        }`}>
          {isPaid ? (
            <CheckCircle2 className="w-10 h-10 text-white" />
          ) : paymentStatus === "checking" ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : (
            <Clock className="w-10 h-10 text-white" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold">
            {isPaid
              ? "Booking Confirmed!"
              : paymentStatus === "checking"
              ? "Waiting for Payment..."
              : "Appointment Reserved"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isPaid
              ? "Your appointment has been booked and paid"
              : paymentStatus === "checking"
              ? "Pay using the link below, then come back here. This page updates automatically."
              : "Complete payment to confirm your appointment"}
          </p>
        </div>
        <div className="text-left space-y-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
          <InfoRow label="Booking ID" value={bookingResult.booking_id} />
          <InfoRow label="Patient" value={bookingResult.patient_name} />
          <InfoRow label="Doctor" value={bookingResult.doctor_name} />
          <InfoRow label="Date" value={bookingResult.date} />
          <InfoRow label="Time" value={bookingResult.time} />
          {bookingResult.consultation_fee && (
            <InfoRow label="Fee" value={`\u20B9${bookingResult.consultation_fee}`} />
          )}
        </div>
        {bookingResult.payment_link && paymentStatus === "pending" && (
          <a
            href={bookingResult.payment_link}
            onClick={handlePayClick}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl py-3.5 font-semibold text-center shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
          >
            Pay Now — {"\u20B9"}{bookingResult.consultation_fee || "200"}
          </a>
        )}
        {bookingResult.payment_link && paymentStatus === "checking" && (
          <a
            href={bookingResult.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl py-3.5 font-semibold text-center shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
          >
            Open Payment Page
          </a>
        )}
        {paymentStatus === "checking" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking payment status...
          </div>
        )}
        {isPaid && (
          <p className="text-xs text-muted-foreground">
            You can close this page. A confirmation with your OP Pass has been sent to your WhatsApp.
          </p>
        )}
        {paymentStatus === "checking" && (
          <div className="text-xs text-muted-foreground space-y-1 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
            <p className="font-semibold text-blue-700 dark:text-blue-300">After paying, come back to this page.</p>
            <p>If the payment page shows an error after UPI payment, you can ignore it — your payment is processed. Check WhatsApp for your OP Pass.</p>
          </div>
        )}
        {paymentStatus === "pending" && (
          <p className="text-xs text-muted-foreground">
            Payment link expires in 20 minutes. After payment, your confirmation will be sent to WhatsApp.
          </p>
        )}
      </div>
    </div>
  );
}
