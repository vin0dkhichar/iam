"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/Auth";

function errorMessage(
  data: {
    detail?: unknown;
    error?: unknown;
    errors?: { message?: string }[];
    response_header?: { response_error_message?: string };
  },
  fallback: string,
  notAdmin: string,
) {
  const message =
    data.response_header?.response_error_message ||
    data.errors?.find((item) => item.message)?.message ||
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
  roles: string[];
};

type AgencyPolicy = {
  policy_id: string;
  policy_mnemonic: string;
  policy_description?: string | null;
  policy_target: string;
  policy_type: string;
  register_id?: string | null;
  policy_filter_expression?: Record<string, unknown> | null;
  sync_status?: string | null;
};

type Mode = "add" | "view" | "edit" | "delete" | null;

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  roles: [] as string[],
  policies: [] as string[],
};

function isPolicyRole(role: string) {
  return role.startsWith("AGC_") || role.startsWith("DP_");
}

function StaffTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] bg-white py-6 shadow-[0_1px_2px_rgba(6,19,39,0.05)]">
      <table className="w-full table-fixed border-collapse bg-white">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-gray-200 px-9 pb-3 text-left text-[16px] font-semibold tracking-wider text-[#ED7C22]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-600">{empty}</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.key} className={index % 2 === 1 ? "bg-white" : "bg-gray-50"}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-9 py-4 align-middle text-[16px] text-black">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function statusLabel(t: (key: string) => string, value?: string | null) {
  if (!value) return "—";
  const key = `status_${value.toLowerCase()}`;
  const known = ["status_pending", "status_syncing", "status_synced", "status_failed"];
  return known.includes(key) ? t(key) : value;
}

