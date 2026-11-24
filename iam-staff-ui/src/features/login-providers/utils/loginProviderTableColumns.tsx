// import { Can, DeleteButton, StatusBadge } from "@/components";

interface LoginProvider {
  id: number;
  provider_name: string;
  description?: string | null;
  client_id: string;
  application_type?: string | null;
  issuer: string;
  active?: boolean;
  token_endpoint_auth_method?: string;
}

interface LoginProviderTableColumnsProps {
  onDelete: (lp: LoginProvider) => void;
  t: any;
}

export function getLoginProviderColumns({
  onDelete,
  t,
}: LoginProviderTableColumnsProps) {
  return [
    {
      key: "name",
      header: t("name"),
      render: (lp: LoginProvider) => lp.provider_name,
    },
    {
      key: "applicationType",
      header: t("applicationType"),
      render: (lp: LoginProvider) => lp.application_type || "—",
    },
    {
      key: "clientId",
      header: t("clientId"),
      render: (lp: LoginProvider) => lp.client_id,
    },
    {
      key: "issuer",
      header: t("issuer"),
      render: (lp: LoginProvider) => lp.issuer,
    },
    // {
    //   key: "authMethod",
    //   header: t("authMethod"),
    //   render: (lp: LoginProvider) => lp.token_endpoint_auth_method || "—",
    // },
    // Login providers: status column removed.
    // {
    //   key: "status",
    //   header: t("status"),
    //   render: (lp: LoginProvider) => (
    //     <StatusBadge
    //       active={lp.active}
    //       activeLabel={t("active")}
    //       inactiveLabel={t("inactive")}
    //     />
    //   ),
    // },
    // Login providers: delete removed — edit via row click only.
    // {
    //   key: "actions",
    //   header: t("actions"),
    //   render: (lp: LoginProvider) => (
    //     <Can action="loginProvider:delete">
    //       <DeleteButton
    //         onClick={() => onDelete(lp)}
    //         title={t("deleteLoginProvider")}
    //       >
    //         {t("delete")}
    //       </DeleteButton>
    //     </Can>
    //   ),
    // },
  ];
}
