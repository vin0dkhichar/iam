"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function errorMessage(
  data: { detail?: unknown; error?: unknown; errors?: { message?: string }[] },
  fallback: string,
  notAdmin: string,
) {
  const fromList = data.errors?.find((item) => item.message)?.message;
  const message =
    fromList ||
    (typeof data.detail === "string" && data.detail) ||
    (typeof data.error === "string" && data.error) ||
    fallback;
  if (message === "Only an agency admin can manage agents") return notAdmin;
  return message;
}

type AgentUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  sync_status: string;
};

export default function UsersPage() {
  const t = useTranslations();
  const [users, setUsers] = useState<AgentUser[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", roles: "" });
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});

  async function load() {
    const response = await fetch("/api/users");
    const data = await response.json();
    if (!response.ok) {
      setError(errorMessage(data, t("loadFailed"), t("notAdmin")));
      return;
    }
    setError("");
    setUsers(data.users || []);
  }

  useEffect(() => {
    load();
  }, []);

  function rolesOf(value: string) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, roles: rolesOf(form.roles) }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(errorMessage(data, t("createFailed"), t("notAdmin")));
      return;
    }
    setForm({ first_name: "", last_name: "", email: "", roles: "" });
    await load();
  }

  async function assignRoles(userId: string) {
    const response = await fetch("/api/users/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, roles: rolesOf(roleDrafts[userId] || "") }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(errorMessage(data, t("updateFailed"), t("notAdmin")));
      return;
    }
    await load();
  }

  async function deleteUser(userId: string) {
    const response = await fetch("/api/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(errorMessage(data, t("deleteFailed"), t("notAdmin")));
      return;
    }
    await load();
  }

  const fieldClass = "rounded-[10px] border border-(--color-grey) px-3 py-2 text-[16px]";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold text-black">{t("title")}</h1>
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}
      <form onSubmit={createUser} className="mb-6 grid gap-3 rounded-[10px] bg-white p-6 shadow-sm md:grid-cols-2">
        <input className={fieldClass} placeholder={t("firstName")} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required />
        <input className={fieldClass} placeholder={t("lastName")} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required />
        <input className={fieldClass} placeholder={t("email")} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <input className={fieldClass} placeholder={t("rolesPlaceholder")} value={form.roles} onChange={(event) => setForm({ ...form, roles: event.target.value })} />
        <button type="submit" className="w-fit rounded-[10px] bg-(--color-accent) px-4 py-2 text-[16px] font-medium text-black hover:bg-(--color-accent-hover)">
          {t("createUser")}
        </button>
      </form>
      <div className="overflow-x-auto rounded-[10px] bg-white py-6 shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[16px] text-black/60">
              <th className="px-6 py-2 font-medium">{t("name")}</th>
              <th className="px-6 py-2 font-medium">{t("email")}</th>
              <th className="px-6 py-2 font-medium">{t("status")}</th>
              <th className="px-6 py-2 font-medium">{t("roles")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-black/5">
                <td className="px-6 py-3">{user.first_name} {user.last_name}</td>
                <td className="px-6 py-3">{user.email}</td>
                <td className="px-6 py-3">{user.sync_status}</td>
                <td className="px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={fieldClass}
                      placeholder={t("rolesPlaceholder")}
                      value={roleDrafts[user.id] ?? ""}
                      onChange={(event) => setRoleDrafts({ ...roleDrafts, [user.id]: event.target.value })}
                    />
                    <button type="button" className="rounded-[10px] bg-black px-3 py-2 text-white" onClick={() => assignRoles(user.id)}>{t("updateRoles")}</button>
                    <button type="button" className="rounded-[10px] bg-red-600 px-3 py-2 text-white" onClick={() => deleteUser(user.id)}>{t("delete")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
