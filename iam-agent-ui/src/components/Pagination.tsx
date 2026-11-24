"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  const t = useTranslations();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  return (
    <div className="flex items-center justify-end gap-3 px-9 pt-4">
      <span className="text-[16px] text-gray-500">
        {start} - {end} {t("of")} {total}
      </span>

      <button
        type="button"
        className="flex h-8.5 min-w-10 cursor-pointer items-center justify-center rounded bg-[#ED7C22] px-3 text-[16px] font-medium text-black transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-[#9ca3af] disabled:text-white disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={t("previousPage")}
      >
        <Image
          src="/arrow_back_01.png"
          width={16}
          height={16}
          alt={t("previousPage")}
          className="block"
        />
      </button>

      <button
        type="button"
        className="flex h-8.5 min-w-10 cursor-pointer items-center justify-center rounded bg-[#ED7C22] px-3 text-[16px] font-medium text-black transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-[#9ca3af] disabled:text-white disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label={t("nextPage")}
      >
        <Image
          src="/arrow_next_01.png"
          width={16}
          height={16}
          alt={t("nextPage")}
          className="block"
        />
      </button>
    </div>
  );
}
