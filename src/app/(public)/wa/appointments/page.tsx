"use client";

import { useState, useEffect, useCallback } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  User,
  XCircle,
} from "lucide-react";

interface Appointment {
  booking_id: string;
  patient_name: string;
  doctor_name: string;
  specialty: string;
  date: string;
  time: string;
  status: string;
  payment_status?: string;
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

function getRelativeDate(dateStr: string): string | null {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = dateStr.split(/[-/]/);
    let target: Date;
    if (parts.length === 3) {
      // Try DD-MM-YYYY or YYYY-MM-DD
      if (parts[0].length === 4) {
        target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        target = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    } else {
      target = new Date(dateStr);
    }
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff > 1 && diff <= 7) return `In ${diff} days`;
    return null;
  } catch {
    return null;
  }
}

export default function AppointmentsPage() {
  const { auth, loading: authLoading, error: authError } = useWaAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const actionParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("action")
    : null;

  const loadAppointments = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api(auth.token, "list_appointments");
      if (result.appointments) {
        setAppointments(result.appointments);
      } else if (result.error) {
        setError(result.error);
      } else {
        setAppointments([]);
      }
    } catch {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth) loadAppointments();
  }, [auth, loadAppointments]);

  const handleCancel = async (bookingId: string) => {
    if (!auth) return;
    setCancellingId(bookingId);
    setError(null);
    try {
      const result = await api(auth.token, "cancel_appointment", { booking_id: bookingId });
      if (result.success) {
        setCancelledIds((prev) => new Set(prev).add(bookingId));
        setConfirmCancel(null);
      } else {
        setError(result.error || "Cancellation failed");
      }
    } catch {
      setError("Failed to cancel appointment");
    } finally {
      setCancellingId(null);
    }
  };

  if (authLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (authError) return <ErrorView message={authError} />;
  if (!auth) return null;

  const title = actionParam === "cancel"
    ? "Cancel Appointment"
    : actionParam === "reschedule"
    ? "Reschedule Appointment"
    : "My Appointments";

  const activeAppointments = appointments.filter(
    (a) => !cancelledIds.has(a.booking_id) && ["confirmed", "pending_payment"].includes(a.status)
  );

  return (
    <div>
      {/* Header Section */}
      <div className="relative mb-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-8 -translate-x-6" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-sm text-blue-100">
              {activeAppointments.length} upcoming appointment{activeAppointments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : activeAppointments.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
            <CalendarDays className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-base font-medium text-muted-foreground">No upcoming appointments</p>
          <p className="text-sm text-muted-foreground/70 mt-2 max-w-[250px] mx-auto">
            Go back to WhatsApp and tap &quot;Book Appointment&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAppointments.map((appt, index) => {
            const isConfirmed = appt.status === "confirmed";
            const relDate = getRelativeDate(appt.date);
            return (
              <div
                key={appt.booking_id}
                className="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] overflow-hidden"
                style={{ animationDelay: `${index * 80}ms`, animation: 'fadeSlideIn 0.4s ease-out both' }}
              >
                {/* Colored left border */}
                <div className="flex">
                  <div className={`w-1 shrink-0 ${isConfirmed ? 'bg-gradient-to-b from-emerald-400 to-emerald-500' : 'bg-gradient-to-b from-amber-400 to-amber-500'}`} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-[15px]">{appt.doctor_name}</p>
                        <p className="text-xs text-muted-foreground">{appt.specialty}</p>
                      </div>
                      <Badge
                        className={`text-[11px] font-medium border ${
                          isConfirmed
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {appt.status === "pending_payment" ? "Pending Payment" : appt.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate">{appt.patient_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>{appt.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{appt.time}</span>
                      </div>
                      {relDate && (
                        <div className="flex items-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            relDate === "Today"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : relDate === "Tomorrow"
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {relDate}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">{appt.booking_id}</p>

                    {/* Cancel action */}
                    {(actionParam === "cancel" || actionParam === "reschedule") && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                        {confirmCancel === appt.booking_id ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
                              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                                Are you sure you want to cancel this appointment?
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleCancel(appt.booking_id)}
                                disabled={cancellingId === appt.booking_id}
                                className="flex-1 h-11 rounded-xl"
                              >
                                {cancellingId === appt.booking_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-1" />
                                )}
                                Yes, Cancel
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmCancel(null)}
                                className="flex-1 h-11 rounded-xl"
                              >
                                Keep it
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmCancel(appt.booking_id)}
                            className="w-full h-11 rounded-xl text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel Appointment
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show cancelled appointments */}
      {cancelledIds.size > 0 && (
        <div className="mt-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {cancelledIds.size} appointment{cancelledIds.size > 1 ? "s" : ""} cancelled
            </p>
          </div>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
            You can close this page and return to WhatsApp.
          </p>
        </div>
      )}

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 flex items-center justify-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
      </div>
      <h2 className="text-lg font-bold mb-2">Link Expired</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70 mt-4">
        Go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
    </div>
  );
}
