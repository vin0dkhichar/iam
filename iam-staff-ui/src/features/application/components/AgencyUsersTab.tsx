"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Card, Table } from "@/components";
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
  const [items, setItems] = useState<AgencyUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agency_id: agencyId }),
      });
      const data = await response.json();
      if (data?.error) {
        toast.error(data.error);
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

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
    </Card>
  );
}