export default function UsersPage() {
  const t = useTranslations();
  const { setDenied } = useAuth();
  const menu = useSearchParams().get("menu") || "users";
  const [users, setUsers] = useState<AgentUser[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<AgentUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState<AgencyPolicy[]>([]);
  const [viewPolicy, setViewPolicy] = useState<AgencyPolicy | null>(null);

  async function load() {
    const [usersResponse, rolesResponse, policiesResponse] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/users/roles"),
      fetch("/api/users/data-policies"),
    ]);
    const usersData = await usersResponse.json();
    const rolesData = await rolesResponse.json();
    const policiesData = await policiesResponse.json();
    const forbidden = [usersResponse, rolesResponse, policiesResponse].some((response) => response.status === 403);
    if (forbidden) {
      setDenied(true);
      return;
    }
    if (!usersResponse.ok) {
      const message = errorMessage(usersData, t("loadFailed"), t("notAdmin"));
      setError(message);
      toast.error(message);
      return;
    }
    if (!rolesResponse.ok) toast.error(errorMessage(rolesData, t("loadFailed"), t("notAdmin")));
    if (!policiesResponse.ok) toast.error(errorMessage(policiesData, t("loadFailed"), t("notAdmin")));
    setError("");
    setUsers(usersData.users || []);
    setRoleOptions(Array.isArray(rolesData.roles) ? rolesData.roles : []);
    setPolicies(Array.isArray(policiesData.policies) ? policiesData.policies : []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setMode(null);
  }, [menu]);

  function openAdd() {
    setSelected(null);
    setForm(emptyForm);
    setMode("add");
  }

  function openUser(nextMode: "view" | "edit" | "delete", user: AgentUser) {
    const assigned = user.roles || [];
    setSelected(user);
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      roles: assigned.filter((role) => !isPolicyRole(role)),
      policies: assigned.filter(isPolicyRole),
    });
    setMode(nextMode);
  }

  function togglePolicy(policy: string) {
    setForm((current) => ({
      ...current,
      policies: current.policies.includes(policy)
        ? current.policies.filter((item) => item !== policy)
        : [...current.policies, policy],
    }));
  }

  function toggleRole(role: string) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role],
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response =
        mode === "add"
          ? await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                first_name: form.first_name,
                last_name: form.last_name,
                email: form.email,
                roles: [...form.roles, ...form.policies],
              }),
            })
          : await fetch("/api/users/roles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: selected?.id, roles: [...form.roles, ...form.policies] }),
            });
      const data = await response.json();
      if (!response.ok) {
        const message = errorMessage(data, mode === "add" ? t("createFailed") : t("updateFailed"), t("notAdmin"));
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(mode === "add" ? t("userCreated") : t("userUpdated"));
      setMode(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch("/api/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selected.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        const message = errorMessage(data, t("deleteFailed"), t("notAdmin"));
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(t("userDeleted"));
      setMode(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "w-full rounded-[10px] border border-(--color-grey) px-3 py-2 text-[16px] disabled:bg-(--color-light-grey)";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold text-black">
          {menu === "roles" ? t("navRoles") : menu === "data-policies" ? t("navDataPolicies") : t("title")}
        </h1>
        {menu === "users" && (
          <button type="button" className="rounded-[10px] bg-black px-4 py-2 text-[16px] font-medium text-white" onClick={openAdd}>
            {t("add")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}
      {menu === "roles" && (
        <StaffTable
          columns={[t("name")]}
          empty={t("noRoles")}
          rows={roleOptions.map((role) => ({ key: role, cells: [role] }))}
        />
      )}
      {menu === "data-policies" && (
        <StaffTable
          columns={[t("name"), t("policyTarget"), t("policyType"), t("status"), t("actions")]}
          empty={t("noDataPolicies")}
          rows={policies.map((policy) => ({
            key: policy.policy_id || policy.policy_mnemonic + policy.policy_target,
            cells: [
              policy.policy_mnemonic,
              policy.policy_target,
              policy.policy_type,
              statusLabel(t, policy.sync_status),
              <button key="view" type="button" className="rounded-[10px] bg-[#e1e1e1] px-4 py-2 text-[16px] font-medium text-black/50" onClick={() => setViewPolicy(policy)}>{t("view")}</button>,
            ],
          }))}
        />
      )}
      {menu === "users" && (
        <StaffTable
          columns={[t("name"), t("email"), t("status"), t("actions")]}
          empty={t("noUsers")}
          rows={users.map((user) => ({
            key: user.id,
            cells: [
              `${user.first_name} ${user.last_name}`,
              user.email,
              statusLabel(t, user.sync_status),
              <div key="actions" className="flex gap-2">
                <button type="button" className="rounded-[10px] bg-[#e1e1e1] px-4 py-2 text-[16px] font-medium text-black/50" onClick={() => openUser("view", user)}>{t("view")}</button>
                <button type="button" className="rounded-[10px] bg-black px-4 py-2 text-[16px] font-medium text-white" onClick={() => openUser("edit", user)}>{t("edit")}</button>
                <button type="button" className="rounded-[10px] bg-[rgba(192,57,43,0.1)] px-4 py-2 text-[16px] font-medium text-[#c0392b]" onClick={() => openUser("delete", user)}>{t("delete")}</button>
              </div>,
            ],
          }))}
        />
      )}

      {viewPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewPolicy(null)}>
          <div className="max-h-[80vh] w-full max-w-[800px] overflow-y-auto rounded-[10px] border-4 border-[#EABB13] bg-white p-8 shadow-lg" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[22px] font-bold text-[#ED7C22]">{t("viewPolicy")}</h2>
              <button type="button" className="text-[28px] leading-none text-gray-500" onClick={() => setViewPolicy(null)}>×</button>
            </div>
            <div className="grid gap-4 text-[16px]">
              {[
                [t("policyMnemonic"), viewPolicy.policy_mnemonic],
                [t("policyTarget"), viewPolicy.policy_target],
                [t("policyType"), viewPolicy.policy_type],
                [t("policyId"), viewPolicy.policy_id],
                [t("status"), statusLabel(t, viewPolicy.sync_status)],
                ...(viewPolicy.register_id ? [[t("registerId"), viewPolicy.register_id]] : []),
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[1.2fr_2fr] gap-4">
                  <span className="font-medium text-gray-500">{label}</span>
                  <span className="break-all text-black">{value || "—"}</span>
                </div>
              ))}
              <div>
                <p className="mb-2 font-medium text-gray-500">{t("policyDescription")}</p>
                <div className="rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-2">{viewPolicy.policy_description || "—"}</div>
              </div>
              <div>
                <p className="mb-2 font-medium text-gray-500">{t("policyFilter")}</p>
                <pre className="overflow-auto whitespace-pre-wrap rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-2 font-mono text-[14px]">
                  {JSON.stringify(viewPolicy.policy_filter_expression ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMode(null)}>
          <div
            className="max-h-[80vh] w-full max-w-[600px] overflow-y-auto rounded-[10px] border-4 border-[#EABB13] bg-white p-8 shadow-lg"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[22px] font-bold text-[#ED7C22]">
                {mode === "add" ? t("addUser") : mode === "edit" ? t("editUser") : mode === "delete" ? t("deleteUser") : t("viewUser")}
              </h2>
              <button type="button" className="text-[28px] leading-none text-gray-500" onClick={() => setMode(null)}>×</button>
            </div>
            <form onSubmit={save} className="grid gap-4">
              {mode !== "view" && (
                <>
                  <label className="grid gap-1 text-[16px]">
                    {t("firstName")}
                    <input className={fieldClass} value={form.first_name} disabled={mode === "edit" || mode === "delete"} required onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
                  </label>
                  <label className="grid gap-1 text-[16px]">
                    {t("lastName")}
                    <input className={fieldClass} value={form.last_name} disabled={mode === "edit" || mode === "delete"} required onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
                  </label>
                  <label className="grid gap-1 text-[16px]">
                    {t("email")}
                    <input className={fieldClass} type="email" value={form.email} disabled={mode === "edit" || mode === "delete"} required onChange={(event) => setForm({ ...form, email: event.target.value })} />
                  </label>
                </>
              )}
              {mode === "view" && (
                <>
                  <label className="grid gap-1 text-[16px]">
                    {t("firstName")}
                    <input className={fieldClass} value={form.first_name} disabled />
                  </label>
                  <label className="grid gap-1 text-[16px]">
                    {t("lastName")}
                    <input className={fieldClass} value={form.last_name} disabled />
                  </label>
                  <label className="grid gap-1 text-[16px]">
                    {t("email")}
                    <input className={fieldClass} type="email" value={form.email} disabled />
                  </label>
                  <pre className="overflow-auto rounded-[10px] bg-[#F3F1E4] p-4 text-[14px]">
                    {JSON.stringify({ roles: form.roles, data_policies: form.policies }, null, 2)}
                  </pre>
                </>
              )}
              {mode !== "view" && mode !== "delete" && (
                <div className="grid grid-cols-2 gap-6">
                  <fieldset className="grid content-start gap-2">
                    <legend className="text-[16px] font-medium">{t("roles")}</legend>
                    {roleOptions.length === 0 && <p className="text-black/60">{t("noRoles")}</p>}
                    {roleOptions.map((role) => (
                      <label key={role} className="flex items-center gap-2 text-[16px]">
                        <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
                        {role}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="grid content-start gap-2">
                    <legend className="text-[16px] font-medium">{t("dataPolicies")}</legend>
                    {policies.length === 0 && <p className="text-black/60">{t("noDataPolicies")}</p>}
                    {policies.map((policy) => (
                      <label key={policy.policy_mnemonic} className="flex items-center gap-2 text-[16px]">
                        <input
                          type="checkbox"
                          checked={form.policies.includes(policy.policy_mnemonic)}
                          onChange={() => togglePolicy(policy.policy_mnemonic)}
                        />
                        {policy.policy_mnemonic}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" className="rounded-[10px] bg-[#e1e1e1] px-4 py-2" onClick={() => setMode(null)}>{t("cancel")}</button>
                {mode === "delete" && (
                  <button type="button" className="rounded-[10px] bg-red-600 px-4 py-2 text-white" disabled={saving} onClick={deleteUser}>
                    {t("delete")}
                  </button>
                )}
                {mode !== "view" && mode !== "delete" && (
                  <button type="submit" className="rounded-[10px] bg-black px-4 py-2 text-white" disabled={saving}>
                    {saving ? t("saving") : t("save")}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
