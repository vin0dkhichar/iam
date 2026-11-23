"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type AuthState = {
  user: { name?: string; email?: string; preferred_username?: string; sub?: string } | null;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    window.location.href = "/api/logout";
  }, []);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/me");
      if (response.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/api/login?redirect_uri=${encodeURIComponent(next)}`;
        return;
      }
      if (response.ok) {
        setUser(await response.json());
      }
      setReady(true);
    }
    load();
  }, []);

  if (!ready) {
    return <p className="p-8 text-[16px]">…</p>;
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
