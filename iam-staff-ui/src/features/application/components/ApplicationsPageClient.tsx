"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useFetch } from "@/shared/hooks/useFetch";
import { toast } from "react-toastify";
import {
  AddButton,
  Can,
  ConfirmModal,
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState(false);
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
    setSaving(true);
    setError(null);
    try {
      const creatingAgent = form.application_type === "agent";
      const payload: Record<string, unknown> = {
        application_mnemonic: form.application_mnemonic.trim(),
        application_type: form.application_type || "staff",
        application_description: form.application_description || null,
        application_url: creatingAgent ? null : form.application_url || null,
        api_url: creatingAgent ? null : form.api_url || null,
      };
      if (!creatingAgent && form.order !== "") payload.order = Number(form.order);
      if (!creatingAgent && form.width !== "") payload.width = Number(form.width);
      if (!creatingAgent && form.icon_base64) payload.icon_base64 = form.icon_base64;

      const res = await execute("/api/applications/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setModalOpen(false);
      setForm({ ...emptyForm, application_type: kind });
      toast.success(isAgent ? t("agencyCreated") : t("applicationCreated"));
      await load(page);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Create failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!itemToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await execute("/api/applications/delete", {
        method: "POST",
        body: JSON.stringify({ id: itemToDelete.id }),
      });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setDeleteModalOpen(false);
      setItemToDelete(null);
      await load(page);
      toast.success(isAgent ? t("agencyDeleted") : t("applicationDeleted"));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }

  function openDeleteModal(item: Application) {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-semibold text-[24px] text-black">{isAgent ? t("agencies") : t("applications")}</h1>
        <Can action="application:create">
          <AddButton onClick={() => { setForm({ ...emptyForm, application_type: kind }); setModalOpen(true); }} />
        </Can>
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="bg-white rounded-[10px] py-6 shadow-sm">
        {loading || !loadedOnce ? (
          <TableSkeleton rows={pageSize} headers={isAgent ? [t("agencyId"), t("agencyName"), t("clientStatus"), t("groupStatus"), t("status"), t("actions")] : [t("mnemonic"), t("description"), t("url"), t("clientStatus"), t("status"), t("actions")]} />
        ) : (
          <Table
            columns={getApplicationColumns({ onDelete: openDeleteModal, t, kind })}
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

      {deleteModalOpen && (
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
      )}
    </div>
  );
}
