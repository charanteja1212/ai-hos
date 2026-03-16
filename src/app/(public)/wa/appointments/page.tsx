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
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading your appointments...</p>
      </div>
    );
  }
  if (authError) return <ErrorView message={authError} />;
  if (!auth) return null;

  const title = "My Appointments";
  const subtitle = "Manage your upcoming visits";

  const activeAppointments = appointments.filter(
    (a) => !cancelledIds.has(a.booking_id) && ["confirmed", "pending_payment"].includes(a.status)
  );

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        {!loading && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {activeAppointments.length} upcoming appointment{activeAppointments.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Something went wrong</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">Fetching appointments...</p>
        </div>
      ) : activeAppointments.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No upcoming appointments</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-[260px] mx-auto">
            Go back to WhatsApp and tap &quot;Book Appointment&quot; to schedule your next visit.
          </p>
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to WhatsApp</span>
          </div>
        </div>
      ) : (
        /* Appointment Cards */
        <div className="space-y-3">
          {activeAppointments.map((appt, index) => {
            const isConfirmed = appt.status === "confirmed";
            const relDate = getRelativeDate(appt.date);
            return (
              <div
                key={appt.booking_id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                style={{ animationDelay: `${index * 80}ms`, animation: "fadeSlideIn 0.4s ease-out both" }}
              >
                <div className="p-4">
                  {/* Doctor name + Status badge */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {appt.doctor_name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{appt.specialty}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                      isConfirmed
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isConfirmed ? "bg-emerald-500" : "bg-amber-500"
                      }`} />
                      {appt.status === "pending_payment" ? "Pending" : appt.status}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Date</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{appt.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Time</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{appt.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <User className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Patient</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{appt.patient_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Relative date + Booking ID */}
                  <div className="flex items-center justify-between">
                    {relDate ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        relDate === "Today"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          : relDate === "Tomorrow"
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {relDate}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      {appt.booking_id}
                    </span>
                  </div>

                  {/* Cancel action — always visible */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                    {confirmCancel === appt.booking_id ? (
                      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                          <ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-700 dark:text-red-300">
                              Confirm cancellation
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                              This action cannot be undone.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(appt.booking_id)}
                            disabled={cancellingId === appt.booking_id}
                            className="flex-1 h-10 rounded-lg font-medium"
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
                            className="flex-1 h-10 rounded-lg font-medium"
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
                        className="w-full h-10 rounded-lg text-red-500 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20 font-medium"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel Appointment
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancelled success message */}
      {cancelledIds.size > 0 && (
        <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                {cancelledIds.size} appointment{cancelledIds.size > 1 ? "s" : ""} cancelled successfully
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                You can safely close this page and return to WhatsApp.
              </p>
            </div>
          </div>
        </div>
      )}

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
      <AlertCircle className="w-12 h-12 text-red-400 dark:text-red-500 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Link Expired</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-[260px] mx-auto">{message}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 max-w-[260px] mx-auto">
        Go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
    </div>
  );
}
