"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFetch } from "@/shared/hooks/useFetch";

export type RegistryApplication = {
  id: number;
  application_mnemonic: string;
  application_description?: string | null;
  staff_api_url?: string | null;
  agent_api_url?: string | null;
};

/** Staff applications flagged is_registry (for AGT_ register pickers). */
export function useRegistryApplications(enabled = true) {
  const { execute } = useFetch();
  const [registries, setRegistries] = useState<RegistryApplication[]>([]);
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
      const data = await execute("/api/users/registries", {
        method: "POST",
        body: "{}",
      });
      if (current !== seq.current) return;
      if (data?.error) {
        setError(typeof data.error === "string" ? data.error : "Failed to load registries");
        setRegistries([]);
        return;
      }
      const list = Array.isArray(data?.items) ? data.items : [];
      setRegistries(list as RegistryApplication[]);
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
