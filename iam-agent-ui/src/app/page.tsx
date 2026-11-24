"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/Auth";
import Pagination from "@/components/Pagination";
import { CustomDropdown, ViewDataPolicyModal } from "@/features/data-policy/components";
import { useAgency } from "@/features/data-policy/hooks/useAgency";
import { useAllRegister, type Register } from "@/features/data-policy/hooks/useAllRegister";

const POLICY_TARGETS = [
  { label: "Register", value: "REGISTER_RECORD" },
  { label: "Reference Data", value: "ATTRIBUTE" },
  { label: "Administrative Areas", value: "GEO" },
];

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

// type AgencyRole = {
//   role_mnemonic: string;
//   sync_status?: string | null;
// };

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
  // roles: [] as string[],
  policies: [] as string[],
};

function isPolicyRole(role: string) {
  // return role.startsWith("AGC_") || role.startsWith("DP_");
  return role.startsWith("AGC_") || role.startsWith("AGT_") || role.startsWith("DP_");
}

function isAgencyAdminRole(role: string) {
  return role === "AGENCY_ADMIN";
}

function StaffTable({
  columns,
  rows,
  empty,
  footer,
  onRowClick,
}: {
  columns: string[];
  rows: { key: string; cells: ReactNode[]; onClick?: () => void }[];
  empty: string;
  footer?: ReactNode;
  onRowClick?: (key: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] bg-white pb-6 pt-6 shadow-[0_1px_2px_rgba(6,19,39,0.05)]">
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
              <tr
                key={row.key}
                className={`${index % 2 === 1 ? "bg-white" : "bg-gray-50"}${row.onClick || onRowClick ? " cursor-pointer hover:bg-[#F3F1E4]" : ""}`}
                onClick={() => (row.onClick ? row.onClick() : onRowClick?.(row.key))}
              >
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
      {footer}
    </div>
  );
}

function statusLabel(t: (key: string) => string, value?: string | null) {
  if (!value) return "—";
  const key = `status_${value.toLowerCase()}`;
  const known = ["status_pending", "status_syncing", "status_synced", "status_failed"];
  return known.includes(key) ? t(key) : value;
}

const PAGE_SIZE = 10;

