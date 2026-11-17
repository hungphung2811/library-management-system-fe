import { useSearchParams } from "react-router";
import { Pagination } from "@/ui";
import { PAGE_SIZE_OPTIONS } from "../_lib/tenant-format";

/** Phân trang server qua `page` (từ 1) và `size` trên URL, giữ nguyên các tham số lọc; đổi cỡ trang thì về trang 1. */
export function PagerWithSize({ page, size, total }: { page: number; size: number; total: number }) {
  const [sp, setSp] = useSearchParams();
  if (total <= Math.min(...PAGE_SIZE_OPTIONS)) return null;
  const go = (p: number, s: number) => {
    const q = new URLSearchParams(sp);
    if (p <= 1) q.delete("page");
    else q.set("page", String(p));
    if (s === 20) q.delete("size");
    else q.set("size", String(s));
    setSp(q);
  };
  return (
    <div className="mt-4 flex justify-end">
      <Pagination
        current={page}
        pageSize={size}
        total={total}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        showSizeChanger
        showTotal={(t, [a, b]) => `Hiển thị ${a}–${b} trên tổng ${t}`}
        onChange={(p, s) => go(s !== size ? 1 : p, s)}
      />
    </div>
  );
}
