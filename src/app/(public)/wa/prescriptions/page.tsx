"use client";

import { useState, useEffect, useCallback } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import {
  AlertCircle,
  FileText,
  Loader2,
  Pill,
  CalendarDays,
  ChevronDown,
} from "lucide-react";

interface Prescription {
  rx_id: string;
  doctor: string;
  date: string;
  specialty?: string;
  diagnosis?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  medications?: any[];
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

export default function PrescriptionsPage() {
  const { auth, loading: authLoading, error: authError } = useWaAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const result = await api(auth.token, "list_prescriptions");
      if (result.prescriptions) {
        setPrescriptions(result.prescriptions);
      } else if (result.error) {
        setError(result.error);
      } else {
        setPrescriptions([]);
      }
    } catch {
      setError("Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth) load();
  }, [auth, load]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        <p className="mt-3 text-sm text-muted-foreground">Loading prescriptions...</p>
      </div>
    );
  }
  if (authError) return <ErrorView message={authError} />;
  if (!auth) return null;

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">My Prescriptions</h1>
            <p className="text-sm text-muted-foreground">
              {prescriptions.length} prescription{prescriptions.length !== 1 ? "s" : ""} on file
            </p>
          </div>
        </div>
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

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
          <p className="mt-3 text-sm text-muted-foreground">Loading prescriptions...</p>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-foreground">No prescriptions yet</h3>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-[260px] mx-auto">
            Your prescriptions will appear here after your doctor consultation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx, index) => {
            const isExpanded = expandedIds.has(rx.rx_id);
            const hasMeds = rx.medications && rx.medications.length > 0;
            return (
              <div
                key={rx.rx_id}
                className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden"
                style={{
                  animationDelay: `${index * 80}ms`,
                  animation: "fadeSlideIn 0.4s ease-out both",
                }}
              >
                {/* Tappable header */}
                <button
                  onClick={() => hasMeds && toggleExpanded(rx.rx_id)}
                  className="w-full text-left p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
                >
                  {/* Doctor name + Date */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-semibold text-foreground truncate">
                      {rx.doctor}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{rx.date}</span>
                    </div>
                  </div>

                  {/* Specialty */}
                  {rx.specialty && (
                    <p className="text-sm text-muted-foreground mb-2">{rx.specialty}</p>
                  )}

                  {/* Diagnosis badge + Chevron */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {rx.diagnosis && (
                        <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 truncate">
                          {rx.diagnosis}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {rx.rx_id}
                      </span>
                    </div>
                    {hasMeds && (
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </div>
                </button>

                {/* Expandable medications */}
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    hasMeds && isExpanded
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                      <div className="border-t border-border pt-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                          Medications
                        </p>
                        <div className="space-y-2">
                          {rx.medications?.map(
                            (
                              med: {
                                name: string;
                                dosage?: string;
                                duration?: string;
                                instructions?: string;
                              },
                              i: number
                            ) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                                style={{
                                  animationDelay: `${i * 60}ms`,
                                  animation: "fadeSlideIn 0.3s ease-out both",
                                }}
                              >
                                <Pill className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-foreground">
                                    {med.name}
                                  </p>
                                  {med.dosage && (
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                      {med.dosage}
                                    </p>
                                  )}
                                  {med.duration && (
                                    <p className="text-sm text-muted-foreground">
                                      {med.duration}
                                    </p>
                                  )}
                                  {med.instructions && (
                                    <p className="text-sm text-muted-foreground italic">
                                      {med.instructions}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
      <h2 className="text-lg font-semibold text-foreground">Link Expired</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[260px] mx-auto">{message}</p>
      <p className="text-xs text-muted-foreground mt-4 max-w-[260px] mx-auto">
        Go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>
    </div>
  );
}