export default function UsersPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setDenied } = useAuth();
  const menu = searchParams.get("menu") || "users";
  const [users, setUsers] = useState<AgentUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // const [roleOptions, setRoleOptions] = useState<string[]>([]);
  // const [roles, setRoles] = useState<AgencyRole[]>([]);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<AgentUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState<AgencyPolicy[]>([]);
  const [viewPolicy, setViewPolicy] = useState<AgencyPolicy | null>(null);
  const [policyTarget, setPolicyTarget] = useState(
    searchParams.get("policyTarget") || "REGISTER_RECORD",
  );
  const [registerId, setRegisterId] = useState(searchParams.get("registerId") || "");
  const { apiUrl: agencyApiUrl } = useAgency();
  const { registers, loading: registersLoading } = useAllRegister(agencyApiUrl, 1, 100);

  const agencyPolicies = useMemo(
    () => policies.filter((policy) => policy.policy_mnemonic.startsWith("AGC_")),
    [policies],
  );
  const agentPolicies = useMemo(() => {
    return policies.filter((policy) => {
      if (!policy.policy_mnemonic.startsWith("AGT_")) return false;
      if (policy.policy_target !== policyTarget) return false;
      if (policyTarget === "REGISTER_RECORD") {
        return !registerId || policy.register_id === registerId;
      }
      return true;
    });
  }, [policies, policyTarget, registerId]);
  // AGC_ applied by default on the API — only AGT_ is assignable in add/edit.
  const assignablePolicies = useMemo(
    () => policies.filter((policy) => policy.policy_mnemonic.startsWith("AGT_")),
    [policies],
  );
  const registerOptions = useMemo(
    () =>
      (registers || []).map((register: Register) => ({
        label: register.register_mnemonic || register.register_id,
        value: register.register_id,
      })),
    [registers],
  );
  const isRegisterTarget = policyTarget === "REGISTER_RECORD";
  const canListAgentPolicies =
    policyTarget === "ATTRIBUTE" || policyTarget === "GEO" || !!registerId;

  useEffect(() => {
    if (!isRegisterTarget || registersLoading || !registers.length) return;
    setRegisterId((prev) => {
      if (prev && registers.some((register: Register) => register.register_id === prev)) {
        return prev;
      }
      return registers[0]?.register_id || "";
    });
  }, [isRegisterTarget, registersLoading, registers]);

  function updatePolicyFilters(nextTarget: string, nextRegisterId: string) {
    setPolicyTarget(nextTarget);
    setRegisterId(nextRegisterId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("menu", "agent-data-policies");
    params.set("policyTarget", nextTarget);
    if (nextTarget === "REGISTER_RECORD" && nextRegisterId) {
      params.set("registerId", nextRegisterId);
    } else {
      params.delete("registerId");
    }
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  async function loadUsers(nextPage = page) {
    const usersResponse = await fetch(
      `/api/users?current_page=${nextPage}&page_size=${PAGE_SIZE}`,
    );
    const usersData = await usersResponse.json();
    if (usersResponse.status === 403) {
      setDenied(true);
      return false;
    }
    if (!usersResponse.ok) {
      const message = errorMessage(usersData, t("loadFailed"), t("notAdmin"));
      setError(message);
      toast.error(message);
      return false;
    }
    setUsers(usersData.users || []);
    setTotal(usersData.pagination?.number_of_items ?? 0);
    setPage(nextPage);
    return true;
  }

  async function load() {
    // Roles load commented — roles menu removed.
    // const [usersOk, rolesResponse, policiesResponse] = await Promise.all([
    const [usersOk, policiesResponse] = await Promise.all([
      loadUsers(page),
      // fetch("/api/users/roles"),
      fetch("/api/users/data-policies"),
    ]);
    // const rolesData = await rolesResponse.json();
    const policiesData = await policiesResponse.json();
    // const forbidden = [rolesResponse, policiesResponse].some((response) => response.status === 403);
    const forbidden = policiesResponse.status === 403;
    if (!usersOk || forbidden) {
      if (forbidden) setDenied(true);
      return;
    }
    // if (!rolesResponse.ok) toast.error(errorMessage(rolesData, t("loadFailed"), t("notAdmin")));
    if (!policiesResponse.ok) toast.error(errorMessage(policiesData, t("loadFailed"), t("notAdmin")));
    setError("");
    // const nextRoles: AgencyRole[] = Array.isArray(rolesData.roles)
    //   ? rolesData.roles.map((role: string | AgencyRole) =>
    //       typeof role === "string" ? { role_mnemonic: role, sync_status: null } : role,
    //     )
    //   : [];
    // setRoles(nextRoles);
    // setRoleOptions(nextRoles.map((role) => role.role_mnemonic));
    setPolicies(Array.isArray(policiesData.policies) ? policiesData.policies : []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setMode(null);
    setViewPolicy(null);
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
      // roles: assigned.filter((role) => !isPolicyRole(role) && !isAgencyAdminRole(role)),
      // AGC_ inherited automatically — only AGT_ shown/edited in the form.
      policies: assigned.filter((role) => role.startsWith("AGT_")),
      // policies: assigned.filter(isPolicyRole),
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

  // function toggleRole(role: string) {
  //   setForm((current) => ({
  //     ...current,
  //     roles: current.roles.includes(role)
  //       ? current.roles.filter((item) => item !== item)
  //       : [...current.roles, role],
  //   }));
  // }

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
                // roles: [...form.roles, ...form.policies],
                roles: [...form.policies],
              }),
            })
          : await fetch("/api/users/roles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: selected?.id,
                // roles: [...form.roles, ...form.policies],
                roles: [...form.policies],
              }),
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
      await loadUsers(mode === "add" ? 1 : page);
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
      const nextPage = users.length <= 1 && page > 1 ? page - 1 : page;
      await loadUsers(nextPage);
    } finally {
      setSaving(false);
    }
  }

  async function removeAgentPolicy(policy: AgencyPolicy) {
    const response = await fetch("/api/users/data-policies/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy_id: policy.policy_id }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(errorMessage(data, t("deleteFailed"), t("notAdmin")));
      return;
    }
    toast.success(t("policyDeleted"));
    await load();
  }

  const fieldClass = "w-full rounded-[10px] border border-(--color-grey) px-3 py-2 text-[16px] disabled:bg-(--color-light-grey)";

  const pageTitle =
    menu === "agency-data-policies"
      ? t("navAgencyDataPolicies")
      : menu === "agent-data-policies"
        ? t("navAgentDataPolicies")
        // : menu === "roles"
        //   ? t("navRoles")
        //   : menu === "data-policies"
        //     ? t("navDataPolicies")
        : t("title");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold text-black">{pageTitle}</h1>
        {menu === "users" && (
          <button
            type="button"
            className="rounded-[10px] bg-(--color-accent) px-4 py-2 text-[16px] font-medium text-black transition-colors duration-150 hover:bg-(--color-accent-hover)"
            onClick={openAdd}
          >
            {t("add")}
          </button>
        )}
        {menu === "agent-data-policies" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <CustomDropdown
                options={POLICY_TARGETS}
                value={policyTarget}
                onChange={(value) => updatePolicyFilters(value, "")}
                placeholder="Select Policy Type"
              />
            </div>
            {isRegisterTarget && (
              <div className="w-48">
                <CustomDropdown
                  options={registerOptions}
                  value={registerId}
                  onChange={(value) => updatePolicyFilters(policyTarget, value)}
                  loading={registersLoading}
                  placeholder={t("select_register")}
                />
              </div>
            )}
            <button
              type="button"
              className="rounded-[10px] bg-(--color-accent) px-4 py-2 text-[16px] font-medium text-black transition-colors duration-150 hover:bg-(--color-accent-hover) disabled:opacity-50"
              disabled={!canListAgentPolicies}
              onClick={() =>
                router.push(
                  `/data-policies/create?policyTarget=${policyTarget}${
                    registerId ? `&registerId=${registerId}` : ""
                  }`,
                )
              }
            >
              {t("add")}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-[10px] bg-red-50 px-4 py-3 text-red-700">
          {error}
        </p>
      )}

      {/* Roles menu commented out.
      {menu === "roles" && (
        <StaffTable
          columns={[t("role"), t("status")]}
          empty={t("noRoles")}
          rows={roles.map((role) => ({
            key: role.role_mnemonic,
            cells: [role.role_mnemonic, statusLabel(t, role.sync_status)],
          }))}
        />
      )}
      */}

      {/* Combined data-policies menu replaced by agency / agent split.
      {menu === "data-policies" && (...)}
      */}

      {menu === "agency-data-policies" && (
        <>
          {/* <p className="mb-4 text-[14px] text-gray-600">{t("agcReadOnlyHint")}</p> */}
          <StaffTable
            columns={[t("name"), t("policyTarget"), t("policyType"), t("keycloakClientStatus")]}
            empty={t("noAgencyDataPolicies")}
            rows={agencyPolicies.map((policy) => ({
              key: policy.policy_id || policy.policy_mnemonic + policy.policy_target,
              onClick: () => setViewPolicy(policy),
              cells: [
                policy.policy_mnemonic,
                policy.policy_target,
                policy.policy_type,
                statusLabel(t, policy.sync_status),
                // View button removed — row click opens view.
                // <button ...>{t("view")}</button>,
              ],
            }))}
          />
        </>
      )}

      {menu === "agent-data-policies" && (
        <>
          {!canListAgentPolicies ? (
            <p className="rounded-[10px] bg-white px-9 py-8 text-center text-[16px] text-gray-500">
              {t("select_register_for_filter_fields")}
            </p>
          ) : (
            <StaffTable
              columns={[t("name"), t("policyTarget"), t("policyType"), t("keycloakClientStatus"), t("actions")]}
              empty={t("noAgentDataPolicies")}
              rows={agentPolicies.map((policy) => ({
                key: policy.policy_id || policy.policy_mnemonic + policy.policy_target,
                onClick: () => setViewPolicy(policy),
                cells: [
                  policy.policy_mnemonic,
                  policy.policy_target,
                  policy.policy_type,
                  statusLabel(t, policy.sync_status),
                  <button
                    key="delete"
                    type="button"
                    className="rounded-[10px] bg-[rgba(192,57,43,0.1)] px-4 py-2 text-[16px] font-medium text-[#c0392b]"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeAgentPolicy(policy);
                    }}
                  >
                    {t("delete")}
                  </button>,
                ],
              }))}
            />
          )}
        </>
      )}

      {menu === "users" && (
        <StaffTable
          columns={[t("name"), t("email"), t("keycloakUserStatus"), t("actions")]}
          empty={t("noUsers")}
          rows={users.map((user) => ({
            key: user.id,
            onClick: () => openUser("view", user),
            cells: [
              `${user.first_name} ${user.last_name}`,
              user.email,
              statusLabel(t, user.sync_status),
              <div key="actions" className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                {/* View button removed — row click opens view.
                <button type="button" className="rounded-[10px] bg-[#e1e1e1] px-4 py-2 text-[16px] font-medium text-black/50" onClick={() => openUser("view", user)}>{t("view")}</button>
                */}
                <button type="button" className="rounded-[10px] bg-black px-4 py-2 text-[16px] font-medium text-white" onClick={() => openUser("edit", user)}>{t("edit")}</button>
                <button type="button" className="rounded-[10px] bg-[rgba(192,57,43,0.1)] px-4 py-2 text-[16px] font-medium text-[#c0392b]" onClick={() => openUser("delete", user)}>{t("delete")}</button>
              </div>,
            ],
          }))}
          footer={
            users.length > 0 ? (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={(next) => loadUsers(next)}
              />
            ) : null
          }
        />
      )}

      {viewPolicy && (
        <ViewDataPolicyModal data={viewPolicy} onClose={() => setViewPolicy(null)} />
      )}

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMode(null)}>
          <div
            className="max-h-[80vh] w-full max-w-150 overflow-y-auto rounded-[10px] border-4 border-[#EABB13] bg-white p-8 shadow-lg"
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
                  <div className="grid gap-4">
                    <div>
                      <p className="mb-2 text-[16px] font-medium">{t("navAgencyDataPolicies")}</p>
                      <pre className="overflow-auto rounded-[10px] bg-[#F3F1E4] p-4 text-[14px]">
                        {JSON.stringify(
                          (selected?.roles || []).filter((role) => role.startsWith("AGC_")),
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-2 text-[16px] font-medium">{t("navAgentDataPolicies")}</p>
                      <pre className="overflow-auto rounded-[10px] bg-[#F3F1E4] p-4 text-[14px]">
                        {JSON.stringify(form.policies, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              )}
              {mode !== "view" && mode !== "delete" && (
                <div className="grid gap-6">
                  {/* Roles removed from agent add/edit.
                  <fieldset className="grid content-start gap-2">
                    <legend className="text-[16px] font-medium">{t("roles")}</legend>
                    ...
                  </fieldset>
                  */}
                  <fieldset className="grid content-start gap-2">
                    <legend className="text-[16px] font-medium">{t("navAgentDataPolicies")}</legend>
                    {assignablePolicies.length === 0 && <p className="text-black/60">{t("noAgentDataPolicies")}</p>}
                    {assignablePolicies.map((policy) => (
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
