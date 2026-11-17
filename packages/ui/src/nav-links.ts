import { PERMISSIONS } from "@mfe/api/client";

export type NavChild = {
  href: string;
  label: string;
  /** Có khai báo thì chỉ hiện mục khi người dùng có ÍT NHẤT MỘT trong các khóa (any-of). Rỗng/không khai báo = không cần khóa. */
  permission?: string | string[];
};

export type NavLink = NavChild & {
  /** Tên nhóm hiện làm nhãn nhỏ phía trên các mục liền nhau cùng nhóm trong sidebar. */
  group?: string;
  /**
   * Mục con (tùy chọn). Có children thì mục cha là nhóm mở/thu gọn: chỉ hiện khi còn ít nhất một mục con thấy được;
   * nếu không còn mục con nào mà cha tự khai báo `permission` và người dùng có quyền đó thì cha hiện như link thường.
   */
  children?: NavChild[];
};

/** Mục hiện khi: không cần khóa, hoặc là quản trị viên, hoặc có ít nhất một khóa. */
export function canSeeLink(l: NavChild, s?: { admin?: boolean; permissions: string[] } | null): boolean {
  const keys = l.permission == null ? [] : Array.isArray(l.permission) ? l.permission : [l.permission];
  return keys.length === 0 || s?.admin === true || keys.some((k) => s?.permissions.includes(k));
}

/** Kết quả lọc theo quyền: mục cha (nếu có children) chỉ mang các mục con thấy được. */
export type VisibleNavLink = { href: string; label: string; group?: string; children?: { href: string; label: string }[] };

export function visibleNav(
  links: NavLink[],
  s?: { admin?: boolean; permissions: string[] } | null,
): VisibleNavLink[] {
  const out: VisibleNavLink[] = [];
  for (const l of links) {
    if (!l.children?.length) {
      if (canSeeLink(l, s)) out.push({ href: l.href, label: l.label, group: l.group });
      continue;
    }
    const children = l.children.filter((c) => canSeeLink(c, s)).map(({ href, label }) => ({ href, label }));
    if (children.length > 0) out.push({ href: l.href, label: l.label, group: l.group, children });
    else if (l.permission != null && canSeeLink(l, s)) out.push({ href: l.href, label: l.label, group: l.group });
  }
  return out;
}

// `/profile`, `/notifications` không vào sidebar: chúng nằm trong menu người dùng và chuông thông báo.
export const DEFAULT_NAV_LINKS: NavLink[] = [
  { href: "/", label: "Trang chủ" },
  {
    href: "/catalog",
    label: "Sách",
    group: "Nghiệp vụ",
    children: [
      { href: "/catalog", label: "Danh sách sách", permission: PERMISSIONS.BOOK_SEARCH },
      { href: "/catalog/barcode", label: "Tra mã vạch", permission: PERMISSIONS.COPY_BY_BARCODE },
      { href: "/catalog/books/new", label: "Thêm sách", permission: PERMISSIONS.BOOK_CREATE },
    ],
  },
  {
    href: "/circulation",
    label: "Mượn trả",
    group: "Nghiệp vụ",
    children: [
      { href: "/circulation/borrow", label: "Lập phiếu mượn", permission: PERMISSIONS.BORROW_BOOK },
      { href: "/circulation/return", label: "Nhận trả sách", permission: PERMISSIONS.RETURN_BOOK },
      {
        href: "/circulation/borrowings",
        label: "Tra phiếu mượn",
        permission: [PERMISSIONS.BORROW_BOOK, PERMISSIONS.RETURN_BOOK, PERMISSIONS.RENEW, PERMISSIONS.BORROWING_SEARCH],
      },
      { href: "/circulation/reservations", label: "Đặt trước", permission: PERMISSIONS.RESERVATION_MINE },
      {
        href: "/circulation/fines",
        label: "Phạt",
        permission: [PERMISSIONS.FINE_BY_READER, PERMISSIONS.FINE_COLLECT, PERMISSIONS.RESERVATION_MINE],
      },
    ],
  },
  {
    href: "/admin",
    label: "Quản trị",
    group: "Hệ thống",
    children: [
      { href: "/admin/users", label: "Người dùng", permission: PERMISSIONS.USER_SEARCH },
      { href: "/admin/roles", label: "Vai trò và quyền", permission: PERMISSIONS.LIST_ROLES },
      { href: "/admin/departments", label: "Phòng ban", permission: PERMISSIONS.DEPT_TREE },
      { href: "/admin/audit-logs", label: "Nhật ký hoạt động", permission: PERMISSIONS.AUDIT_SEARCH },
    ],
  },
];

const validPermission = (p: unknown) =>
  p === undefined || typeof p === "string" || (Array.isArray(p) && p.every((x) => typeof x === "string"));

const validChild = (l: unknown): boolean => {
  const c = l as NavChild | null;
  return typeof c?.href === "string" && typeof c?.label === "string" && validPermission(c?.permission);
};

/**
 * Danh sách link đọc lúc chạy từ biến môi trường MFE_NAV_LINKS (JSON mảng NavLink; `children` là tùy chọn, giá trị phẳng kiểu cũ vẫn dùng được),
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
        (l) => validChild(l) && (l.children === undefined || (Array.isArray(l.children) && l.children.every(validChild))),
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
