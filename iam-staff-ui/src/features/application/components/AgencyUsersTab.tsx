"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  AddButton,
  Button,
  Can,
  Card,
  FormActions,
  InputField,
  Modal,
  Pagination,
  Table,
} from "@/components";
import { useConfig } from "@/context/ConfigContext";
import { USER_ACTIONS } from "@/shared/permissions/actions";
import { statusLabel } from "@/shared/utils/statusLabel";

interface AgencyUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  sync_status: string;
}

export default function AgencyUsersTab({ agencyId }: { agencyId: string }) {
  const t = useTranslations();
  const { pageSize } = useConfig();
  const [items, setItems] = useState<AgencyUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminForm, setAdminForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const response = await fetch("/api/users/agency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agency_id: agencyId,
            current_page: p,
            page_size: pageSize || 10,
          }),
        });
        const data = await response.json();
        if (data?.error) {
          toast.error(data.error);
          setItems([]);
          setTotal(0);
          return;
        }
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        setItems(nextItems);
        setTotal(data?.pagination?.number_of_items ?? nextItems.length);
        setPage(p);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load users");
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setLoadedOnce(true);
      }
    },
    [agencyId, pageSize],
  );

  useEffect(() => {
    setPage(1);
    setLoadedOnce(false);
    load(1);
  }, [agencyId, load]);

  return (
    <>
      <Card padding="none" className="pb-6">
        <div className="flex items-center justify-between gap-4 mb-0 px-9 pt-6 pb-4">
          <h2 className="m-0 text-[20px] font-medium text-black">{t("tabAgencyAdmins")}</h2>
          {/* <h2 className="m-0 text-[20px] font-medium text-black">{t("tabUsers")}</h2> */}

          {!(loading && !loadedOnce) && (
            <Can action={USER_ACTIONS.create}>
              <AddButton onClick={() => setAdminOpen(true)} />
            </Can>
          )}
          {loading && !loadedOnce && (
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
          )}
        </div>
        <Table
          columns={[
            { key: "email", header: t("email"), render: (user: AgencyUser) => user.email },
            { key: "first", header: t("firstName"), render: (user: AgencyUser) => user.first_name },
            { key: "last", header: t("lastName"), render: (user: AgencyUser) => user.last_name },
            {
              key: "status",
              header: t("keycloakUserStatus"),
              // header: t("status"),
              render: (user: AgencyUser) => statusLabel(t, user.sync_status),
            },
          ]}
          data={loading ? [] : items}
          emptyMessage={loading ? t("loading") : t("noData")}
        />
        {!loading && items.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize || 10}
            total={total}
            onPageChange={(next) => load(next)}
          />
        )}
      </Card>

      {adminOpen && (
        <Modal title={t("addAdmin")} onClose={() => setAdminOpen(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setAdminSaving(true);
              try {
                const response = await fetch("/api/users/create-agency-admin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    agency_id: agencyId,
                    ...adminForm,
                  }),
                });
                const data = await response.json();
                if (!response.ok) {
                  toast.error(data.detail || data.error || "Failed to add admin");
                  return;
                }
                setAdminOpen(false);
                setAdminForm({ first_name: "", last_name: "", email: "" });
                await load(page);
                toast.success(t("adminCreated"));
              } finally {
                setAdminSaving(false);
              }
            }}
          >
            <div className="grid gap-4">
              <InputField
                label={t("firstName")}
                value={adminForm.first_name}
                onChange={(value) => setAdminForm((form) => ({ ...form, first_name: value }))}
                required
              />
              <InputField
                label={t("lastName")}
                value={adminForm.last_name}
                onChange={(value) => setAdminForm((form) => ({ ...form, last_name: value }))}
                required
              />
              <InputField
                label={t("email")}
                type="email"
                value={adminForm.email}
                onChange={(value) => setAdminForm((form) => ({ ...form, email: value }))}
                required
              />
            </div>
            <FormActions>
              <Button type="button" onClick={() => setAdminOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={adminSaving}>
                {adminSaving ? t("saving") : t("save")}
              </Button>
            </FormActions>
          </form>
        </Modal>
      )}
    </>
  );
}
