"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useFetch } from "@/shared/hooks/useFetch";
import { withCsrfHeaders } from "@/shared/utils/csrf";
import { toast } from "react-toastify";
import {
  AddButton,
  Can,
  // ConfirmModal,
  ErrorAlert,
  Pagination,
  Table,
  TableSkeleton,
} from "@/components";
import ApplicationModal, {
  emptyForm as emptyApplicationForm,
} from "./ApplicationModal";
import { getApplicationColumns } from "@/features/application/utils/applicationTableColumns";
import { useConfig } from "@/context/ConfigContext";

const emptyForm = emptyApplicationForm;

interface Application {
  id: number;
  application_mnemonic: string;
  application_type?: string | null;
  application_description?: string | null;
  application_url?: string | null;
  active?: boolean;
  is_self_registered?: boolean;
  order?: number | null;
}

interface ListResponse {
  items?: Application[];
  pagination?: {
    current_page?: number;
    page_size?: number;
    number_of_items?: number;
  };
  error?: string;
}

export default function ApplicationsPageClient({
  kind = "staff",
}: {
  kind?: "staff" | "agent";
}) {
  const isAgent = kind === "agent";
  const t = useTranslations();
  const { pageSize } = useConfig();
  const router = useRouter();
  const { execute } = useFetch<ListResponse>();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  // const [itemToDelete, setItemToDelete] = useState<Application | null>(null);
  // const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(
    async (p: number) => {
      const seq = ++loadSeq.current;
      setLoading(true);
      setError(null);
      try {
        const data = await execute("/api/applications", {
          method: "POST",
          body: JSON.stringify({
            current_page: p,
            page_size: pageSize,
            request_payload: { application_type: kind },
          }),
        });
        if (seq !== loadSeq.current) return;

        if (data == null) {
          setItems([]);
          setTotal(0);
          return;
        }

        if (data?.error) {
          setError(data.error);
          toast.error(data.error);
          setItems([]);
          setTotal(0);
          return;
        }
        const list = Array.isArray(data?.items)
          ? data!.items!
          : Array.isArray(data)
            ? (data as unknown as Application[])
            : [];
        setItems(list);
        setTotal(data?.pagination?.number_of_items ?? list.length);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        const errorMessage = e instanceof Error ? e.message : "Failed to load";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setLoadedOnce(true);
        }
      }
    },
    [execute, pageSize, kind],
  );

  useEffect(() => {
    load(page);
  }, [page]);


  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // Staff Applications create disabled — only agencies create from this page.
    if (!isAgent) return;
    setSaving(true);
    setError(null);
    try {
      // Agencies use POST /agencies (not /applications/create_application).
      const response = await fetch("/api/agencies", {
        method: "POST",
        headers: withCsrfHeaders("POST", { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          agency_id: form.application_mnemonic.trim(),
          name: form.application_description.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          data?.detail || data?.error || data?.errors?.[0]?.message || "Create failed";
        setError(message);
        toast.error(message);
        return;
      }
      // Previously (staff applications create via create_application):
      // const payload: Record<string, unknown> = {
      //   application_mnemonic: form.application_mnemonic.trim(),
      //   application_type: form.application_type || "staff",
      //   application_description: form.application_description || null,
      //   ...
      // };
      // const res = await execute("/api/applications/create", { ... });
      setModalOpen(false);
      setForm({ ...emptyForm, application_type: kind });
      toast.success(t("agencyCreated"));
      await load(page);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Create failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  // async function handleDelete() {
  //   if (!itemToDelete) return;
  //   setDeleting(true);
  //   setError(null);
  //   try {
  //     const res = await execute("/api/applications/delete", {
  //       method: "POST",
  //       body: JSON.stringify({ id: itemToDelete.id }),
  //     });
  //     if (res?.error) {
  //       setError(res.error);
  //       toast.error(res.error);
  //       return;
  //     }
  //     setDeleteModalOpen(false);
  //     setItemToDelete(null);
  //     await load(page);
  //     toast.success(isAgent ? t("agencyDeleted") : t("applicationDeleted"));
  //   } catch (err) {
  //     const errorMessage = err instanceof Error ? err.message : "Delete failed";
  //     setError(errorMessage);
  //     toast.error(errorMessage);
  //   } finally {
  //     setDeleting(false);
  //   }
  // }

  // function openDeleteModal(item: Application) {
  //   setItemToDelete(item);
  //   setDeleteModalOpen(true);
  // }

  async function handleToggleActive(app: Application) {
    if (togglingId != null) return;
    setTogglingId(app.id);
    setError(null);
    try {
      // Agency soft-delete: flip active only via /agencies/set_active (no Keycloak).
      const response = await fetch("/api/agencies/set-active", {
        method: "POST",
        headers: withCsrfHeaders("POST", { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ id: app.id, active: app.active === false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          data?.detail || data?.error || data?.errors?.[0]?.message || "Status update failed";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(t("agencyStatusUpdated"));
      await load(page);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Status update failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setTogglingId(null);
    }
  }

  const skeletonHeaders = isAgent
    ? [t("mnemonic"), t("description"), t("clientStatus"), t("groupStatus"), t("status")]
    : [t("mnemonic"), t("description"), t("url"), t("clientStatus")];
    // staff previously: [t("mnemonic"), t("description"), t("url"), t("clientStatus"), t("status"), t("actions")]

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-semibold text-[24px] text-black">{isAgent ? t("agencies") : t("applications")}</h1>
        {/* Staff Applications: add button removed from list view. Agencies keep create. */}
        {isAgent ? (
          <Can action="application:create">
            <AddButton onClick={() => { setForm({ ...emptyForm, application_type: kind }); setModalOpen(true); }} />
          </Can>
        ) : (
          // <Can action="application:create">
          //   <AddButton onClick={() => { setForm({ ...emptyForm, application_type: kind }); setModalOpen(true); }} />
          // </Can>
          null
        )}
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="bg-white rounded-[10px] py-6 shadow-sm">
        {loading || !loadedOnce ? (
          <TableSkeleton rows={pageSize} headers={skeletonHeaders} />
        ) : (
          <Table
            columns={getApplicationColumns({
              onDelete: () => {},
              // onDelete: openDeleteModal,
              onToggleActive: isAgent ? handleToggleActive : undefined,
              t,
              kind,
            })}
            data={items}
            onRowClick={(app) => router.push(isAgent ? `/agencies/${app.id}` : `/applications/${app.id}`)}
            emptyMessage={t("noData")}
          />
        )}
        {!loading && loadedOnce && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      {modalOpen && (
        <ApplicationModal
          onClose={() => setModalOpen(false)}
          form={form}
          onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
          onSave={handleCreate}
          saving={saving}
        />
      )}

      {/* {deleteModalOpen && (
        <ConfirmModal
          title={isAgent ? t("deleteAgency") : t("deleteApplication")}
          warningText={itemToDelete?.is_self_registered ? t("cannotDeleteSelfRegistered") : t("deleteWillRemoveAllData")}
          confirming={deleting}
          onConfirm={handleDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setItemToDelete(null);
          }}
        />
      )} */}
    </div>
  );
}
