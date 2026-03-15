"use client";

import { useState, useEffect } from "react";

interface WaAuth {
  phone: string;
  tenantId: string;
  patientName: string | null;
  token: string;
}

interface UseWaAuthResult {
  auth: WaAuth | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to validate WhatsApp web token from URL params.
 * Used by all /wa/* pages for passwordless auth.
 */
export function useWaAuth(): UseWaAuthResult {
  const [auth, setAuth] = useState<WaAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError("No token provided. Please open this link from WhatsApp.");
      setLoading(false);
      return;
    }

    fetch(`/api/whatsapp/token?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Invalid or expired link");
        }
        return res.json();
      })
      .then((data) => {
        setAuth({
          phone: data.phone,
          tenantId: data.tenantId,
          patientName: data.patientName || null,
          token,
        });
      })
      .catch((err) => {
        setError(err.message || "Authentication failed");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { auth, loading, error };
}
