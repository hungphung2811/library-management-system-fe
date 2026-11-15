import { PERMISSIONS } from "@mfe/api/client";

export type NavLink = {
  href: string;
  label: string;
  /** Có khai báo thì chỉ hiện link khi người dùng có ÍT NHẤT MỘT trong các khóa (any-of). Rỗng/không khai báo = không cần khóa. */
  permission?: string | string[];
  /** Tên nhóm hiện làm nhãn nhỏ phía trên các mục liền nhau cùng nhóm trong sidebar. */
  group?: string;
};

/** Link hiện khi: không cần khóa, hoặc là quản trị viên, hoặc có ít nhất một khóa. */
export function canSeeLink(l: NavLink, s?: { admin?: boolean; permissions: string[] } | null): boolean {
  const keys = l.permission == null ? [] : Array.isArray(l.permission) ? l.permission : [l.permission];
  return keys.length === 0 || s?.admin === true || keys.some((k) => s?.permissions.includes(k));
}

// `/profile`, `/notifications` không vào sidebar: chúng nằm trong menu người dùng và chuông thông báo.
export const DEFAULT_NAV_LINKS: NavLink[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/catalog", label: "Sách", group: "Nghiệp vụ", permission: PERMISSIONS.BOOK_SEARCH },
  {
    href: "/circulation",
    label: "Mượn trả",
    group: "Nghiệp vụ",
    permission: [PERMISSIONS.BORROW_BOOK, PERMISSIONS.RETURN_BOOK, PERMISSIONS.RESERVATION_MINE],
  },
  {
    href: "/admin",
    label: "Quản trị",
    group: "Hệ thống",
    permission: [PERMISSIONS.LIST_ROLES, PERMISSIONS.USER_SEARCH, PERMISSIONS.DEPT_TREE, PERMISSIONS.AUDIT_SEARCH],
  },
];

const validPermission = (p: unknown) =>
  p === undefined || typeof p === "string" || (Array.isArray(p) && p.every((x) => typeof x === "string"));

/**
 * Danh sách link đọc lúc chạy từ biến môi trường MFE_NAV_LINKS (JSON mảng NavLink),
 * nên thêm/bớt zone chỉ cần đổi cấu hình, không phải sửa code package chung.
 * Đã đặt MFE_NAV_LINKS thì danh sách mặc định trong code KHÔNG có hiệu lực.
 */
export function getNavLinks(): NavLink[] {
  const raw = process.env.MFE_NAV_LINKS;
  if (!raw) return DEFAULT_NAV_LINKS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (l) => typeof l?.href === "string" && typeof l?.label === "string" && validPermission(l?.permission),
      )
    ) {
      return parsed as NavLink[];
    }
  } catch {
    /* rơi xuống mặc định */
  }
  console.warn("MFE_NAV_LINKS không hợp lệ, dùng danh sách mặc định");
  return DEFAULT_NAV_LINKS;
}
