"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronRight,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

export type ShellFrameProps = {
  items: { href: string; label: string; group?: string }[];
  /**
   * Đường dẫn của mục đang mở. Có thì dùng nguyên (admin truyền "/admin" vì usePathname của zone đã bỏ basePath);
   * thiếu thì tự suy ra từ usePathname().
   */
  current?: string;
  user?: { id: string; name: string; role?: string };
  /** Đơn vị hiện tại (claim tenantId), để UserMenu đánh dấu khi chuyển đơn vị. */
  tenantId?: string;
  /** Tên trang hiện tại trên breadcrumb, cho trang không nằm trong sidebar (hồ sơ, thông báo). */
  crumb?: string;
  /** Tên breadcrumb theo đường dẫn (serialize được), dùng khi layout chung không biết trang con. Khớp khóa dài nhất. */
  crumbs?: Record<string, string>;
  children: ReactNode;
};

const matchesPath = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

/** Chọn href dài nhất khớp pathname (riêng "/" chỉ khớp đúng "/"). */
function longestMatch(pathname: string, hrefs: string[]): string | undefined {
  let best: string | undefined;
  for (const h of hrefs) if (matchesPath(pathname, h) && (best === undefined || h.length > best.length)) best = h;
  return best;
}

const ICON_PROPS = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

const ICONS: Record<string, ReactNode> = {
  "/": <LayoutDashboard {...ICON_PROPS} />,
  "/catalog": <BookOpen {...ICON_PROPS} />,
  "/circulation": <ArrowLeftRight {...ICON_PROPS} />,
  "/admin": <ShieldCheck {...ICON_PROPS} />,
};

/**
 * Khung bám Metronic demo1: sidebar sáng 280px (logo ở đầu, nhóm mục có nhãn nhỏ), thanh trên trắng cao 70px
 * có nút thu gọn sidebar, nền trắng, nội dung là các card viền mảnh.
 * Chỉ MỘT phần tử <nav> (chứa cả link và khối người dùng) để landmark không bị trùng.
 * Giữa các zone là full page load nên dùng thẻ <a>, không dùng next/link.
 */
export function ShellFrame({ items, current: currentProp, user, tenantId, crumb, crumbs, children }: ShellFrameProps) {
  const [open, setOpen] = useState(false); // ngăn kéo trên màn hình nhỏ
  const [collapsed, setCollapsed] = useState(false); // ẩn sidebar trên màn hình lớn

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pathname = usePathname();
  const current = currentProp ?? longestMatch(pathname, items.map((i) => i.href));
  const crumbKey = crumbs ? longestMatch(pathname, Object.keys(crumbs)) : undefined;
  const currentLabel = crumb ?? (crumbKey ? crumbs?.[crumbKey] : undefined) ?? items.find((i) => i.href === current)?.label;

  return (
    <div className="min-h-screen">
      {open && (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-default border-0 bg-ink/40 lg:hidden"
        />
      )}

      <aside
        // `invisible` khi đã trượt ra ngoài: gỡ link khỏi thứ tự Tab và cây trợ năng (translate thôi thì phím Tab vẫn vào được).
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-line bg-white transition-[transform,visibility] duration-200 motion-reduce:transition-none ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        } ${collapsed ? "lg:invisible lg:-translate-x-full" : "lg:visible lg:translate-x-0"}`}
      >
        <nav aria-label="Điều hướng chính" className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-[76px] shrink-0 items-center justify-between px-6">
            <a href="/" aria-label="Thư viện, về trang chủ" className="no-underline">
              <Logo />
            </a>
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setOpen(false)}
              className="grid size-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-subtle lg:hidden"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>

          <ul className="m-0 flex-1 list-none overflow-y-auto px-4 pt-2 pb-4">
            {items.map((l, i) => {
              const active = l.href === current;
              const newGroup = l.group && l.group !== items[i - 1]?.group;
              return (
                <Fragment key={l.href}>
                  {newGroup && (
                    <li aria-hidden className="mt-6 mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] text-[#8a91a8] uppercase">
                      {l.group}
                    </li>
                  )}
                  <li className="relative mb-1">
                    {active && (
                      <span aria-hidden className="absolute top-2 -left-4 h-[calc(100%-1rem)] w-[3px] rounded-r-full bg-brand-500" />
                    )}
                    <a
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-xl p-1.5 pr-3 text-sm no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 motion-reduce:transition-none ${
                        active
                          ? "bg-brand-50 font-semibold text-brand-600"
                          : "font-medium text-ink hover:bg-subtle"
                      }`}
                    >
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors motion-reduce:transition-none ${
                          active
                            ? "bg-brand-500 text-white shadow-[0_2px_6px_rgba(27,132,255,.35)]"
                            : "bg-subtle text-muted group-hover:bg-white group-hover:text-brand-500"
                        }`}
                      >
                        {ICONS[l.href] ?? <LayoutGrid {...ICON_PROPS} />}
                      </span>
                      {l.label}
                    </a>
                  </li>
                </Fragment>
              );
            })}
          </ul>

          <div className="shrink-0 border-t border-line p-4">
            {user ? (
              <form method="post" action="/api/session/logout" className="m-0">
                <div className="mb-3 flex items-center gap-3 px-1">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600"
                  >
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 text-sm leading-tight">
                    <span title={user.id} className="block truncate font-medium text-ink">
                      {user.name}
                    </span>
                    {user.role && <span className="block truncate text-xs text-muted">{user.role}</span>}
                  </span>
                </div>
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle motion-reduce:transition-none"
                >
                  <LogOut size={16} strokeWidth={1.75} aria-hidden />
                  Đăng xuất
                </button>
              </form>
            ) : (
              <a
                href="/login"
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white no-underline hover:bg-brand-600"
              >
                <LogIn size={16} strokeWidth={1.75} aria-hidden />
                Đăng nhập
              </a>
            )}
          </div>
        </nav>
      </aside>

      <div className={`flex min-h-screen flex-col transition-[padding] duration-200 motion-reduce:transition-none ${collapsed ? "lg:pl-0" : "lg:pl-[280px]"}`}>
        <header className="sticky top-0 z-20 flex h-[70px] shrink-0 items-center gap-4 border-b border-transparent bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Mở menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-line bg-white text-ink hover:bg-subtle lg:hidden"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label={collapsed ? "Hiện thanh bên" : "Thu gọn thanh bên"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
            className="hidden size-9 cursor-pointer place-items-center rounded-lg border border-line bg-white text-muted hover:bg-subtle hover:text-ink lg:grid"
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} /> : <PanelLeftClose size={18} strokeWidth={1.75} />}
          </button>
          <ol className="m-0 flex list-none items-center gap-1.5 p-0 text-sm text-muted">
            <li>
              <a href="/" className="font-medium text-muted no-underline hover:text-brand-600">
                Trang chủ
              </a>
            </li>
            {currentLabel && current !== "/" && (
              <>
                <li aria-hidden className="grid place-items-center text-[#b5bacb]">
                  <ChevronRight size={14} strokeWidth={2} />
                </li>
                <li aria-current="page" className="font-semibold text-ink">
                  {currentLabel}
                </li>
              </>
            )}
          </ol>
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell userId={user.id} />
              <UserMenu user={user} tenantId={tenantId} />
            </div>
          )}
        </header>

        <main className="w-full flex-1 px-4 pt-4 pb-10 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
