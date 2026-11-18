import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth, useTenants, type PermissionRefreshResult } from "@/auth/AuthProvider";
import { App, Dropdown } from "./antd";
import { ChevronDown } from "./icons";
import { TenantSwitchModal } from "./TenantSwitchModal";

const ITEM =
  "block w-full cursor-pointer rounded-control border-0 bg-transparent px-3 py-1.5 text-left text-body text-ink no-underline hover:bg-subtle";

/** Thời gian chờ giữa hai lần bấm "Làm mới quyền" (ADR-0022, chống dồn tải /api/auth/refresh). */
export const REFRESH_COOLDOWN_SECONDS = 30;

const ENDED_TEXT: Record<"revoked" | "disabled" | "locked" | "no-token", string> = {
  revoked: "Phiên đã hết hiệu lực do thay đổi phân quyền hoặc đã kết thúc, vui lòng đăng nhập lại.",
  disabled: "Tài khoản đã bị vô hiệu hóa, vui lòng liên hệ quản trị viên.",
  locked: "Tài khoản đang tạm thời bị khóa, vui lòng thử lại sau.",
  "no-token": "Phiên đăng nhập đã kết thúc, vui lòng đăng nhập lại.",
};

function failedText(r: Extract<PermissionRefreshResult, { status: "failed" }>): string {
  if (r.reason === "superseded") return "Phiên vừa được làm mới ở nơi khác, vui lòng thử lại sau vài giây.";
  if (r.reason === "no-tenant") return "Bạn không còn thuộc đơn vị đang dùng, hãy chuyển sang đơn vị khác.";
  return "Chưa làm mới được quyền do hệ thống bận hoặc mất kết nối, vui lòng thử lại sau.";
}

/**
 * Menu người dùng ở thanh trên: Hồ sơ của tôi, Đổi mật khẩu, Làm mới quyền, Chuyển đơn vị (chỉ khi có từ 2 đơn vị), Đăng xuất.
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
  const { logout, session, refreshPermissions } = useAuth();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const tenants = useTenants().data;

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= cooldownUntil) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const onOpenChange = (o: boolean) => setOpen(o);

  const onRefreshPermissions = async () => {
    if (refreshing || secondsLeft > 0) return;
    setRefreshing(true);
    try {
      const r = await refreshPermissions();
      if (r.status === "updated") message.success("Đã cập nhật quyền.");
      else if (r.status === "unchanged") message.info("Quyền không thay đổi.");
      else if (r.status === "ended") {
        message.error(ENDED_TEXT[r.reason]);
        return; // phiên đã bị xóa: ProtectedRoute đưa về trang đăng nhập, không cần cooldown
      } else if (r.status === "failed") message.warning(failedText(r));
      setNow(Date.now());
      setCooldownUntil(Date.now() + REFRESH_COOLDOWN_SECONDS * 1000);
    } finally {
      setRefreshing(false);
      setOpen(false);
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
              {session && !session.mustChangePassword && (
                <button
                  type="button"
                  className={`${ITEM} disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent`}
                  disabled={refreshing || secondsLeft > 0}
                  aria-busy={refreshing}
                  title="Dùng khi quản trị viên vừa thay đổi quyền của bạn"
                  onClick={() => void onRefreshPermissions()}
                >
                  {refreshing
                    ? "Đang làm mới quyền..."
                    : secondsLeft > 0
                      ? `Làm mới quyền (chờ ${secondsLeft}s)`
                      : "Làm mới quyền"}
                </button>
              )}
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
