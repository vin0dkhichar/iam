"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "react-toastify";
import { AddButton, ConfirmModal, Card } from "@/components";
import Table from "@/components/Table";
import TableSkeleton from "@/components/TableSkeleton";
import Pagination from "@/components/Pagination";
import { useFetch } from "@/shared/hooks/useFetch";
import { useConfig } from "@/context/ConfigContext";
import { DataPolicyFormModal, CustomDropdown, ViewDataPolicyModal } from "@/features/data-policy/components";
import { getDataPolicyColumns } from "@/features/data-policy/utils/tableColumns";
import { DataPolicy } from "@/features/data-policy/types";
import { DATA_POLICY_ACTIONS } from "@/shared/permissions/actions";
import {
  usePolicies,
  useAllRegister,
  useRegistryApplications,
  type Register,
} from "@/features/data-policy/hooks";

interface DataPoliciesTabProps {
  applicationId: number;
  apiUrl?: string | null;
  isActive?: boolean;
  isAgency?: boolean;
}

const POLICY_TARGETS = [
  { label: 'Register', value: 'REGISTER_RECORD' },
  { label: 'Reference Data', value: 'ATTRIBUTE' },
  { label: 'Administrative Areas', value: 'GEO' },
];

export default function DataPoliciesTab({
  applicationId,
  apiUrl,
  isActive = false,
  isAgency = false,
}: DataPoliciesTabProps) {
  const t = useTranslations();
  const { pageSize } = useConfig();
  const { execute } = useFetch();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlPolicyTarget = searchParams.get('policyTarget') || 'REGISTER_RECORD';
  const urlRegisterId = searchParams.get('registerId') || '';
  const urlRegistryAppId = searchParams.get('registryAppId') || '';

  const [page, setPage] = useState(1);
  const [selectedPolicyTarget, setSelectedPolicyTarget] = useState(urlPolicyTarget);
  const [selectedRegisterId, setSelectedRegisterId] = useState(urlRegisterId);
  const [selectedRegistryAppId, setSelectedRegistryAppId] = useState(urlRegistryAppId);
  const [dpModal, setDpModal] = useState(false);
  const [viewModal, setViewModal] = useState<{ open: boolean; data?: DataPolicy }>({ open: false });
  const wasActive = useRef(false);

  const { registries, loading: registriesLoading } = useRegistryApplications(isAgency);
  const selectedRegistry = useMemo(
    () => registries.find((item) => String(item.id) === String(selectedRegistryAppId)),
    [registries, selectedRegistryAppId],
  );
  // Agency AGC_ builders prefer registry agent_api_url (same shape as staff);
  // fall back to staff_api_url when agent portal is not deployed yet.
  const registerApiUrl = isAgency
    ? selectedRegistry?.agent_api_url || selectedRegistry?.staff_api_url
    : apiUrl;

  // Update URL when selections change
  const updateUrl = (policyTarget: string, registerId: string, registryAppId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (policyTarget) {
      params.set('policyTarget', policyTarget);
    }
    if (isAgency && registryAppId) {
      params.set('registryAppId', registryAppId);
    } else {
      params.delete('registryAppId');
    }
    if (registerId && policyTarget === 'REGISTER_RECORD') {
      params.set('registerId', registerId);
    } else {
      params.delete('registerId');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handlePolicyTargetChange = (value: string) => {
    setSelectedPolicyTarget(value);
    setSelectedRegisterId('');
    updateUrl(value, '', selectedRegistryAppId);
  };

  const handleRegistryChange = (value: string) => {
    setSelectedRegistryAppId(value);
    setSelectedRegisterId('');
    updateUrl(selectedPolicyTarget, '', value);
  };

  const handleRegisterChange = (value: string) => {
    setSelectedRegisterId(value);
    updateUrl(selectedPolicyTarget, value, selectedRegistryAppId);
  };

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title?: string;
    warningText?: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({ open: false, message: "", onConfirm: async () => { } });
  const [confirming, setConfirming] = useState(false);

  const { registers, loading: registersLoading } = useAllRegister(registerApiUrl, 1, 100);
  const firstRegisterId = registers[0]?.register_id ?? '';

  const isRegisterTarget = selectedPolicyTarget === 'REGISTER_RECORD';
  const registryReady = !isAgency || !isRegisterTarget || !!selectedRegistryAppId;
  const canListPolicies =
    registryReady &&
    (selectedPolicyTarget === 'ATTRIBUTE' ||
      selectedPolicyTarget === 'GEO' ||
      !!selectedRegisterId);

  const { policies, pagination, loading, error: policiesError, refresh } = usePolicies(
    selectedRegisterId,
    selectedPolicyTarget,
    applicationId,
    page,
    pageSize || 10,
  );

  useEffect(() => {
    if (!isRegisterTarget || registersLoading || !firstRegisterId) return;
    setSelectedRegisterId((prev) => {
      if (prev && registers.some((register) => register.register_id === prev)) return prev;
      return firstRegisterId;
    });
  }, [isRegisterTarget, registersLoading, firstRegisterId, registers]);

  useEffect(() => {
    if (isActive && !wasActive.current) {
      wasActive.current = true;
    } else if (!isActive && wasActive.current) {
      wasActive.current = false;
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      refresh();
    }
  }, [page, selectedRegisterId, selectedPolicyTarget, isActive, refresh]);

  useEffect(() => {
    if (policiesError) {
      toast.error(typeof policiesError === "string" ? policiesError : "Failed to load data policies");
    }
  }, [policiesError]);

  function openDelete(title: string, warningText: string, onConfirm: () => Promise<void>) {
    setConfirm({ open: true, title, warningText, message: "", onConfirm });
  }

  async function runConfirm() {
    setConfirming(true);
    try {
      await confirm.onConfirm();
      setConfirm((c) => ({ ...c, open: false }));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Delete failed";
      toast.error(errorMessage);
    } finally {
      setConfirming(false);
    }
  }

  async function handleDeleteDataPolicy(dp: DataPolicy) {
    openDelete(
      t("deleteDataPolicy"),
      t("deleteWillRemoveAllData"),
      async () => {
        const res = await execute("/api/applications/data-policies/remove", {
          method: "POST",
          body: JSON.stringify({
            policy_id: dp.policy_id,
          }),
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Data policy deleted successfully");
        refresh();
      },
    );
  }

  function handleViewDataPolicy(dp: DataPolicy) {
    setViewModal({ open: true, data: dp });
  }

  const registerOptions = useMemo(
    () =>
      (registers || []).map((register: Register) => ({
        label: register.register_mnemonic || register.register_id,
        value: register.register_id,
      })),
    [registers],
  );

  const total = pagination?.number_of_items || policies.length;
  const columns = getDataPolicyColumns(handleDeleteDataPolicy, handleViewDataPolicy, t);

  return (
    <>
      <Card padding="none" className="pb-6">
        <div className="flex items-center justify-between gap-4 mb-0 px-9 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="m-0 text-[20px] font-medium text-black">
              {isAgency ? t("tabAgencyDataPolicies") : t("tabDataPolicies")}
            </h2>
            {/* <h2 className="m-0 text-[20px] font-medium text-black">Data Policies</h2> */}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <CustomDropdown
                options={POLICY_TARGETS}
                value={selectedPolicyTarget}
                onChange={handlePolicyTargetChange}
                placeholder="Select Policy Type"
              />
            </div>
            {isAgency && isRegisterTarget && (
              <div className="w-56">
                <CustomDropdown
                  options={registries.map((item) => ({
                    label: item.application_description || item.application_mnemonic,
                    value: String(item.id),
                  }))}
                  value={selectedRegistryAppId}
                  onChange={handleRegistryChange}
                  loading={registriesLoading}
                  placeholder="Select registry"
                />
              </div>
            )}
            {isRegisterTarget && (
              <>
                <span className="text-[20px] font-medium text-black">
                  Target:
                </span>
                <div className="w-48">
                  <CustomDropdown
                    options={registerOptions}
                    value={selectedRegisterId}
                    onChange={handleRegisterChange}
                    loading={registersLoading}
                    placeholder="Select register"
                    disabled={isAgency && !selectedRegistryAppId}
                  />
                </div>
              </>
            )}
            <AddButton
              onClick={() => {
                const section = pathname.includes("/agencies/") ? "agencies" : "applications";
                const registryQuery =
                  isAgency && selectedRegistryAppId
                    ? `&registryAppId=${selectedRegistryAppId}`
                    : "";
                router.push(
                  `/${section}/${applicationId}/data-policies/create?policyTarget=${selectedPolicyTarget}${selectedRegisterId ? `&registerId=${selectedRegisterId}` : ""}${registryQuery}`,
                );
              }}
              disabled={!canListPolicies}
            />
          </div>
        </div>
        {/* DP_/AGC_ prefix hint shown only on the add/create policy page, not this list. */}
        {/* <p className="px-9 pb-2 m-0 text-[14px] text-gray-600">
          {isAgency ? t("agcPrefixHint") : t("dpPrefixHint")}
        </p> */}

        {!canListPolicies ? (
          <div className="px-9 text-sm text-gray-500 text-center py-8">
            {isAgency && isRegisterTarget && !selectedRegistryAppId
              ? "Select a registry to view policies"
              : isRegisterTarget
                ? "Select a register to view policies"
                : "Loading..."}
          </div>
        ) : (
          <>
            {loading ? (
              <TableSkeleton
                rows={pageSize || 10}
                headers={columns.map(col => col.header)}
              />
            ) : (
              <Table
                columns={columns}
                data={policies}
                emptyMessage="No data policies found"
              />
            )}

            {!loading && policies.length > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize || 10}
                total={total}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {dpModal && (
        <DataPolicyFormModal
          applicationId={applicationId}
          apiUrl={registerApiUrl}
          policyTarget={selectedPolicyTarget}
          registerId={selectedRegisterId}
          onClose={() => setDpModal(false)}
          onSuccess={() => {
            setDpModal(false);
            refresh();
          }}
        />
      )}

      {confirm.open && (
        <ConfirmModal
          title={confirm.title}
          warningText={confirm.warningText}
          confirming={confirming}
          onConfirm={runConfirm}
          onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
        />
      )}

      {viewModal.open && (
        <ViewDataPolicyModal
          data={viewModal.data}
          onClose={() => setViewModal({ open: false })}
        />
      )}
    </>
  );
}
