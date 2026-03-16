"use client";

import { useState, useEffect, useCallback } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  User,
  XCircle,
  ShieldAlert,
  CalendarX2,
  ArrowLeft,
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

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">Loading your appointments...</p>
      </div>
    );
  }
  if (authError) return <ErrorView message={authError} />;
  if (!auth) return null;

  const title = actionParam === "cancel"
    ? "Cancel Appointment"
    : actionParam === "reschedule"
    ? "Reschedule Appointment"
    : "My Appointments";

  const subtitle = actionParam === "cancel"
    ? "Select the appointment you want to cancel"
    : actionParam === "reschedule"
    ? "Select the appointment you want to reschedule"
    : "Manage your upcoming visits";

  const activeAppointments = appointments.filter(
    (a) => !cancelledIds.has(a.booking_id) && ["confirmed", "pending_payment"].includes(a.status)
  );

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header Card */}
      <div className="relative mb-6 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 p-6 text-white overflow-hidden shadow-xl shadow-blue-600/20 dark:shadow-blue-900/30">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.07] rounded-full -translate-y-16 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/[0.05] rounded-full translate-y-12 -translate-x-8" />
        <div className="absolute top-1/2 right-8 w-16 h-16 bg-white/[0.04] rounded-full" />

        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
              {actionParam === "cancel" ? (
                <CalendarX2 className="w-6 h-6" />
              ) : (
                <CalendarDays className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-blue-100/90 mt-0.5">{subtitle}</p>
            </div>
          </div>

          {!loading && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-blue-100/80">
                  {activeAppointments.length} upcoming appointment{activeAppointments.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-5 p-4 bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 rounded-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Something went wrong</p>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
          <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">Fetching appointments...</p>
        </div>
      ) : activeAppointments.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative w-24 h-24 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 flex items-center justify-center">
              <CalendarDays className="w-10 h-10 text-blue-400/80 dark:text-blue-500/60" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No upcoming appointments</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-[260px] mx-auto leading-relaxed">
            Go back to WhatsApp and tap &quot;Book Appointment&quot; to schedule your next visit.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to WhatsApp</span>
          </div>
        </div>
      ) : (
        /* Appointment Cards */
        <div className="space-y-4">
          {activeAppointments.map((appt, index) => {
            const isConfirmed = appt.status === "confirmed";
            const relDate = getRelativeDate(appt.date);
            return (
              <div
                key={appt.booking_id}
                className="group rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/40 shadow-sm shadow-slate-200/50 dark:shadow-slate-900/50 transition-all duration-300 hover:shadow-md hover:shadow-slate-200/80 dark:hover:shadow-slate-900/80 hover:-translate-y-0.5 overflow-hidden"
                style={{ animationDelay: `${index * 100}ms`, animation: 'fadeSlideIn 0.5s ease-out both' }}
              >
                {/* Status accent bar */}
                <div className={`h-1 w-full ${
                  isConfirmed
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    : 'bg-gradient-to-r from-amber-400 to-amber-500'
                }`} />

                <div className="p-5">
                  {/* Top row: Doctor info + Status badge */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isConfirmed
                          ? 'bg-emerald-50 dark:bg-emerald-900/20'
                          : 'bg-amber-50 dark:bg-amber-900/20'
                      }`}>
                        <User className={`w-5 h-5 ${
                          isConfirmed
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[15px] text-slate-800 dark:text-slate-100 truncate">
                          {appt.doctor_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{appt.specialty}</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
                      isConfirmed
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-700/40"
                        : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-700/40"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isConfirmed ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      {appt.status === "pending_payment" ? "Pending" : appt.status}
                    </span>
                  </div>

                  {/* Details grid */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-3.5 mb-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2.5">
                        <CalendarDays className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Date</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{appt.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        <div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Time</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{appt.time}</p>
                        </div>
                      </div>
                    </div>

                    {/* Patient name row */}
                    <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/40">
                      <User className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Patient</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{appt.patient_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Relative date badge + booking ID */}
                  <div className="flex items-center justify-between">
                    {relDate ? (
                      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                        relDate === "Today"
                          ? "bg-blue-100/80 text-blue-700 ring-1 ring-blue-200/50 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-700/40"
                          : relDate === "Tomorrow"
                          ? "bg-indigo-100/80 text-indigo-700 ring-1 ring-indigo-200/50 dark:bg-indigo-900/20 dark:text-indigo-300 dark:ring-indigo-700/40"
                          : "bg-slate-100/80 text-slate-600 ring-1 ring-slate-200/50 dark:bg-slate-800/40 dark:text-slate-300 dark:ring-slate-700/40"
                      }`}>
                        {relDate}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-[10px] text-slate-400/70 dark:text-slate-500/70 font-mono tracking-wide">
                      {appt.booking_id}
                    </span>
                  </div>

                  {/* Cancel / Reschedule action */}
                  {(actionParam === "cancel" || actionParam === "reschedule") && (
                    <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4 mt-4">
                      {confirmCancel === appt.booking_id ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="flex items-start gap-3 p-3.5 bg-red-50/80 dark:bg-red-950/20 rounded-xl border border-red-200/50 dark:border-red-800/30">
                            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                              <ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                Confirm cancellation
                              </p>
                              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                                This action cannot be undone.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancel(appt.booking_id)}
                              disabled={cancellingId === appt.booking_id}
                              className="flex-1 h-11 rounded-xl font-medium shadow-sm"
                            >
                              {cancellingId === appt.booking_id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <XCircle className="w-4 h-4 mr-2" />
                              )}
                              Yes, Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmCancel(null)}
                              className="flex-1 h-11 rounded-xl font-medium border-slate-200 dark:border-slate-700"
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
                          className="w-full h-11 rounded-xl text-red-500 dark:text-red-400 border-red-200/60 dark:border-red-800/40 hover:bg-red-50/80 dark:hover:bg-red-950/20 hover:border-red-300 dark:hover:border-red-700 font-medium transition-colors duration-200"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel Appointment
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancelled appointments success message */}
      {cancelledIds.size > 0 && (
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50/80 dark:from-emerald-950/20 dark:to-green-950/10 border border-emerald-200/60 dark:border-emerald-800/30 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-green-400" />
          <div className="p-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {cancelledIds.size} appointment{cancelledIds.size > 1 ? "s" : ""} cancelled successfully
                </p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-1 leading-relaxed">
                  You can safely close this page and return to WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative w-24 h-24 mx-auto mb-5">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-400/80 dark:text-red-500/60" />
        </div>
      </div>
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Link Expired</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-[260px] mx-auto leading-relaxed">{message}</p>
      <div className="mt-6 p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl max-w-[260px] mx-auto">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Go back to WhatsApp and type &quot;menu&quot; to get a new link.
        </p>
      </div>
    </div>
  );
}
