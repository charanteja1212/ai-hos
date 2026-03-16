"use client";

import { useState, useEffect, useCallback } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  FileText,
  Loader2,
  Pill,
  CalendarDays,
  User,
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

  if (authLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-purple-100 dark:border-purple-900/40" />
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 absolute inset-0" />
        </div>
      </div>
    );
  if (authError) return <ErrorView message={authError} />;
  if (!auth) return null;

  return (
    <div className="animate-[fadeIn_0.4s_ease-out]">
      {/* Header Card */}
      <div className="relative mb-6 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 p-6 text-white overflow-hidden shadow-lg shadow-purple-500/20 dark:shadow-purple-900/30">
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-12 blur-sm" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-10 -translate-x-8 blur-sm" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-violet-400/10 rounded-full blur-md" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center ring-1 ring-white/20">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">My Prescriptions</h1>
            <p className="text-sm text-purple-100/90 mt-0.5">
              {prescriptions.length} prescription{prescriptions.length !== 1 ? "s" : ""} on file
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-5 p-4 bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 rounded-2xl backdrop-blur-sm animate-[fadeSlideIn_0.3s_ease-out]">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Something went wrong</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Loading prescriptions...</p>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-20 animate-[fadeSlideIn_0.5s_ease-out]">
          <div className="w-24 h-24 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/20 flex items-center justify-center ring-1 ring-purple-200/50 dark:ring-purple-800/30 shadow-sm">
            <FileText className="w-11 h-11 text-purple-400 dark:text-purple-500" />
          </div>
          <p className="text-base font-semibold text-foreground/80">No prescriptions yet</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-[260px] mx-auto leading-relaxed">
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
                className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-purple-100/40 dark:border-slate-700/40 shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-purple-500/5 dark:hover:shadow-purple-900/10 overflow-hidden"
                style={{
                  animationDelay: `${index * 80}ms`,
                  animation: "fadeSlideIn 0.4s ease-out both",
                }}
              >
                <div className="flex">
                  {/* Accent bar */}
                  <div className="w-1 shrink-0 bg-gradient-to-b from-purple-400 via-violet-500 to-purple-600" />

                  <div className="flex-1 min-w-0">
                    {/* Tappable header */}
                    <button
                      onClick={() => hasMeds && toggleExpanded(rx.rx_id)}
                      className="w-full text-left p-4 pb-3.5 active:bg-purple-50/50 dark:active:bg-slate-800/40 transition-colors duration-150"
                    >
                      {/* Doctor + Chevron row */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-purple-100/80 dark:bg-purple-900/30 flex items-center justify-center shrink-0 ring-1 ring-purple-200/50 dark:ring-purple-800/30">
                            <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[15px] text-foreground truncate">
                              {rx.doctor}
                            </p>
                            {rx.specialty && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {rx.specialty}
                              </p>
                            )}
                          </div>
                        </div>
                        {hasMeds && (
                          <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                            <ChevronDown
                              className={`w-4 h-4 text-purple-500 dark:text-purple-400 transition-transform duration-300 ease-out ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Date + ID row */}
                      <div className="flex items-center gap-3 mb-2.5 ml-12">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="w-3.5 h-3.5 text-purple-400/70" />
                          {rx.date}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono h-5 px-2 border-purple-200/60 dark:border-purple-800/40 text-purple-600/70 dark:text-purple-400/70 bg-purple-50/50 dark:bg-purple-900/10"
                        >
                          {rx.rx_id}
                        </Badge>
                      </div>

                      {/* Diagnosis chip */}
                      {rx.diagnosis && (
                        <div className="ml-12">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-purple-50/80 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/30">
                            <span className="text-xs text-purple-700 dark:text-purple-300 font-medium leading-none">
                              {rx.diagnosis}
                            </span>
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Expandable medications section */}
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        hasMeds && isExpanded
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4">
                          <div className="border-t border-purple-100/50 dark:border-slate-800/60 pt-4">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 ml-1">
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
                                    className="p-3 rounded-xl bg-gradient-to-r from-purple-50/60 to-violet-50/40 dark:from-slate-800/60 dark:to-slate-800/40 border border-purple-100/30 dark:border-slate-700/30 transition-all duration-200"
                                    style={{
                                      animationDelay: `${i * 60}ms`,
                                      animation: "fadeSlideIn 0.3s ease-out both",
                                    }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0 ring-1 ring-purple-200/40 dark:ring-purple-800/30">
                                        <Pill className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-foreground">
                                          {med.name}
                                        </p>
                                        <div className="mt-1.5 space-y-1">
                                          {med.dosage && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-[11px] font-medium text-purple-500/70 dark:text-purple-400/60 uppercase tracking-wide w-16 shrink-0">
                                                Dosage
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {med.dosage}
                                              </span>
                                            </div>
                                          )}
                                          {med.duration && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-[11px] font-medium text-purple-500/70 dark:text-purple-400/60 uppercase tracking-wide w-16 shrink-0">
                                                Duration
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {med.duration}
                                              </span>
                                            </div>
                                          )}
                                          {med.instructions && (
                                            <div className="flex items-start gap-2">
                                              <span className="text-[11px] font-medium text-purple-500/70 dark:text-purple-400/60 uppercase tracking-wide w-16 shrink-0 mt-px">
                                                Notes
                                              </span>
                                              <span className="text-xs text-muted-foreground leading-relaxed">
                                                {med.instructions}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="text-center py-20 animate-[fadeIn_0.4s_ease-out]">
      <div className="w-24 h-24 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20 flex items-center justify-center ring-1 ring-red-200/50 dark:ring-red-800/30 shadow-sm">
        <AlertCircle className="w-11 h-11 text-red-400" />
      </div>
      <h2 className="text-lg font-bold text-foreground mb-1.5">Link Expired</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/60 mt-4 max-w-[260px] mx-auto leading-relaxed">
        Go back to WhatsApp and type &quot;menu&quot; to get a new link.
      </p>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
