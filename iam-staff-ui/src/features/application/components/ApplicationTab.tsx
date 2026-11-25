"use client";

import { useTranslations } from "next-intl";
import { useRbac } from "@/context/RbacContext";
import {
  Button,
  Card,
  CheckboxField,
  FormActions,
  IconBase64Field,
  InputField,
  TextAreaField,
} from "@/components";
import { Application, ApplicationForm } from "@/features/application/types";
import { statusLabel } from "@/shared/utils/statusLabel";

interface ApplicationTabProps {
  app: Application;
  appForm: ApplicationForm;
  saving: boolean;
  setAppForm: (form: any) => void;
  saveApplication: (e: React.FormEvent) => Promise<void>;
}

export default function ApplicationTab({
  app,
  appForm,
  saving,
  setAppForm,
  saveApplication,
}: ApplicationTabProps) {
  const t = useTranslations();
  const { can } = useRbac();
  const isSelfRegistered = app.is_self_registered ?? false;
  const isAgent = app.application_type === "agent";
  const isDisabled = isSelfRegistered || !can("application:edit") || saving;

  return (
    <Card>
      <form onSubmit={saveApplication}>
        <div className="grid grid-cols-2 gap-4">
          {isAgent ? (
            <>
              <InputField
                label={t("mnemonic")}
                // label={t("agencyId")}
                value={app.application_mnemonic}
                onChange={() => {}}
                disabled
              />
              <InputField
                label={t("description")}
                // label={t("agencyName")}
                value={appForm.application_description}
                onChange={(value) =>
                  setAppForm((f: typeof appForm) => ({
                    ...f,
                    application_description: value,
                  }))
                }
                disabled={isDisabled}
              />
              <InputField
                label={t("clientStatus")}
                value={statusLabel(t, app.client_status)}
                onChange={() => {}}
                disabled
              />
              <InputField
                label={t("groupStatus")}
                value={statusLabel(t, app.group_status)}
                onChange={() => {}}
                disabled
              />
            </>
          ) : (
            <>
          <InputField
            label={t("mnemonic")}
            value={app.application_mnemonic}
            onChange={() => {}}
            disabled
          />

          <InputField
            label={t("selfRegistered")}
            value={isSelfRegistered ? t("yes") : t("no")}
            onChange={() => {}}
            disabled
          />

          <InputField
            label={t("clientStatus")}
            value={statusLabel(t, app.client_status)}
            onChange={() => {}}
            disabled
          />

          <TextAreaField
            label={t("description")}
            value={appForm.application_description}
            onChange={(value) =>
              setAppForm((f: typeof appForm) => ({
                ...f,
                application_description: value,
              }))
            }
            disabled={isDisabled}
            rows={1}
            className="col-span-full"
          />

          {!isAgent && (
          <>
          <InputField
            label={t("url")}
            value={appForm.application_url}
            onChange={(value) =>
              setAppForm((f: typeof appForm) => ({
                ...f,
                application_url: value,
              }))
            }
            disabled={isDisabled}
            className="col-span-full"
          />

          <CheckboxField
            label={t("isRegistry")}
            checked={Boolean(appForm.is_registry)}
            onChange={(checked) =>
              setAppForm((f: typeof appForm) => ({
                ...f,
                is_registry: checked,
              }))
            }
            disabled={isDisabled}
            className="col-span-full"
          />

          <InputField
            label={t("staffApiUrl")}
            value={appForm.staff_api_url}
            onChange={(value) =>
              setAppForm((f: typeof appForm) => ({
                ...f,
                staff_api_url: value,
              }))
            }
            disabled={isDisabled}
            className="col-span-full"
          />

          <InputField
            label={t("agentApiUrl")}
            value={appForm.agent_api_url}
            onChange={(value) =>
              setAppForm((f: typeof appForm) => ({
                ...f,
                agent_api_url: value,
              }))
            }
            disabled={isDisabled}
            className="col-span-full"
          />

          <InputField
            label="Order"
            type="number"
            value={appForm.order}
            onChange={(value) =>
              setAppForm((f: typeof appForm) => ({ ...f, order: value }))
            }
            disabled={isDisabled}
          />

          <InputField
            label="Width"
            type="number"
            value={appForm.width}
            onChange={(value) =>
              setAppForm((f: typeof appForm) => ({ ...f, width: value }))
            }
            disabled={isDisabled}
          />

          {/* Icon: preview only — Change icon hidden for staff applications. */}
          <div className="col-span-full">
            <IconBase64Field
              value={appForm.icon_base64}
              mimeType={appForm.icon_mime_type}
              readOnly
              onChange={() => {}}
              // disabled={isDisabled}
              // onChange={(base64, mimeType) =>
              //   setAppForm((f: typeof appForm) => ({
              //     ...f,
              //     icon_base64: base64,
              //     icon_mime_type: mimeType,
              //   }))
              // }
              // onClear={() =>
              //   setAppForm((f: typeof appForm) => ({
              //     ...f,
              //     icon_base64: "",
              //     icon_mime_type: "image/png",
              //   }))
              // }
            />
          </div>
          </>
          )}
            </>
          )}
        </div>
        {!isSelfRegistered && (
          <FormActions>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </FormActions>
        )}
      </form>
    </Card>
  );
}
