"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Card, Pagination, Table } from "@/components";
import { useConfig } from "@/context/ConfigContext";
import { statusLabel } from "@/shared/utils/statusLabel";

interface AgencyUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  sync_status: string;
}

export default function AgencyUsersTab({
  agencyId,
  refreshKey,
}: {
  agencyId: string;
  refreshKey: number;
}) {
  const t = useTranslations();
  const { pageSize } = useConfig();
  const [items, setItems] = useState<AgencyUser[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

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
      }
    },
    [agencyId, pageSize],
  );

  useEffect(() => {
    setPage(1);
    load(1);
  }, [agencyId, refreshKey, load]);

  return (
    <Card padding="none" className="overflow-hidden py-6">
      <Table
        columns={[
          { key: "email", header: t("email"), render: (user: AgencyUser) => user.email },
          { key: "first", header: t("firstName"), render: (user: AgencyUser) => user.first_name },
          { key: "last", header: t("lastName"), render: (user: AgencyUser) => user.last_name },
          { key: "status", header: t("status"), render: (user: AgencyUser) => statusLabel(t, user.sync_status) },
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
  );
}
