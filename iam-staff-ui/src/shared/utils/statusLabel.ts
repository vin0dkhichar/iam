export function statusLabel(t: (key: string) => string, value?: string | null) {
  if (!value) return "—";
  const key = `status_${value.toLowerCase()}`;
  const known = ["status_pending", "status_syncing", "status_synced", "status_failed"];
  return known.includes(key) ? t(key) : value;
}
