import { useSearchParams } from "react-router";
import { DEFAULT_PAGE_SIZES, Pagination } from "@/ui";

/**
 * Phân trang server qua query `page` (từ 1), giữ nguyên các tham số lọc khác.
 * Dùng thay `pagination={{ mode: "server" }}` của DataTable vì DataTable (src/ui) đang đọc sai `useSearchParams()`
 * (mảng, không phải URLSearchParams) nên href trang làm hỏng các tham số lọc. Bỏ file này khi DataTable được sửa.
 */
export function ServerPager({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const [sp, setSp] = useSearchParams();
  if (total <= Math.min(pageSize, ...DEFAULT_PAGE_SIZES)) return null;
  const go = (p: number, s: number) => {
    const q = new URLSearchParams(sp);
    if (s !== pageSize) {
      q.set("size", String(s));
      q.delete("page");
    } else if (p <= 1) q.delete("page");
    else q.set("page", String(p));
    setSp(q);
  };
  return (
    <div className="mt-4 flex justify-end">
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger
        pageSizeOptions={Array.from(new Set([...DEFAULT_PAGE_SIZES, pageSize])).sort((a, b) => a - b)}
        locale={{ items_per_page: "/ trang", page_size: "Số dòng mỗi trang" }}
        showTotal={(t, [a, b]) => `Hiển thị ${a}–${b} trên tổng ${t}`}
        onChange={go}
      />
    </div>
  );
}
