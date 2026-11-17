import { useSearchParams } from "react-router";
import { SearchBar, Select } from "@/ui";
import { FilterChips, type Chip } from "./FilterChips";

export const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "DISABLED", label: "Đã vô hiệu" },
];
export const PAGE_SIZES = [10, 20, 50];

/**
 * Thanh lọc người dùng: ô tìm (q) + phòng ban (dept) + trạng thái (status) + kích thước trang (size), đẩy lên query string
 * và xóa `page`. Dưới là số kết quả, chip các bộ lọc đang bật và nút "Xóa bộ lọc" (giữ `size`).
 */
export function UserFilters({
  departments,
  total,
  pageSize,
}: {
  departments: { value: string; label: string }[] | null;
  total: number | null;
  pageSize: number;
}) {
  const [sp, setSp] = useSearchParams();

  const set = (name: string, v?: string) => {
    const q = new URLSearchParams(sp);
    if (v) q.set(name, v);
    else q.delete(name);
    q.delete("page");
    setSp(q, { replace: true });
  };

  const q = sp.get("q")?.trim() ?? "";
  const dept = sp.get("dept") ?? "";
  const status = sp.get("status") ?? "";
  const chips: Chip[] = [
    ...(q ? [{ key: "q", label: `Từ khóa: ${q}`, onClose: () => set("q") }] : []),
    ...(dept
      ? [{ key: "dept", label: `Phòng ban: ${departments?.find((d) => d.value === dept)?.label ?? dept}`, onClose: () => set("dept") }]
      : []),
    ...(status
      ? [{ key: "status", label: `Trạng thái: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`, onClose: () => set("status") }]
      : []),
  ];
  const clear = () => {
    const n = new URLSearchParams();
    if (sp.get("size")) n.set("size", sp.get("size") as string);
    setSp(n, { replace: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <SearchBar
        placeholder="Tìm theo tên, tên đăng nhập hoặc email"
        extra={
          <>
            {departments && (
              <Select
                aria-label="Lọc theo phòng ban"
                className="min-w-48"
                placeholder="Phòng ban"
                allowClear
                showSearch={{ optionFilterProp: "label" }}
                value={dept || undefined}
                options={departments}
                onChange={(v) => set("dept", v)}
              />
            )}
            <Select
              aria-label="Lọc theo trạng thái"
              className="min-w-44"
              placeholder="Trạng thái"
              allowClear
              value={status || undefined}
              options={STATUS_OPTIONS}
              onChange={(v) => set("status", v)}
            />
            <Select
              aria-label="Số dòng mỗi trang"
              className="min-w-32"
              value={pageSize}
              options={PAGE_SIZES.map((n) => ({ value: n, label: `${n} / trang` }))}
              onChange={(v) => set("size", v === 20 ? undefined : String(v))}
            />
          </>
        }
      />
      <FilterChips chips={chips} onClear={clear} count={total === null ? undefined : `${total} người dùng`} />
    </div>
  );
}
