import { useState } from "react";
import { useNavigate } from "react-router";
import { toErrorInfo } from "@/api";
import { useAuth, useTenants } from "@/auth/AuthProvider";
import { App, Dropdown } from "./antd";
import { Building2, Check, ChevronDown } from "./icons";

const PILL =
  "inline-flex h-8 max-w-[200px] items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-body text-ink";

/**
 * Bộ chọn đơn vị (tenant) ngay trên thanh trên, cạnh chuông thông báo.
 * - Chưa tải xong hoặc người dùng không thuộc đơn vị nào: không hiện gì.
 * - Một đơn vị và token đã thuộc đơn vị đó: chỉ hiện tên (không bấm được).
 * - Từ hai đơn vị trở lên, hoặc token chưa gắn đơn vị: bấm để mở danh sách, chọn là chuyển ngay
 *   (cùng `switchTenant` như hộp thoại "Chuyển đơn vị" trong menu người dùng;
 *   thành công thì chuyển về `/?switched=1` vì quyền và dữ liệu đổi theo đơn vị).
 * Danh sách lấy từ `/api/me/tenants`.
 */
export function TenantSwitcher({ tenantId }: { tenantId?: string }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { switchTenant } = useAuth();
  const tenants = useTenants().data;
  const [busy, setBusy] = useState(false);

  if (!tenants || tenants.length === 0) return null;

  const current = tenants.find((t) => t.id === tenantId);
  const label = current?.name ?? "Chọn đơn vị";

  const pick = async (id: string) => {
    if (busy || id === tenantId) return;
    setBusy(true);
    try {
      await switchTenant(id);
      void navigate("/?switched=1");
    } catch (e) {
      const st = toErrorInfo(e);
      if (st.status !== 401) {
        message.error(
          st.status === 403
            ? "Bạn không có quyền ở đơn vị này."
            : st.code === "NETWORK"
              ? "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."
              : "Không chuyển được đơn vị. Vui lòng thử lại.",
        );
      }
    }
    setBusy(false);
  };

  if (tenants.length < 2 && current) {
    return (
      <span className={PILL} title={`Đơn vị làm việc: ${current.name}`} aria-label={`Đơn vị làm việc: ${current.name}`}>
        <Building2 size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-primary" />
        <span className="hidden truncate font-medium sm:inline">{current.name}</span>
      </span>
    );
  }

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      disabled={busy}
      menu={{
        items: tenants.map((t) => ({
          key: t.id,
          label: (
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-ink">{t.name}</span>{" "}
                <span className="font-mono text-xs text-muted">{t.code}</span>
              </span>
              {t.id === tenantId && <Check size={14} strokeWidth={2.5} aria-hidden className="shrink-0 text-primary" />}
            </span>
          ),
        })),
        selectedKeys: tenantId ? [tenantId] : [],
        onClick: ({ key }) => void pick(key),
        "aria-label": "Danh sách đơn vị",
      }}
    >
      <button
        type="button"
        aria-label={`Đơn vị làm việc: ${label}`}
        aria-haspopup="menu"
        title={`Đơn vị làm việc: ${label}`}
        className={`${PILL} cursor-pointer hover:bg-subtle ${busy ? "opacity-60" : ""}`}
      >
        <Building2 size={15} strokeWidth={1.75} aria-hidden className="shrink-0 text-primary" />
        <span className="hidden truncate font-medium sm:inline">{label}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden className="shrink-0 text-muted" />
      </button>
    </Dropdown>
  );
}
