"use client";

import { useState, useEffect, useCallback } from "react";
import { useWaAuth } from "@/hooks/use-wa-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  FileText,
  Loader2,
  Pill,
  CalendarDays,
  User,
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

  if (authLoading) return <Shell><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></Shell>;
  if (authError) return <Shell><ErrorView message={authError} /></Shell>;
  if (!auth) return null;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          My Prescriptions
        </h1>
        <p className="text-sm text-muted-foreground">
          {prescriptions.length} prescription{prescriptions.length !== 1 ? "s" : ""}
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
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No prescriptions found</p>
          <p className="text-xs text-muted-foreground mt-2">
            Prescriptions will appear here after your consultation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx) => (
            <Card key={rx.rx_id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-primary" />
                      {rx.doctor}
                    </p>
                    {rx.specialty && (
                      <p className="text-xs text-muted-foreground ml-5.5">{rx.specialty}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">{rx.rx_id}</Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {rx.date}
                </div>

                {rx.diagnosis && (
                  <p className="text-sm mb-2">
                    <span className="text-muted-foreground">Diagnosis:</span>{" "}
                    <span className="font-medium">{rx.diagnosis}</span>
                  </p>
                )}

                {rx.medications && rx.medications.length > 0 && (
                  <div className="border-t pt-2 mt-2 space-y-1.5">
                    {rx.medications.map((med: { name: string; dosage?: string; duration?: string }, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Pill className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium">{med.name}</span>
                          {med.dosage && <span className="text-muted-foreground"> — {med.dosage}</span>}
                          {med.duration && <span className="text-muted-foreground"> ({med.duration})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
