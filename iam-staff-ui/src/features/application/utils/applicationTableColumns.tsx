import { Can, DeleteButton, StatusBadge } from "@/components";
import { statusLabel } from "@/shared/utils/statusLabel";

interface Application {
  id: number;
  application_mnemonic: string;
  application_type?: string | null;
  application_description?: string | null;
  application_url?: string | null;
  client_status?: string | null;
  client_error?: string | null;
  group_status?: string | null;
  group_error?: string | null;
  active?: boolean;
  is_self_registered?: boolean;
  order?: number | null;
}

interface ApplicationTableColumnsProps {
  onDelete: (app: Application) => void;
  t: any;
  kind?: "staff" | "agent";
}

export function getApplicationColumns({
  onDelete,
  t,
  kind = "staff",
}: ApplicationTableColumnsProps) {
  const isAgent = kind === "agent";
  return [
    {
      key: "mnemonic",
      header: isAgent ? t("agencyId") : t("mnemonic"),
      render: (app: Application) => app.application_mnemonic,
    },
    {
      key: "description",
      header: isAgent ? t("agencyName") : t("description"),
      render: (app: Application) => app.application_description || "—",
    },
    ...(!isAgent
      ? [
          {
            key: "url",
            header: t("url"),
            render: (app: Application) => app.application_url || "—",
          },
        ]
      : []),
    {
      key: "clientStatus",
      header: t("clientStatus"),
      render: (app: Application) => (
        <span title={app.client_error || undefined}>{statusLabel(t, app.client_status)}</span>
      ),
    },
    ...(isAgent
      ? [
          {
            key: "groupStatus",
            header: t("groupStatus"),
            render: (app: Application) => (
              <span title={app.group_error || undefined}>{statusLabel(t, app.group_status)}</span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: t("status"),
      render: (app: Application) => (
        <StatusBadge
          active={app.active}
          activeLabel={t("active")}
          inactiveLabel={t("inactive")}
        />
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      render: (app: Application) => (
        <Can action="application:delete">
          <DeleteButton
            onClick={() => onDelete(app)}
            disabled={app.is_self_registered}
            title={app.is_self_registered ? t("cannotDeleteSelfRegistered") : t("deleteApplication")}
          >
            {t("delete")}
          </DeleteButton>
        </Can>
      ),
    },
  ];
}
