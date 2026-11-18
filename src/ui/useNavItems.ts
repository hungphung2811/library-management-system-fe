import { useEffect, useMemo } from "react";
import { matchRoutes } from "react-router";
import { useApi } from "@/api";
import { PERMISSIONS } from "@/api/permissions";
import { router } from "@/routes/router";
import { DEFAULT_NAV_LINKS, visibleNav, type VisibleNavLink } from "./nav-links";

/** Nút của GET /api/menus/me (BE đã lọc theo quyền, module và bỏ mục tắt). */
export type MenuNode = {
  id: string;
  code: string;
  label: string;
  path?: string | null;
  icon?: string | null;
  children?: MenuNode[];
};

type NavSession = { admin?: boolean; platformAdmin?: boolean; tenantId?: string; permissions: string[]; modules?: string[] };

/** Mọi mục có path trong nhánh (kể cả cháu): sidebar chỉ có hai cấp nên nhánh sâu hơn được làm phẳng. */
function leaves(n: MenuNode): { href: string; label: string }[] {
  const self = n.path ? [{ href: n.path, label: n.label }] : [];
  return [...self, ...(n.children ?? []).flatMap(leaves)];
}

/** Cây menu của BE thành mục sidebar. Nhóm (path rỗng) lấy href giả `#code` chỉ làm khóa; nhóm không còn mục nào bị bỏ. */
export function menuToNav(nodes: MenuNode[]): VisibleNavLink[] {
  const out: VisibleNavLink[] = [];
  for (const n of nodes) {
    if (!n.children?.length) {
      if (n.path) out.push({ href: n.path, label: n.label, icon: n.icon ?? undefined });
      continue;
    }
    const children = leaves(n);
    if (children.length === 0) continue;
    out.push({ href: n.path ?? `#${n.code}`, label: n.label, icon: n.icon ?? undefined, children });
  }
  return out;
}

const hasHref = (items: VisibleNavLink[], href: string) =>
  items.some((i) => i.href === href || i.children?.some((c) => c.href === href));

/**
 * Trang quản trị menu phải luôn với tới được: menu riêng của đơn vị có thể không chứa /admin/menus, khi đó thêm mục "Menu"
 * vào nhóm có mục /admin/* (nếu có) hoặc thêm cuối sidebar, nhưng chỉ cho người có khóa MENU_LIST (hoặc quản trị viên).
 */
function withMenuAdminLink(items: VisibleNavLink[], s: NavSession): VisibleNavLink[] {
  const can = s.admin === true || s.permissions.includes(PERMISSIONS.MENU_LIST);
  if (!can || hasHref(items, "/admin/menus")) return items;
  const link = { href: "/admin/menus", label: "Menu" };
  const idx = items.findIndex((i) => i.children?.some((c) => c.href.startsWith("/admin")));
  if (idx < 0) return [...items, link];
  return items.map((i, k) => (k === idx ? { ...i, children: [...(i.children ?? []), link] } : i));
}

/** Path của menu không khớp route FE nào (ngoài route bắt mọi đường dẫn `*`). */
function unknownPaths(items: VisibleNavLink[]): string[] {
  const paths = items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]).filter((p) => p.startsWith("/"));
  return paths.filter((p) => {
    const m = matchRoutes(router.routes, p.split(/[?#]/)[0]);
    const last = m?.[m.length - 1]?.route.path;
    return !m || last === "*";
  });
}

/**
 * Nguồn điều hướng của sidebar. Có đơn vị (tenant) và GET /api/menus/me trả menu không rỗng thì dùng menu đó (mục có path
 * không khớp route nào vẫn hiện nhưng ghi cảnh báo console). Rỗng, lỗi hoặc đang tải thì dùng DEFAULT_NAV_LINKS như cũ.
 * Platform admin chưa chọn đơn vị (không có tenantId) dùng danh sách hằng (có mục platformOnly), không gọi API. Platform admin
 * đang làm việc thay một đơn vị (ADR-0016: session có tenantId, `apiFetch` gửi X-Tenant-Id) nhận menu của đơn vị đó, kèm
 * khu "Nền tảng SaaS" để vẫn quản trị được nền tảng.
 */
export function useNavItems(session: NavSession): VisibleNavLink[] {
  const dynamic = !!session.tenantId;
  const q = useApi<MenuNode[]>("/api/menus/me", { enabled: dynamic, retry: false, staleTime: 60_000 });
  const data = q.data;

  const items = useMemo(() => {
    const fallback = visibleNav(DEFAULT_NAV_LINKS, session);
    if (!dynamic || !Array.isArray(data) || data.length === 0) return fallback;
    const fromMenu = menuToNav(data);
    if (fromMenu.length === 0) return fallback;
    const platform = session.platformAdmin ? visibleNav(DEFAULT_NAV_LINKS.filter((l) => l.href === "/platform"), session) : [];
    return [...withMenuAdminLink(fromMenu, session), ...platform];
  }, [dynamic, data, session]);

  const unknown = useMemo(() => (dynamic && Array.isArray(data) && data.length ? unknownPaths(items) : []), [dynamic, data, items]);
  useEffect(() => {
    if (unknown.length) console.warn("[menu] Mục menu trỏ tới đường dẫn chưa có route trong FE:", unknown.join(", "));
  }, [unknown]);

  return items;
}
