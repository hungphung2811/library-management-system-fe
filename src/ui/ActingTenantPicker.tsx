import { useApi } from "@/api";
import { useAuth } from "@/auth/AuthProvider";
import { Select } from "./antd";
import { Building2 } from "./icons";

type TenantOption = { id: string; code: string; name: string };
type TenantList = { items: TenantOption[] };

/**
 * Chỉ cho platform admin (ADR-0016 ở BE): chọn đơn vị để làm việc thay. Chọn thì mọi lời gọi `/api/**` gửi `X-Tenant-Id`,
 * sidebar dùng menu của đơn vị đó và các trang nghiệp vụ (sách, mượn trả, người dùng...) đọc/ghi dữ liệu của nó như admin.
 * Xóa lựa chọn (x) thì quay lại chế độ nền tảng (không có menu nghiệp vụ). Đổi đơn vị tải lại trang và giữ nguyên đường dẫn
 * hiện tại (trang chi tiết của đơn vị cũ có thể báo không tìm thấy ở đơn vị mới). Danh sách lấy từ `/api/platform/tenants`.
 */
export function ActingTenantPicker({ actingTenantId }: { actingTenantId?: string }) {
  const { actAsTenant } = useAuth();
  const q = useApi<TenantList>("/api/platform/tenants?size=100", { staleTime: 5 * 60_000 });
  const options = (q.data?.items ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }));
  return (
    <Select
      aria-label="Đơn vị đang làm việc"
      className="w-44 sm:w-60"
      placeholder={
        <span className="inline-flex items-center gap-1.5">
          <Building2 size={14} strokeWidth={1.75} aria-hidden />
          Làm việc thay đơn vị...
        </span>
      }
      allowClear
      loading={q.isPending}
      showSearch={{ optionFilterProp: "label" }}
      value={actingTenantId}
      options={options}
      onChange={(v?: string) => {
        // Ghi lựa chọn vào localStorage rồi tải lại tại đúng đường dẫn hiện tại; không render lại nên không có lời gọi API thừa.
        actAsTenant(v ?? null, { reload: true });
      }}
    />
  );
}
