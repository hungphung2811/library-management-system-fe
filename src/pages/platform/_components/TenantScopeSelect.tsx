import { useSearchParams } from "react-router";
import { useApi, useSession } from "@/api";
import { Select } from "@/ui";
import type { TenantPage } from "../_lib/tenant-types";

/**
 * Lọc xuyên đơn vị cho platform admin (ADR-0008): tham số URL `tenantId`.
 * Trả `undefined` khi không phải platform admin (BE bỏ qua/chặn tham số này) hoặc khi chọn "Tất cả đơn vị".
 * Trang danh sách gắn: `const tenantId = useTenantScope(); if (tenantId) params.set("tenantId", tenantId);`
 * rồi đặt `<TenantScopeSelect />` cạnh các bộ lọc. Component tự ẩn nếu người dùng không phải platform admin.
 */
export function useTenantScope(): string | undefined {
  const s = useSession();
  const [sp] = useSearchParams();
  if (!s.platformAdmin) return undefined;
  return sp.get("tenantId")?.trim() || undefined;
}

/** Bộ chọn "Đơn vị": Tất cả / từng đơn vị. Đổi thì ghi `tenantId` lên URL và xóa `page`. */
export function TenantScopeSelect({ className = "min-w-52" }: { className?: string }) {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const q = useApi<TenantPage>(s.platformAdmin ? "/api/platform/tenants?size=100" : null);
  if (!s.platformAdmin) return null;
  const value = sp.get("tenantId")?.trim() || undefined;
  const options = (q.data?.items ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }));
  return (
    <Select
      aria-label="Lọc theo đơn vị"
      className={className}
      placeholder="Tất cả đơn vị"
      allowClear
      loading={q.isPending}
      showSearch={{ optionFilterProp: "label" }}
      value={value}
      options={options}
      onChange={(v) => {
        const n = new URLSearchParams(sp);
        if (v) n.set("tenantId", v);
        else n.delete("tenantId");
        n.delete("page");
        setSp(n, { replace: true });
      }}
    />
  );
}
