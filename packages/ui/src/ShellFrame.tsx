"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
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
import type { VisibleNavLink } from "./nav-links";

export type ShellFrameProps = {
  items: VisibleNavLink[];
  /**
   * Mục dự phòng khi URL không khớp mục nào (trang 503 của zone, trang ngoài sidebar). Bỏ trống ở shell:
   * mục đang mở tự suy ra từ URL.
   */
  current?: string;
  /** basePath của zone ("/admin"); `usePathname()` không gồm basePath nên ghép lại để so với href đầy đủ. */
  basePath?: string;
  /**
   * Các đường dẫn thuộc CÙNG app với khung này: link khớp (bằng href hoặc nằm dưới href đó) dùng next/link nên giữ sidebar
   * và không tải lại trang. Mặc định rỗng: mọi link là <a> (zone admin có basePath nên phải như vậy).
   */
  clientHrefs?: string[];
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

/** Chọn href dài nhất khớp pathname (riêng "/" chỉ khớp đúng "/"). Dùng cho crumbs theo đường dẫn. */
function longestMatch(pathname: string, hrefs: string[]): string | undefined {
  let best: string | undefined;
  for (const h of hrefs) if (matchesPath(pathname, h) && (best === undefined || h.length > best.length)) best = h;
  return best;
}

const ICON_PROPS = { size: 17, strokeWidth: 1.75, "aria-hidden": true } as const;

const ICONS: Record<string, ReactNode> = {
  "/": <LayoutDashboard {...ICON_PROPS} />,
  "/catalog": <BookOpen {...ICON_PROPS} />,
  "/circulation": <ArrowLeftRight {...ICON_PROPS} />,
  "/admin": <ShieldCheck {...ICON_PROPS} />,
};

/** Mục (lá) khớp nhất với đường dẫn: bằng nhau hoặc là tiền tố theo ranh giới "/", href dài nhất thắng. */
function findActive(items: VisibleNavLink[], path: string) {
  type Leaf = { href: string; label: string; parent?: VisibleNavLink };
  const leaves: Leaf[] = items.flatMap((l): Leaf[] =>
    l.children ? l.children.map((c) => ({ ...c, parent: l })) : [{ href: l.href, label: l.label }],
  );
  const match = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  const hit = leaves.filter((l) => match(l.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return hit && { ...hit, exact: hit.href === path };
}

const groupId = (href: string) => `nav-group-${href.replace(/\W+/g, "-")}`;

/** next/link cho điều hướng trong cùng app (giữ sidebar, không tải lại trang), <a> cho link còn lại. */
function NavAnchor({ client, href, ...rest }: ComponentProps<"a"> & { client: boolean; href: string }) {
  return client ? <Link href={href} {...rest} /> : <a href={href} {...rest} />;
}

/**
 * Khung bám Metronic demo1: sidebar sáng 250px (logo ở đầu, nhóm mục có nhãn nhỏ), thanh trên trắng cao 70px
 * có nút thu gọn sidebar, nền trắng, nội dung là các card viền mảnh.
 * Chỉ MỘT phần tử <nav> (chứa cả link và khối người dùng) để landmark không bị trùng.
 * Link trong cùng app (clientHrefs) dùng next/link; sang zone admin là full page load nên vẫn dùng thẻ <a>.
 */
export function ShellFrame({ items, current, basePath = "", clientHrefs = [], user, tenantId, crumb, crumbs, children }: ShellFrameProps) {
  const isClient = (href: string) => clientHrefs.some((p) => (p === "/" ? href === "/" : href === p || href.startsWith(`${p}/`)));
  // Trong zone, usePathname() trả đường dẫn KHÔNG gồm basePath (app-router bỏ basePath khỏi pathname), nên ghép lại.
  const pathname = usePathname();
  const path = `${basePath}${pathname === "/" ? "" : pathname}`.replace(/\/+$/, "") || "/";
  const active = findActive(items, path);
  const [toggled, setToggled] = useState<Record<string, boolean>>({}); // nhóm do người dùng tự mở/thu gọn
  const [open, setOpen] = useState(false); // ngăn kéo trên màn hình nhỏ
  const [collapsed, setCollapsed] = useState(false); // ẩn sidebar trên màn hình lớn

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Không khớp mục lá nào (trang gốc của nhóm như /circulation, trang 503 của zone): `current` nếu có,
  // không thì suy từ URL (href mục cấp trên dài nhất khớp) để biết nhóm nào đang mở.
  const currentHref = current ?? longestMatch(path, items.map((i) => i.href));
  const fallback = active ? undefined : items.find((i) => i.href === currentHref);
  // Tên breadcrumb: crumb (prop đơn) > crumbs (theo đường dẫn, cho layout chung) > mục sidebar khớp URL > mục dự phòng.
  const crumbKey = crumbs ? longestMatch(pathname, Object.keys(crumbs)) : undefined;
  const crumbLabel = crumb ?? (crumbKey ? crumbs?.[crumbKey] : undefined);
  const currentLabel = crumbLabel ?? active?.label ?? (fallback?.children ? undefined : fallback?.label);
  const parentLabel = crumbLabel ? undefined : (active?.parent ?? fallback)?.label;

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
        className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-line bg-white transition-[transform,visibility] duration-200 motion-reduce:transition-none ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        } ${collapsed ? "lg:invisible lg:-translate-x-full" : "lg:visible lg:translate-x-0"}`}
      >
        <nav aria-label="Điều hướng chính" className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-[64px] shrink-0 items-center justify-between px-5">
            <NavAnchor client={isClient("/")} href="/" aria-label="Thư viện, về trang chủ" className="no-underline">
              <Logo />
            </NavAnchor>
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setOpen(false)}
              className="grid size-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-subtle lg:hidden"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Thu gọn menu"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(true)}
              className="hidden size-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 lg:grid"
            >
              <PanelLeftClose size={18} strokeWidth={1.75} />
            </button>
          </div>

          <ul className="m-0 flex-1 list-none overflow-y-auto px-3 pt-1 pb-3">
            {items.map((l, i) => {
              const newGroup = l.group && l.group !== items[i - 1]?.group;
              const inSection = l.children ? (active ? active.parent === l : l.href === currentHref) : active?.href === l.href;
              const expanded = l.children ? (toggled[l.href] ?? inSection) : false;
              const icon = (
                <span
                  className={`grid size-5 shrink-0 place-items-center transition-colors motion-reduce:transition-none ${
                    inSection ? "text-brand-600" : "text-muted group-hover:text-brand-600"
                  }`}
                >
                  {ICONS[l.href] ?? <LayoutGrid {...ICON_PROPS} />}
                </span>
              );
              const rowClass = `group flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[13.5px] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 motion-reduce:transition-none ${
                inSection && !l.children ? "bg-brand-50 font-semibold text-brand-600" : inSection ? "font-semibold text-brand-600 hover:bg-subtle" : "font-medium text-ink hover:bg-subtle"
              }`;
              return (
                <Fragment key={l.href}>
                  {newGroup && (
                    <li aria-hidden className="mt-4 mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                      {l.group}
                    </li>
                  )}
                  <li className="relative mb-0.5">
                    {l.children ? (
                      <>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={groupId(l.href)}
                          onClick={() => setToggled((t) => ({ ...t, [l.href]: !expanded }))}
                          className={`${rowClass} cursor-pointer border-0 bg-transparent`}
                        >
                          {icon}
                          <span className="flex-1">{l.label}</span>
                          <ChevronDown
                            size={16}
                            strokeWidth={1.75}
                            aria-hidden
                            className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        <ul id={groupId(l.href)} hidden={!expanded} className="m-0 mt-0.5 mb-1 ml-[22px] list-none border-l border-line p-0 pl-2">
                          {l.children.map((c) => {
                            const on = active?.href === c.href;
                            return (
                              <li key={c.href} className="mb-px">
                                <NavAnchor
                                  client={isClient(c.href)}
                                  href={c.href}
                                  aria-current={on ? (active.exact ? "page" : "true") : undefined}
                                  className={`flex min-h-8 items-center rounded-md px-3 py-1.5 text-[13px] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 motion-reduce:transition-none ${
                                    on ? "bg-brand-50 font-semibold text-brand-600" : "font-medium text-ink hover:bg-subtle"
                                  }`}
                                >
                                  {c.label}
                                </NavAnchor>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <NavAnchor
                        client={isClient(l.href)}
                        href={l.href}
                        aria-current={inSection ? (active?.exact ? "page" : "true") : undefined}
                        className={rowClass}
                      >
                        {icon}
                        {l.label}
                      </NavAnchor>
                    )}
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

      <div className={`flex min-h-screen flex-col transition-[padding] duration-200 motion-reduce:transition-none ${collapsed ? "lg:pl-0" : "lg:pl-[250px]"}`}>
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
          {/* Sidebar thu gọn là ẩn hẳn, nên nút mở lại phải nằm ngoài sidebar; khi sidebar đang hiện, nút toggle nằm cạnh logo. */}
          {collapsed && (
            <button
              type="button"
              aria-label="Mở rộng menu"
              aria-expanded={false}
              onClick={() => setCollapsed(false)}
              className="hidden size-9 cursor-pointer place-items-center rounded-lg border border-line bg-white text-muted hover:bg-subtle hover:text-ink lg:grid"
            >
              <PanelLeftOpen size={18} strokeWidth={1.75} />
            </button>
          )}
          <ol className="m-0 flex list-none items-center gap-1.5 p-0 text-sm text-muted">
            <li>
              <NavAnchor client={isClient("/")} href="/" className="font-medium text-muted no-underline hover:text-brand-600">
                Trang chủ
              </NavAnchor>
            </li>
            {parentLabel && parentLabel !== currentLabel && (
              <>
                <li aria-hidden className="grid place-items-center text-[#b5bacb]">
                  <ChevronRight size={14} strokeWidth={2} />
                </li>
                <li>{parentLabel}</li>
              </>
            )}
            {currentLabel && path !== "/" && (
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
