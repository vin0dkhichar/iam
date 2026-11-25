"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFetch } from "@/shared/hooks/useFetch";
import type { Application } from "@/features/application/types";

/** Staff applications flagged is_registry (for AGC_/register pickers). */
export function useRegistryApplications(enabled = true) {
  const { execute } = useFetch();
  const [registries, setRegistries] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setRegistries([]);
      return;
    }
    const current = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await execute("/api/applications", {
        method: "POST",
        body: JSON.stringify({
          current_page: 1,
          page_size: 100,
          request_payload: { application_type: "staff", is_registry: true },
        }),
      });
      if (current !== seq.current) return;
      if (data?.error) {
        setError(data.error);
        setRegistries([]);
        return;
      }
      const list = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];
      setRegistries(list as Application[]);
    } catch (err) {
      if (current !== seq.current) return;
      setError(err instanceof Error ? err.message : "Failed to load registries");
      setRegistries([]);
    } finally {
      if (current === seq.current) setLoading(false);
    }
  }, [enabled, execute]);

  useEffect(() => {
    void load();
  }, [load]);

  return { registries, loading, error, refresh: load };
}
