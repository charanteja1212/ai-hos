"use client";

import { useState, useEffect, useCallback } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
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

  if (authLoading) return <Shell><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></Shell>;
  if (authError) return <Shell><ErrorView message={authError} /></Shell>;
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
    <Shell>
      <div className="mb-6">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {activeAppointments.length} upcoming appointment{activeAppointments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : activeAppointments.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No upcoming appointments</p>
          <p className="text-xs text-muted-foreground mt-2">
            Go back to WhatsApp and tap &quot;Book Appointment&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAppointments.map((appt) => (
            <Card key={appt.booking_id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{appt.doctor_name}</p>
                    <p className="text-xs text-muted-foreground">{appt.specialty}</p>
                  </div>
                  <Badge
                    variant={appt.status === "confirmed" ? "default" : "secondary"}
                    className={appt.status === "confirmed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : ""}
                  >
                    {appt.status === "pending_payment" ? "Pending Payment" : appt.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    {appt.patient_name}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {appt.date}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {appt.time}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {appt.booking_id}
                  </div>
                </div>

                {/* Cancel action */}
                {(actionParam === "cancel" || actionParam === "reschedule") && (
                  <div className="border-t pt-3">
                    {confirmCancel === appt.booking_id ? (
                      <div className="space-y-2">
                        <p className="text-sm text-destructive font-medium">
                          Are you sure you want to cancel this appointment?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(appt.booking_id)}
                            disabled={cancellingId === appt.booking_id}
                            className="flex-1"
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
                            className="flex-1"
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
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel Appointment
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Show cancelled appointments */}
      {cancelledIds.size > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium">
              {cancelledIds.size} appointment{cancelledIds.size > 1 ? "s" : ""} cancelled
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            You can close this page and return to WhatsApp.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-lg mx-auto px-4 py-6 pb-20">{children}</div>;
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2">Link Expired</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-4">
        Go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
    </div>
  );
}
