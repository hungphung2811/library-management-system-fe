"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Segmented } from "@mfe/ui";
import type { BorrowingFilter } from "../_lib/circulation";

const OPTIONS: { label: string; value: BorrowingFilter | "" }[] = [
  { label: "Tất cả", value: "" },
  { label: "Đang mượn", value: "ACTIVE" },
  { label: "Quá hạn", value: "OVERDUE" },
  { label: "Đã trả hết", value: "RETURNED" },
];

/** Bộ lọc trạng thái của danh sách phiếu mượn: đẩy `status` lên URL và bỏ `page` (giống AvailableToggle ở catalog). */
export function BorrowingStatusFilter({ value }: { value: BorrowingFilter | "" }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <Segmented
      aria-label="Lọc theo trạng thái phiếu mượn"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        const q = new URLSearchParams(sp.toString());
        if (v) q.set("status", String(v));
        else q.delete("status");
        q.delete("page");
        router.replace(q.size ? `${pathname}?${q}` : pathname);
      }}
    />
  );
}
