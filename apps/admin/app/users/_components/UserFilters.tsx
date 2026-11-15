"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchBar, Select } from "@mfe/ui";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "DISABLED", label: "Đã vô hiệu" },
];

/** Thanh lọc người dùng: ô tìm (q) + phòng ban (dept) + trạng thái (status), đẩy lên query string và xóa `page`. */
export function UserFilters({ departments }: { departments: { value: string; label: string }[] | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (name: string, v?: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(name, v);
    else q.delete(name);
    q.delete("page");
    router.replace(q.size ? `${pathname}?${q}` : pathname);
  };

  return (
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
              value={sp.get("dept") || undefined}
              options={departments}
              onChange={(v) => set("dept", v)}
            />
          )}
          <Select
            aria-label="Lọc theo trạng thái"
            className="min-w-44"
            placeholder="Trạng thái"
            allowClear
            value={sp.get("status") || undefined}
            options={STATUS_OPTIONS}
            onChange={(v) => set("status", v)}
          />
        </>
      }
    />
  );
}
