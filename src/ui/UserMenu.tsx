import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth, useTenants } from "@/auth/AuthProvider";
import { Dropdown } from "./antd";
import { ChevronDown } from "./icons";
import { TenantSwitchModal } from "./TenantSwitchModal";

const ITEM =
  "block w-full cursor-pointer rounded-control border-0 bg-transparent px-3 py-1.5 text-left text-body text-ink no-underline hover:bg-subtle";

/**
 * Menu người dùng ở thanh trên: Hồ sơ của tôi, Đổi mật khẩu, Chuyển đơn vị (chỉ khi có từ 2 đơn vị), Đăng xuất.
 * Tên đơn vị hiện tại chỉ hiện trong đầu menu. Đăng xuất: thu hồi refresh token, xóa phiên rồi về /login.
 */
export function UserMenu({
  user,
  tenantId,
}: {
  user: { id: string; name: string; role?: string };
  tenantId?: string;
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const tenants = useTenants().data;

  const onOpenChange = (o: boolean) => setOpen(o);

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
          <div className="w-[232px] rounded-card border border-line bg-surface p-1.5 shadow-popup">
            <div className="border-b border-line px-3 pt-1 pb-2 text-body leading-tight">
              <div className="truncate font-medium text-ink" title={user.id}>
                {user.name}
              </div>
              {user.role && <div className="truncate text-xs text-muted">{user.role}</div>}
              {currentName && <div className="mt-1 truncate text-xs text-muted">Đơn vị: {currentName}</div>}
            </div>
            <div className="pt-1">
              <Link to="/profile" onClick={() => setOpen(false)} className={ITEM}>
                Hồ sơ của tôi
              </Link>
              <Link to="/change-password" onClick={() => setOpen(false)} className={ITEM}>
                Đổi mật khẩu
              </Link>
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
              <button
                type="button"
                className={ITEM}
                onClick={() => {
                  setOpen(false);
                  void logout().then(() => navigate("/login", { replace: true }));
                }}
              >
                Đăng xuất
              </button>
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
          className="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent py-0.5 pr-2 pl-0.5 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-body font-semibold text-primary"
          >
            {initial}
          </span>
          <span className="hidden min-w-0 max-w-[160px] text-left text-body leading-tight sm:block">
            <span className="block truncate font-medium text-ink">{user.name}</span>
            {user.role && <span className="block truncate text-xs text-muted">{user.role}</span>}
          </span>
          <ChevronDown size={14} aria-hidden className="hidden text-muted sm:block" />
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
