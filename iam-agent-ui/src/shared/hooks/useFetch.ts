import { useAuth } from "@/context/Auth";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { withCsrfHeaders } from "@/shared/utils/csrf";

interface UseFetchConfig {
  url?: string | null;
  options?: RequestInit;
  enabled?: boolean;
}

export function useFetch<T = any>({ url = null, options, enabled = true }: UseFetchConfig = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url && enabled);
  const { logout } = useAuth();
  const controllerRef = useRef<AbortController | null>(null);
  const optionsString = useMemo(() => JSON.stringify(options), [options]);

  const execute = useCallback(
    async (executeUrl?: string, executeOptions?: RequestInit): Promise<T | null> => {
      const finalUrl = executeUrl || url;
      const finalOptions = executeOptions || options;
      if (!finalUrl) {
        throw new Error("URL is required for execute");
      }
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const method = (finalOptions?.method || "GET").toUpperCase();
        const res = await fetch(finalUrl, {
          ...finalOptions,
          credentials: "include",
          headers:
            finalOptions?.body instanceof FormData
              ? withCsrfHeaders(method, finalOptions?.headers)
              : withCsrfHeaders(method, {
                  "Content-Type": "application/json",
                  ...(finalOptions?.headers ?? {}),
                }),
          signal: controller.signal,
        });
        if (res.status === 401) {
          logout();
          return null;
        }
        const result = await res.json();
        if (!res.ok) {
          const message =
            result?.error ||
            result?.errors?.[0]?.message ||
            result?.detail ||
            "Request failed";
          setError(String(message));
          setData(null);
          return { error: String(message) } as T;
        }
        setData(result);
        return result;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return null;
        }
        const message = err instanceof Error ? err.message : "Request failed";
        setError(message);
        setData(null);
        return null;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setLoading(false);
      }
    },
    [url, options, logout],
  );

  useEffect(() => {
    if (!url || !enabled) {
      setLoading(false);
      return;
    }
    void execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, optionsString]);

  return { data, error, loading, execute };
}
