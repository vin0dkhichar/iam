"use client";

import { useTranslations } from "next-intl";
import Modal from "@/components/Modal";
import { DataPolicy } from "../types";

interface ViewDataPolicyModalProps {
  onClose: () => void;
  data?: DataPolicy | null;
}

export default function ViewDataPolicyModal({ onClose, data }: ViewDataPolicyModalProps) {
  const t = useTranslations();

  if (!data) return null;

  const policyTargetLabel =
    data.policy_target === "REGISTER_RECORD"
      ? "Register Record"
      : data.policy_target === "ATTRIBUTE"
        ? "Reference Data"
        : data.policy_target === "GEO"
          ? "Administrative Areas"
          : data.policy_target || "—";

  return (
    <Modal title={t("viewPolicy")} onClose={onClose} width="800">
      <div className="space-y-4">
        <div className="grid grid-cols-[1.2fr_2fr] gap-4 py-2">
          <span className="text-[16px] font-medium text-gray-500">{t("policyMnemonic")}</span>
          <div className="break-all text-[16px] text-gray-900">{data.policy_mnemonic || "—"}</div>
        </div>

        <div className="py-2">
          <span className="mb-2 block text-[16px] font-medium text-gray-500">
            {t("policyDescription")}
          </span>
          <div className="break-all rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-2 text-[16px] text-gray-900">
            {data.policy_description || "—"}
          </div>
        </div>

        <div className="grid grid-cols-[1.2fr_2fr] gap-4 py-2">
          <span className="text-[16px] font-medium text-gray-500">{t("policyTarget")}</span>
          <div className="break-all text-[16px] text-gray-900">{policyTargetLabel}</div>
        </div>

        <div className="grid grid-cols-[1.2fr_2fr] gap-4 py-2">
          <span className="text-[16px] font-medium text-gray-500">{t("policyType")}</span>
          <div className="break-all text-[16px] text-gray-900">{data.policy_type || "—"}</div>
        </div>

        <div className="grid grid-cols-[1.2fr_2fr] gap-4 py-2">
          <span className="text-[16px] font-medium text-gray-500">{t("policyId")}</span>
          <div className="break-all text-[16px] text-gray-900">{data.policy_id || "—"}</div>
        </div>

        {data.register_id ? (
          <div className="grid grid-cols-[1.2fr_2fr] gap-4 py-2">
            <span className="text-[16px] font-medium text-gray-500">{t("registerId")}</span>
            <div className="break-all text-[16px] text-gray-900">{data.register_id}</div>
          </div>
        ) : null}

        <div className="py-2">
          <span className="mb-2 block text-[16px] font-medium text-gray-500">{t("policyFilter")}</span>
          <div className="break-all rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-2 font-mono text-[14px] text-gray-900">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(data.policy_filter_expression ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  );
}
