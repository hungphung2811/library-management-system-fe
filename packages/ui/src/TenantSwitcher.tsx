"use client";
import { useEffect, useState } from "react";
import { bffFetch } from "@mfe/api/client";
import { App, Dropdown } from "./antd";
import { Building2, Check, ChevronDown } from "./icons";
import { postSwitch, type TenantSummary } from "./TenantSwitchModal";

const PILL =
  "inline-flex h-10 max-w-[240px] items-center gap-2 rounded-full border border-line bg-white px-3 text-sm text-ink";

/**
 * Bộ chọn đơn vị (tenant) ngay trên thanh trên, cạnh chuông thông báo.
 * - Chưa tải xong hoặc người dùng không thuộc đơn vị nào: không hiện gì.
 * - Một đơn vị và token đã thuộc đơn vị đó: chỉ hiện tên (không bấm được).
 * - Từ hai đơn vị trở lên, hoặc token chưa gắn đơn vị: bấm để mở danh sách, chọn là chuyển ngay
 *   (cùng đường `/api/session/switch-tenant` như hộp thoại "Chuyển đơn vị" trong menu người dùng;
 *   thành công thì tải lại toàn trang về `/?switched=1` vì quyền và dữ liệu đổi theo đơn vị).
 * Danh sách lấy từ `/api/me/tenants`.
 */
export function TenantSwitcher({ tenantId }: { tenantId?: string }) {
  const { message } = App.useApp();
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    bffFetch<TenantSummary[]>("/api/me/tenants")
      .then((l) => alive && setTenants(Array.isArray(l) ? l : []))
      .catch(() => alive && setTenants([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!tenants || tenants.length === 0) return null;

  const current = tenants.find((t) => t.id === tenantId);
  const label = current?.name ?? "Chọn đơn vị";

  const pick = async (id: string) => {
    if (busy || id === tenantId) return;
    setBusy(true);
    try {
      const res = await postSwitch(id);
      if (res.ok) {
        location.assign("/?switched=1");
        return;
      }
      if (res.status === 401) {
        location.assign("/login?next=" + encodeURIComponent(location.pathname + location.search));
        return;
      }
      message.error(res.status === 403 ? "Bạn không có quyền ở đơn vị này." : "Không chuyển được đơn vị. Vui lòng thử lại.");
    } catch {
      message.error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    }
    setBusy(false);
  };

  if (tenants.length < 2 && current) {
    return (
      <span className={PILL} title={`Đơn vị làm việc: ${current.name}`} aria-label={`Đơn vị làm việc: ${current.name}`}>
        <Building2 size={16} strokeWidth={2} aria-hidden className="shrink-0 text-brand-600" />
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
              {t.id === tenantId && <Check size={14} strokeWidth={2.5} aria-hidden className="shrink-0 text-brand-600" />}
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
        <Building2 size={16} strokeWidth={2} aria-hidden className="shrink-0 text-brand-600" />
        <span className="hidden truncate font-medium sm:inline">{label}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden className="shrink-0 text-muted" />
      </button>
    </Dropdown>
  );
}
