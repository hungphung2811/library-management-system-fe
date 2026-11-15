"use client";
import { useState } from "react";
import { bffFetch } from "@mfe/api/client";
import { Dropdown } from "./antd";
import { TenantSwitchModal, type TenantSummary } from "./TenantSwitchModal";

const ITEM =
  "block w-full cursor-pointer rounded-md border-0 bg-transparent px-3 py-2 text-left text-sm text-ink no-underline hover:bg-subtle";

/**
 * Menu người dùng ở thanh trên: Hồ sơ của tôi, Đổi mật khẩu, Chuyển đơn vị (chỉ khi có từ 2 đơn vị), Đăng xuất.
 * Danh sách đơn vị chỉ tải khi mở menu lần đầu (không tải ở SSR); tên đơn vị hiện tại chỉ hiện trong đầu menu.
 */
export function UserMenu({
  user,
  tenantId,
}: {
  user: { id: string; name: string; role?: string };
  tenantId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [switching, setSwitching] = useState(false);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && tenants === null) {
      bffFetch<TenantSummary[]>("/api/me/tenants")
        .then((l) => setTenants(Array.isArray(l) ? l : []))
        .catch(() => setTenants([]));
    }
  };

  const currentName = tenants?.find((t) => t.id === tenantId)?.name;
  const initial = user.name.slice(0, 1).toUpperCase();

  return (
    <>
      <Dropdown
        trigger={["click"]}
        placement="bottomRight"
        open={open}
        onOpenChange={onOpenChange}
        popupRender={() => (
          <div className="w-[240px] rounded-xl border border-line bg-white p-2 shadow-lg">
            <div className="border-b border-line px-3 pt-1 pb-2 text-sm leading-tight">
              <div className="truncate font-medium text-ink" title={user.id}>
                {user.name}
              </div>
              {user.role && <div className="truncate text-xs text-muted">{user.role}</div>}
              {currentName && <div className="mt-1 truncate text-xs text-muted">Đơn vị: {currentName}</div>}
            </div>
            <div className="pt-1">
              <a href="/profile" className={ITEM}>
                Hồ sơ của tôi
              </a>
              <a href="/change-password" className={ITEM}>
                Đổi mật khẩu
              </a>
              {tenants && tenants.length >= 2 && (
                <button
                  type="button"
                  className={ITEM}
                  onClick={() => {
                    setOpen(false);
                    setSwitching(true);
                  }}
                >
                  Chuyển đơn vị
                </button>
              )}
              <form method="post" action="/api/session/logout" className="m-0">
                <button type="submit" className={ITEM}>
                  Đăng xuất
                </button>
              </form>
            </div>
          </div>
        )}
      >
        <button
          type="button"
          aria-label="Tài khoản của tôi"
          aria-haspopup="menu"
          aria-expanded={open}
          title={user.name}
          className="grid size-10 cursor-pointer place-items-center rounded-full border-0 bg-brand-50 text-sm font-semibold text-brand-600 ring-2 ring-white hover:bg-brand-100"
        >
          <span aria-hidden>{initial}</span>
        </button>
      </Dropdown>
      <TenantSwitchModal
        open={switching}
        tenants={tenants ?? []}
        currentTenantId={tenantId}
        onClose={() => setSwitching(false)}
      />
    </>
  );
}
