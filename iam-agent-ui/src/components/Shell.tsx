"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/Auth";

export default function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { user, logout } = useAuth();
  const displayName = user?.name || user?.preferred_username || user?.email || user?.sub || "";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 flex h-screen w-(--sidebar-width) shrink-0 flex-col bg-black py-7 text-white">
        <div className="mb-5 flex flex-col items-start border-b border-white/10 px-6 pb-7">
          <img src="/openg2p-logo-horizontal.svg" alt="OpenG2P" className="block h-auto w-40" />
          <span className="mt-6 text-[20px] leading-[1.2] font-medium text-white">{t("appTitle")}</span>
        </div>
        <nav className="flex-1">
          <span className="block border-l-[3px] border-l-(--color-yellow) bg-[rgba(245,187,26,0.14)] px-5 py-3 text-[16px] font-medium text-(--color-yellow)">
            {t("navUsers")}
          </span>
        </nav>
        <div className="flex flex-col gap-2.5 border-t border-white/10 px-6 py-4">
          {displayName && <div className="truncate text-[16px] font-medium text-white">{displayName}</div>}
          <button
            type="button"
            onClick={logout}
            className="rounded-[10px] border border-gray-400 px-3 py-2 text-[16px] text-white hover:bg-gray-600"
          >
            {t("logout")}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
