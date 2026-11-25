"use client";

import { useTranslations } from "next-intl";
import {
  CheckboxField,
  IconBase64Field,
  InputField,
  Modal,
  TextAreaField,
  Button,
} from "@/components";
interface ApplicationForm {
  application_type: string;
  application_mnemonic: string;
  application_description: string;
  application_url: string;
  is_registry: boolean;
  staff_api_url: string;
  agent_api_url: string;
  order: string;
  width: string;
  icon_base64: string;
  icon_mime_type: string;
}

interface ApplicationModalProps {
  onClose: () => void;
  form: ApplicationForm;
  onChange: (field: keyof ApplicationForm, value: any) => void;
  onSave: (e: React.FormEvent) => Promise<void>;
  saving: boolean;
}

const emptyForm: ApplicationForm = {
  application_type: "staff",
  application_mnemonic: "",
  application_description: "",
  application_url: "",
  is_registry: false,
  staff_api_url: "",
  agent_api_url: "",
  order: "",
  width: "",
  icon_base64: "",
  icon_mime_type: "image/png",
};

export default function ApplicationModal({
  onClose,
  form,
  onChange,
  onSave,
  saving,
}: ApplicationModalProps) {
  const t = useTranslations();
  const isAgent = form.application_type === "agent";

  return (
    <Modal title={isAgent ? t("addAgency") : t("addApplication")} onClose={onClose}>
      <form onSubmit={onSave}>
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label={t("mnemonic")}
            // label={isAgent ? t("agencyId") : t("mnemonic")}
            value={form.application_mnemonic}
            onChange={(value) => onChange("application_mnemonic", value)}
            className="col-span-full"
            required
          />
          <TextAreaField
            label={t("description")}
            // label={isAgent ? t("agencyName") : t("description")}
            value={form.application_description}
            onChange={(value) => onChange("application_description", value)}
            className="col-span-full"
            rows={1}
            required={isAgent}
          />
          {!isAgent && (
            <>
              <InputField
                label={t("url")}
                value={form.application_url}
                onChange={(value) => onChange("application_url", value)}
                className="col-span-full"
              />
              <CheckboxField
                label={t("isRegistry")}
                checked={Boolean(form.is_registry)}
                onChange={(checked) => onChange("is_registry", checked)}
                className="col-span-full"
              />
              <InputField
                label={t("staffApiUrl")}
                value={form.staff_api_url}
                onChange={(value) => onChange("staff_api_url", value)}
                className="col-span-full"
              />
              <InputField
                label={t("agentApiUrl")}
                value={form.agent_api_url}
                onChange={(value) => onChange("agent_api_url", value)}
                className="col-span-full"
              />
              <InputField
                label={t("order")}
                type="number"
                value={form.order}
                onChange={(value) => onChange("order", value)}
              />
              <InputField
                label={t("width")}
                type="number"
                value={form.width}
                onChange={(value) => onChange("width", value)}
              />
              <IconBase64Field
                value={form.icon_base64}
                mimeType={form.icon_mime_type}
                onChange={(base64, mimeType) => {
                  onChange("icon_base64", base64);
                  onChange("icon_mime_type", mimeType);
                }}
                onClear={() => {
                  onChange("icon_base64", "");
                  onChange("icon_mime_type", "image/png");
                }}
              />
            </>
          )}
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { emptyForm };
