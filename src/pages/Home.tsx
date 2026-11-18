import type { ReactNode } from "react";
import { Link } from "react-router";
import { hasModule, useApi } from "@/api";
import Dashboard from "@/pages/dashboard/Dashboard";
import PlatformDashboard from "@/pages/dashboard/PlatformDashboard";
import { useSession } from "@/auth/AuthProvider";
import { ArrowLeftRight, BookOpen, KeyRound, PageHeader, ShieldCheck, Tag, User, formatDateTime } from "@/ui";
import { DEFAULT_NAV_LINKS, visibleNav } from "@/ui/nav-links";

type Tile = { href: string; title: string; desc: string; icon: ReactNode; tile: string };
type Recent = { id: string; message: string; createdAt: string; readAt?: string | null };

// Lối tắt của từng phân hệ; hiện theo quyền bằng đúng quy tắc của thanh bên (visibleNav trên danh sách nav).
const MODULE_TILES: Record<string, Omit<Tile, "href">> = {
  "/catalog": { title: "Sách", desc: "Đầu sách và bản sao", icon: <BookOpen size={20} strokeWidth={1.75} />, tile: "bg-primary-soft text-primary" },
  "/circulation": { title: "Mượn trả", desc: "Mượn, trả, gia hạn", icon: <ArrowLeftRight size={20} strokeWidth={1.75} />, tile: "bg-success-soft text-success" },
  "/admin": { title: "Quản trị", desc: "Phân quyền hệ thống", icon: <ShieldCheck size={20} strokeWidth={1.75} />, tile: "bg-warning-soft text-warning" },
};
// Luôn có với người đã đăng nhập (AuthenticatedOnly), không cần khóa quyền.
const PERSONAL_TILES: Tile[] = [
  { href: "/profile", title: "Hồ sơ", desc: "Tài khoản và thẻ thư viện", icon: <User size={20} strokeWidth={1.75} />, tile: "bg-info-soft text-info" },
  { href: "/change-password", title: "Mật khẩu", desc: "Đổi mật khẩu của bạn", icon: <KeyRound size={20} strokeWidth={1.75} />, tile: "bg-violet-soft text-violet" },
];

export default function Home() {
  const s = useSession();
  const name = s.username ?? s.userId.slice(0, 8);
  const modules: Tile[] = [
    ...visibleNav(DEFAULT_NAV_LINKS, s)
      .filter((l) => MODULE_TILES[l.href])
      .map((l) => ({ href: l.href, ...MODULE_TILES[l.href] })),
    ...PERSONAL_TILES,
  ];
  // Khối thông báo gần đây là phụ: lỗi hoặc chưa tải xong thì bỏ qua, không làm hỏng trang chủ.
  const notifications = useApi<Recent[]>("/api/notifications/me", { staleTime: 15_000 });
  const recent = (Array.isArray(notifications.data) ? [...notifications.data] : [])
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3);

  // Số liệu chỉ cho nhân viên/quản trị trong một đơn vị; từng khối còn tự ẩn theo module và quyền BE trả về.
  const staff = !!s.tenantId && (s.admin || modules.some((m) => m.href === "/catalog" || m.href === "/circulation"));

  return (
    <>
      <PageHeader title="Tổng quan" description="Chọn một phân hệ để bắt đầu làm việc" />
      {s.platformAdmin && !s.tenantId && <PlatformDashboard />}
      {staff && <Dashboard lending={hasModule(s, "LENDING")} sales={hasModule(s, "SALES")} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid grid-cols-2 gap-4">
          {modules.map((m) => (
            <Link
              key={m.href}
              to={m.href}
              className="group flex flex-col rounded-card [&:last-child:nth-child(odd)]:col-span-2 border border-line bg-surface p-4 text-ink no-underline shadow-card transition-colors hover:border-primary-border hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              <span className={`grid size-10 place-items-center rounded-control ${m.tile}`}>{m.icon}</span>
              <span className="mt-4 text-section font-semibold group-hover:text-primary">{m.title}</span>
              <span className="mt-0.5 text-caption text-muted">{m.desc}</span>
            </Link>
          ))}
        </div>

        <section className="flex flex-col self-start rounded-card border border-line bg-surface shadow-card">
          <div className="flex-1 p-5">
            <h2 className="m-0 text-title leading-snug font-semibold">
              Xin chào, <span className="text-primary">{name}</span>
            </h2>
            <p className="mt-2 mb-0 max-w-lg text-body leading-relaxed text-muted">
              Các phân hệ bạn thấy trong thanh bên phụ thuộc vào vai trò và quyền được cấp cho tài khoản này.
            </p>
            <dl className="mt-5 mb-0 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="mb-1.5 text-caption text-muted">Vai trò</dt>
                <dd className="m-0 flex flex-wrap gap-2">
                  {s.roles.length ? s.roles.map((r) => <Tag key={r} color="blue" className="me-0">{r}</Tag>) : "-"}
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-caption text-muted">Phạm vi quyền</dt>
                <dd className="m-0 text-sm font-medium">
                  {s.admin ? "Quản trị viên (toàn quyền)" : `${s.permissions.length} khóa quyền được cấp`}
                </dd>
              </div>
            </dl>
            {recent.length > 0 && (
              <div className="mt-5">
                <h3 className="m-0 mb-1.5 text-caption text-muted">Thông báo gần đây</h3>
                <ul className="m-0 list-none p-0">
                  {recent.map((n) => (
                    <li key={n.id} data-testid="recent-notification" className="border-b border-line py-2 last:border-b-0">
                      <div className="text-sm text-ink">{n.message}</div>
                      <div className="text-caption text-muted">{formatDateTime(n.createdAt)}</div>
                    </li>
                  ))}
                </ul>
                <Link to="/notifications" className="mt-2 inline-block text-sm font-medium text-primary no-underline hover:underline">
                  Xem tất cả thông báo
                </Link>
              </div>
            )}
          </div>
          {modules.some((m) => m.href === "/circulation") && (
            <div className="border-t border-line px-5 py-3 text-center">
              <Link
                to="/circulation"
                className="border-0 border-b border-dashed border-primary pb-px text-sm font-medium text-primary no-underline hover:text-primary"
              >
                Mở phân hệ Mượn trả
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
