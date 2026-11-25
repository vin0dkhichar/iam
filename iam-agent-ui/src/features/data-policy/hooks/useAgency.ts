"use client";

import { useEffect, useState } from "react";

export type AgencyInfo = {
  agency_id: string;
  name?: string | null;
  staff_api_url?: string | null;
  agent_api_url?: string | null;
};

export function useAgency() {
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/users/agency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!cancelled) {
            setError(data?.error || data?.detail || "Could not load agency");
            setAgency(null);
          }
          return;
        }
        if (!cancelled) {
          setAgency(data as AgencyInfo);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load agency");
          setAgency(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    agency,
    apiUrl: agency?.agent_api_url ?? agency?.staff_api_url ?? null,
    loading,
    error,
  };
}
