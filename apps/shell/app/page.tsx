import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  AppShell, ArrowLeftRight, BookOpen, Button, KeyRound, PageHeader, ShieldCheck, Tag, User,
  canSeeLink, formatDateTime, getNavLinks,
} from "@mfe/ui";
import { getSession, gatewayFetch } from "@mfe/api";

type Tile = { href: string; title: string; desc: string; icon: ReactNode; tile: string };
type Recent = { id: string; message: string; createdAt: string; readAt?: string | null };

// Lối tắt của từng phân hệ; hiện theo quyền bằng đúng quy tắc của thanh bên (canSeeLink trên danh sách nav).
const MODULE_TILES: Record<string, Omit<Tile, "href">> = {
  "/catalog": { title: "Sách", desc: "Đầu sách và bản sao", icon: <BookOpen size={22} strokeWidth={1.75} />, tile: "bg-brand-50 text-brand-600" },
  "/circulation": { title: "Mượn trả", desc: "Mượn, trả, gia hạn", icon: <ArrowLeftRight size={22} strokeWidth={1.75} />, tile: "bg-emerald-50 text-emerald-600" },
  "/admin": { title: "Quản trị", desc: "Phân quyền hệ thống", icon: <ShieldCheck size={22} strokeWidth={1.75} />, tile: "bg-amber-50 text-amber-600" },
};
// Luôn có với người đã đăng nhập (AuthenticatedOnly), không cần khóa quyền.
const PERSONAL_TILES: Tile[] = [
  { href: "/profile", title: "Hồ sơ", desc: "Tài khoản và thẻ thư viện", icon: <User size={22} strokeWidth={1.75} />, tile: "bg-sky-50 text-sky-600" },
  { href: "/change-password", title: "Mật khẩu", desc: "Đổi mật khẩu của bạn", icon: <KeyRound size={22} strokeWidth={1.75} />, tile: "bg-violet-50 text-violet-600" },
];

/** Vài thông báo gần nhất cho trang chủ. Lỗi hoặc chậm thì bỏ qua khối này, không làm hỏng trang chủ. */
async function recentNotifications(): Promise<Recent[]> {
  try {
    const list = await gatewayFetch<Recent[]>("/api/notifications/me", { signal: AbortSignal.timeout(3000) });
    return (Array.isArray(list) ? list : [])
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 3);
  } catch {
    return [];
  }
}

export default async function Home() {
  const s = await getSession();
  if (s?.mustChangePassword) redirect("/change-password");
  const name = s?.username ?? s?.userId.slice(0, 8);
  const modules: Tile[] = s
    ? [
        ...getNavLinks()
          .filter((l) => MODULE_TILES[l.href] && canSeeLink(l, s))
          .map((l) => ({ href: l.href, ...MODULE_TILES[l.href] })),
        ...PERSONAL_TILES,
      ]
    : [];
  const recent = s ? await recentNotifications() : [];

  return (
    <AppShell current="/" session={s}>
      <PageHeader title="Tổng quan" description="Chọn một phân hệ để bắt đầu làm việc" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid grid-cols-2 gap-5">
          {modules.map((m) => (
            <a
              key={m.href}
              href={m.href}
              className="group flex flex-col rounded-xl [&:last-child:nth-child(odd)]:col-span-2 border border-line bg-white p-5 text-ink no-underline shadow-xs transition-colors hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none"
            >
              <span className={`grid size-11 place-items-center rounded-xl ${m.tile}`}>{m.icon}</span>
              <span className="mt-8 text-2xl font-semibold group-hover:text-brand-500">{m.title}</span>
              <span className="mt-1 text-sm text-muted">{m.desc}</span>
            </a>
          ))}
        </div>

        <section className="flex flex-col self-start rounded-xl border border-line bg-white shadow-xs">
          <div className="flex-1 p-8">
            {s ? (
              <>
                <h2 className="m-0 text-2xl leading-snug font-semibold">
                  Xin chào, <span className="text-brand-500">{name}</span>
                </h2>
                <p className="mt-3 mb-0 max-w-lg text-sm leading-relaxed text-muted">
                  Các phân hệ bạn thấy trong thanh bên phụ thuộc vào vai trò và quyền được cấp cho tài khoản này.
                </p>
                <dl className="mt-6 mb-0 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="mb-2 text-sm text-muted">Vai trò</dt>
                    <dd className="m-0 flex flex-wrap gap-2">
                      {s.roles.length ? s.roles.map((r) => <Tag key={r} color="blue" className="me-0">{r}</Tag>) : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-2 text-sm text-muted">Phạm vi quyền</dt>
                    <dd className="m-0 text-sm font-medium">
                      {s.admin ? "Quản trị viên (toàn quyền)" : `${s.permissions.length} khóa quyền được cấp`}
                    </dd>
                  </div>
                </dl>
                {recent.length > 0 && (
                  <div className="mt-6">
                    <h3 className="m-0 mb-2 text-sm text-muted">Thông báo gần đây</h3>
                    <ul className="m-0 list-none p-0">
                      {recent.map((n) => (
                        <li key={n.id} data-testid="recent-notification" className="border-b border-line py-2 last:border-b-0">
                          <div className="text-sm text-ink">{n.message}</div>
                          <div className="text-xs text-muted">{formatDateTime(n.createdAt)}</div>
                        </li>
                      ))}
                    </ul>
                    <a href="/notifications" className="mt-2 inline-block text-sm font-medium text-brand-600 no-underline hover:underline">
                      Xem tất cả thông báo
                    </a>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="m-0 text-2xl leading-snug font-semibold">Hệ thống quản lý thư viện</h2>
                <p className="mt-3 mb-6 max-w-lg text-sm leading-relaxed text-muted">
                  Bạn chưa đăng nhập. Đăng nhập để dùng các phân hệ được cấp quyền.
                </p>
                <Button type="primary" href="/login">
                  Đăng nhập
                </Button>
              </>
            )}
          </div>
          {modules.some((m) => m.href === "/circulation") && (
          <div className="border-t border-line px-8 py-4 text-center">
            <a
              href="/circulation"
              className="border-0 border-b border-dashed border-brand-500 pb-px text-sm font-medium text-brand-500 no-underline hover:text-brand-600"
            >
              Mở phân hệ Mượn trả
            </a>
          </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
