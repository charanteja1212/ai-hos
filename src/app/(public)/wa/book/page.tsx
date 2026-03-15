"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Select specialty → pick doctor
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

  // Select doctor → load availability
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

  // Select date → show slots
  const handleDateSelect = (date: AvailableDate) => {
    setSelectedDate(date);
    setStep("slot");
  };

  // Select slot → confirm
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
  if (authLoading) return <PageShell><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></PageShell>;
  if (authError) return <PageShell><ErrorState message={authError} /></PageShell>;
  if (!auth) return null;

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {step !== "register" && step !== "specialty" && step !== "success" && (
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
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
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Registration Step */}
      {step === "register" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              {!isRegistered ? "Your Details" : "Patient Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isRegistered && (
              <>
                <div>
                  <Label>Full Name *</Label>
                  <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Enter your name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Age</Label>
                    <Input type="number" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="Age" />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={patientGender} onValueChange={setPatientGender}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} placeholder="Optional" />
                </div>
              </>
            )}

            {isDependent && (
              <>
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium mb-3">Who is the appointment for?</p>
                </div>
                <div>
                  <Label>Patient Name *</Label>
                  <Input value={depName} onChange={(e) => setDepName(e.target.value)} placeholder="Patient's full name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Age</Label>
                    <Input type="number" value={depAge} onChange={(e) => setDepAge(e.target.value)} placeholder="Age" />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={depGender} onValueChange={setDepGender}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Relationship *</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARENT">Parent</SelectItem>
                      <SelectItem value="SPOUSE">Spouse</SelectItem>
                      <SelectItem value="CHILD">Child</SelectItem>
                      <SelectItem value="FRIEND">Friend</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button onClick={handleRegister} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Specialty Selection */}
      {step === "specialty" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            specialties.map((spec) => (
              <button
                key={spec.specialty}
                onClick={() => handleSpecialtySelect(spec)}
                className="w-full text-left p-4 rounded-xl border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{spec.specialty}</p>
                      <p className="text-xs text-muted-foreground">
                        {spec.doctor_count} doctor{spec.doctor_count > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Doctor Selection */}
      {step === "doctor" && selectedSpecialty && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-2">
            Doctors in <span className="font-medium text-foreground">{selectedSpecialty.specialty}</span>
          </p>
          {selectedSpecialty.doctors.map((doc) => (
            <button
              key={doc.doctor_id}
              onClick={() => handleDoctorSelect(doc)}
              className="w-full text-left p-4 rounded-xl border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Dr. {doc.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedSpecialty.specialty}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Date Selection */}
      {step === "date" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : availableDates.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No available dates in the next 7 days</p>
              <Button variant="outline" onClick={() => setStep("specialty")} className="mt-4">
                Try another department
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Available dates for <span className="font-medium text-foreground">Dr. {selectedDoctor?.name}</span>
              </p>
              {availableDates.map((d) => (
                <button
                  key={d.date_key}
                  onClick={() => handleDateSelect(d)}
                  className="w-full text-left p-4 rounded-xl border bg-card hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-5 h-5 text-primary" />
                      <span className="font-medium">{d.date}</span>
                    </div>
                    <Badge variant="secondary">{d.available_count} slots</Badge>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Slot Selection */}
      {step === "slot" && selectedDate && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Slots for <span className="font-medium text-foreground">{selectedDate.date}</span>
          </p>
          {(() => {
            const slots = slotsByDate[selectedDate.date];
            if (!slots) return <p className="text-muted-foreground">No slots available</p>;
            return (
              <>
                {slots.morning.length > 0 && <SlotGroup label="Morning" slots={slots.morning} onSelect={handleSlotSelect} />}
                {slots.afternoon.length > 0 && <SlotGroup label="Afternoon" slots={slots.afternoon} onSelect={handleSlotSelect} />}
                {slots.evening.length > 0 && <SlotGroup label="Evening" slots={slots.evening} onSelect={handleSlotSelect} />}
              </>
            );
          })()}
        </div>
      )}

      {/* Confirm */}
      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirm Appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Patient" value={isDependent ? depName : patientName} />
            <InfoRow label="Doctor" value={`Dr. ${selectedDoctor?.name}`} />
            <InfoRow label="Department" value={selectedSpecialty?.specialty || ""} />
            <InfoRow label="Date" value={selectedDate?.date || ""} />
            <InfoRow label="Time" value={selectedSlot?.time || ""} />
            <div className="pt-4 space-y-2">
              <Button onClick={handleConfirm} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Confirm Booking
              </Button>
              <Button variant="outline" onClick={goBack} className="w-full">
                Change Time
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {step === "success" && bookingResult && (
        <SuccessCard bookingResult={bookingResult} auth={auth} />
      )}
    </PageShell>
  );
}

// ---- Helper Components ----

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-20">
      {children}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2">Link Expired</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-4">
        Please go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
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

function SlotGroup({ label, slots, onSelect }: { label: string; slots: Slot[]; onSelect: (s: Slot) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className="text-xs">{slots.length}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((slot) => (
          <button
            key={slot.time}
            onClick={() => onSelect(slot)}
            className="py-2.5 px-3 text-sm font-medium rounded-lg border bg-card hover:bg-primary hover:text-primary-foreground transition-colors text-center"
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}

function stepLabel(step: Step): string {
  switch (step) {
    case "register": return "Step 1 — Your details";
    case "specialty": return "Step 2 — Select department";
    case "doctor": return "Step 3 — Select doctor";
    case "date": return "Step 4 — Pick a date";
    case "slot": return "Step 5 — Choose time";
    case "confirm": return "Step 6 — Review & confirm";
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

  return (
    <Card className={paymentStatus === "paid" ? "border-green-200 dark:border-green-800" : "border-amber-200 dark:border-amber-800"}>
      <CardContent className="pt-6 text-center space-y-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
          paymentStatus === "paid"
            ? "bg-green-100 dark:bg-green-900/30"
            : "bg-amber-100 dark:bg-amber-900/30"
        }`}>
          {paymentStatus === "paid" ? (
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          ) : paymentStatus === "checking" ? (
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
          ) : (
            <Clock className="w-8 h-8 text-amber-600" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold">
            {paymentStatus === "paid"
              ? "Booking Confirmed!"
              : paymentStatus === "checking"
              ? "Waiting for Payment..."
              : "Appointment Reserved"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {paymentStatus === "paid"
              ? "Your appointment has been booked and paid"
              : paymentStatus === "checking"
              ? "Pay using the link below, then come back here. This page updates automatically."
              : "Complete payment to confirm your appointment"}
          </p>
        </div>
        <div className="text-left space-y-2 bg-muted/50 rounded-xl p-4">
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
            className="block w-full bg-primary text-primary-foreground rounded-xl py-3 font-medium text-center"
          >
            Pay Now — \u20B9{bookingResult.consultation_fee || "200"}
          </a>
        )}
        {bookingResult.payment_link && paymentStatus === "checking" && (
          <a
            href={bookingResult.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-primary text-primary-foreground rounded-xl py-3 font-medium text-center"
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
        {paymentStatus === "paid" && (
          <p className="text-xs text-muted-foreground">
            You can close this page. A confirmation with your OP Pass has been sent to your WhatsApp.
          </p>
        )}
        {paymentStatus === "checking" && (
          <div className="text-xs text-muted-foreground space-y-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <p className="font-medium text-blue-700 dark:text-blue-300">After paying, come back to this page.</p>
            <p>If the payment page shows an error after UPI payment, you can ignore it — your payment is processed. Check WhatsApp for your OP Pass.</p>
          </div>
        )}
        {paymentStatus === "pending" && (
          <p className="text-xs text-muted-foreground">
            Payment link expires in 20 minutes. After payment, your confirmation will be sent to WhatsApp.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
