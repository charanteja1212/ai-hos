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

  if (authLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  if (authError) return <ErrorView message={authError} />;
  if (!auth) return null;

  return (
    <div>
      {/* Header Section */}
      <div className="relative mb-6 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 p-5 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-8 -translate-x-6" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">My Prescriptions</h1>
            <p className="text-sm text-purple-100">
              {prescriptions.length} prescription{prescriptions.length !== 1 ? "s" : ""}
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
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-purple-500" /></div>
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 flex items-center justify-center">
            <FileText className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-base font-medium text-muted-foreground">No prescriptions found</p>
          <p className="text-sm text-muted-foreground/70 mt-2 max-w-[250px] mx-auto">
            Prescriptions will appear here after your consultation.
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
                className="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/30 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-lg"
                style={{ animationDelay: `${index * 80}ms`, animation: 'fadeSlideIn 0.4s ease-out both' }}
              >
                <div className="flex">
                  <div className="w-1 shrink-0 bg-gradient-to-b from-purple-400 to-violet-500" />
                  <div className="flex-1">
                    {/* Tappable header area */}
                    <button
                      onClick={() => hasMeds && toggleExpanded(rx.rx_id)}
                      className="w-full text-left p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-[15px] flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-purple-500" />
                            {rx.doctor}
                          </p>
                          {rx.specialty && (
                            <p className="text-xs text-muted-foreground ml-[22px]">{rx.specialty}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasMeds && (
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="w-3 h-3" />
                          {rx.date}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5">{rx.rx_id}</Badge>
                      </div>

                      {rx.diagnosis && (
                        <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
                          <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">{rx.diagnosis}</span>
                        </div>
                      )}
                    </button>

                    {/* Expandable medications */}
                    {hasMeds && isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Medications</p>
                          {rx.medications!.map((med: { name: string; dosage?: string; duration?: string }, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                              style={{ animationDelay: `${i * 50}ms`, animation: 'fadeSlideIn 0.3s ease-out both' }}
                            >
                              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                <Pill className="w-3.5 h-3.5 text-purple-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{med.name}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                  {med.dosage && (
                                    <span className="text-xs text-muted-foreground">{med.dosage}</span>
                                  )}
                                  {med.duration && (
                                    <span className="text-xs text-muted-foreground">{med.duration}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
