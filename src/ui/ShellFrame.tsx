import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  Globe,
  ShieldCheck,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { QuickSearch } from "./QuickSearch";
import { ActingTenantPicker } from "./ActingTenantPicker";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { menuIcon } from "./menu-icons";
import type { VisibleNavLink } from "./nav-links";

export type ShellFrameProps = {
  items: VisibleNavLink[];
  user?: { id: string; name: string; role?: string };
  /** Đơn vị hiện tại (claim tenantId, hoặc đơn vị platform admin đang làm việc thay), để UserMenu đánh dấu khi chuyển đơn vị. */
  tenantId?: string;
  /** Platform admin: thay bộ chọn đơn vị thường bằng ActingTenantPicker (làm việc thay đơn vị, ADR-0016). */
  platformAdmin?: boolean;
  /** Tên breadcrumb theo đường dẫn, cho trang không nằm trong sidebar (hồ sơ, thông báo). Khớp khóa dài nhất. */
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

const ICON_PROPS = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const ICONS: Record<string, ReactNode> = {
  "/": <LayoutDashboard {...ICON_PROPS} />,
  "/catalog": <BookOpen {...ICON_PROPS} />,
  "/circulation": <ArrowLeftRight {...ICON_PROPS} />,
  "/sales": <ShoppingCart {...ICON_PROPS} />,
  "/admin": <ShieldCheck {...ICON_PROPS} />,
  "/platform": <Globe {...ICON_PROPS} />,
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

const NAV_ROW =
  "group relative flex w-full items-center gap-2.5 rounded-control px-2.5 text-left no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary motion-reduce:transition-none";
/** Mục đang chọn: nền primary-soft và thanh nhấn bên trái. */
const NAV_ACTIVE =
  "bg-primary-soft font-semibold text-primary before:absolute before:inset-y-1.5 before:-left-2.5 before:w-[3px] before:rounded-r-full before:bg-primary";

/** Mục con đang chọn: thanh nhấn đè lên đường kẻ dọc của nhóm. */
const NAV_ACTIVE_CHILD =
  "bg-primary-soft font-semibold text-primary before:absolute before:inset-y-1.5 before:-left-[9px] before:w-[3px] before:rounded-r-full before:bg-primary";

const groupId = (href: string) => `nav-group-${href.replace(/\W+/g, "-")}`;

/**
 * Khung kiểu SaaS admin gọn: sidebar trắng 224px (logo ở đầu, nhóm mục có nhãn nhỏ, mục đang chọn nền primary-soft
 * kèm thanh nhấn), thanh trên cao 52px (breadcrumb, tìm nhanh Ctrl+K, đơn vị, chuông, tài khoản), nền canvas, nội dung là các card viền mảnh.
 * Chỉ MỘT phần tử <nav> (chứa cả link và khối người dùng) để landmark không bị trùng.
 * Mọi link là route của cùng SPA nên dùng Link của react-router (giữ khung, không tải lại trang).
 */
export function ShellFrame({ items, user, tenantId, platformAdmin, crumbs, children }: ShellFrameProps) {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "") || "/";
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

  // Không khớp mục lá nào (trang gốc của nhóm như /circulation): suy từ URL (href mục cấp trên dài nhất khớp)
  // để biết nhóm nào đang mở.
  const currentHref = longestMatch(path, items.map((i) => i.href));
  const fallback = active ? undefined : items.find((i) => i.href === currentHref);
  // Tên breadcrumb: crumbs (theo đường dẫn) > mục sidebar khớp URL > mục dự phòng.
  const crumbKey = crumbs ? longestMatch(pathname, Object.keys(crumbs)) : undefined;
  const crumbLabel = crumbKey ? crumbs?.[crumbKey] : undefined;
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
        className={`fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r border-line bg-surface transition-[transform,visibility] duration-200 motion-reduce:transition-none ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        } ${collapsed ? "lg:invisible lg:-translate-x-full" : "lg:visible lg:translate-x-0"}`}
      >
        <nav aria-label="Điều hướng chính" className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-header shrink-0 items-center justify-between border-b border-line-soft px-4">
            <Link to="/" aria-label="Thư viện, về trang chủ" className="no-underline">
              <Logo size={30} />
            </Link>
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setOpen(false)}
              className="grid size-7 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-muted hover:bg-subtle lg:hidden"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Thu gọn menu"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(true)}
              className="hidden size-7 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary lg:grid"
            >
              <PanelLeftClose size={16} strokeWidth={1.75} />
            </button>
          </div>

          <ul className="m-0 flex-1 list-none overflow-y-auto px-2.5 pt-2 pb-3">
            {items.map((l, i) => {
              const newGroup = l.group && l.group !== items[i - 1]?.group;
              const inSection = l.children ? (active ? active.parent === l : l.href === currentHref) : active?.href === l.href;
              // Mặc định mở hết mọi nhóm; chỉ thu gọn khi người dùng tự bấm nút cha.
              const expanded = l.children ? (toggled[l.href] ?? true) : false;
              const icon = (
                <span
                  className={`grid size-5 shrink-0 place-items-center transition-colors motion-reduce:transition-none ${
                    inSection ? "text-primary" : "text-muted group-hover:text-primary"
                  }`}
                >
                  {ICONS[l.href] ?? menuIcon(l.icon) ?? <LayoutGrid {...ICON_PROPS} />}
                </span>
              );
              const rowClass = `${NAV_ROW} min-h-8 py-1 text-body ${
                inSection && !l.children ? NAV_ACTIVE : inSection ? "font-semibold text-primary hover:bg-subtle" : "font-medium text-ink hover:bg-subtle"
              }`;
              return (
                <Fragment key={l.href}>
                  {newGroup && (
                    <li aria-hidden className="mt-3 mb-1 px-2.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                      {l.group}
                    </li>
                  )}
                  <li className="relative mb-px">
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
                            size={14}
                            strokeWidth={1.75}
                            aria-hidden
                            className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        <ul id={groupId(l.href)} hidden={!expanded} className="m-0 mt-px mb-1 ml-[18px] list-none border-l border-line p-0 pl-2">
                          {l.children.map((c) => {
                            const on = active?.href === c.href;
                            return (
                              <li key={c.href} className="mb-px">
                                <Link
                                  to={c.href}
                                  aria-current={on ? (active.exact ? "page" : "true") : undefined}
                                  className={`${NAV_ROW} min-h-8 py-1 text-body ${
                                    on ? NAV_ACTIVE_CHILD : "font-medium text-muted hover:bg-subtle hover:text-ink"
                                  }`}
                                >
                                  {c.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <Link
                        to={l.href}
                        aria-current={inSection ? (active?.exact ? "page" : "true") : undefined}
                        className={rowClass}
                      >
                        {icon}
                        {l.label}
                      </Link>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>

          {!user && (
          <div className="shrink-0 border-t border-line p-4">
              <Link
                to="/login"
                className="flex h-8 items-center justify-center gap-2 rounded-control bg-primary px-3 text-body font-medium text-white no-underline hover:bg-primary-hover"
              >
                <LogIn size={16} strokeWidth={1.75} aria-hidden />
                Đăng nhập
              </Link>
          </div>
          )}
        </nav>
      </aside>

      <div className={`flex min-h-screen flex-col transition-[padding] duration-200 motion-reduce:transition-none ${collapsed ? "lg:pl-0" : "lg:pl-sidebar"}`}>
        <header className="sticky top-0 z-20 flex h-header shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-5">
          <button
            type="button"
            aria-label="Mở menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="grid size-8 cursor-pointer place-items-center rounded-control border border-line bg-surface text-ink hover:bg-subtle lg:hidden"
          >
            <Menu size={16} strokeWidth={1.75} />
          </button>
          {/* Sidebar thu gọn là ẩn hẳn, nên nút mở lại phải nằm ngoài sidebar; khi sidebar đang hiện, nút toggle nằm cạnh logo. */}
          {collapsed && (
            <button
              type="button"
              aria-label="Mở rộng menu"
              aria-expanded={false}
              onClick={() => setCollapsed(false)}
              className="hidden size-9 cursor-pointer place-items-center rounded-control border border-line bg-surface text-muted hover:bg-subtle hover:text-ink lg:grid"
            >
              <PanelLeftOpen size={16} strokeWidth={1.75} />
            </button>
          )}
          <ol className="m-0 flex min-w-0 list-none items-center gap-1.5 overflow-hidden p-0 text-body whitespace-nowrap text-muted">
            <li className="hidden sm:block">
              <Link to="/" className="font-medium text-muted no-underline hover:text-primary">
                Trang chủ
              </Link>
            </li>
            {parentLabel && parentLabel !== currentLabel && (
              <>
                <li aria-hidden className="hidden place-items-center text-faint sm:grid">
                  <ChevronRight size={14} strokeWidth={2} />
                </li>
                <li className="hidden sm:block">{parentLabel}</li>
              </>
            )}
            {currentLabel && path !== "/" && (
              <>
                <li aria-hidden className="hidden place-items-center text-faint sm:grid">
                  <ChevronRight size={14} strokeWidth={2} />
                </li>
                <li aria-current="page" className="font-semibold text-ink">
                  {currentLabel}
                </li>
              </>
            )}
          </ol>
          {user && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <QuickSearch items={items} />
              {platformAdmin ? <ActingTenantPicker actingTenantId={tenantId} /> : <TenantSwitcher tenantId={tenantId} />}
              <NotificationBell userId={user.id} />
              <UserMenu user={user} tenantId={tenantId} />
            </div>
          )}
        </header>

        <main className="w-full min-w-0 flex-1 p-4 pb-10 sm:p-page">{children}</main>
      </div>
    </div>
  );
}
