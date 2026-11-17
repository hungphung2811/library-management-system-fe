import { PERMISSIONS } from "@/api/permissions";

export type NavChild = {
  href: string;
  label: string;
  /** Có khai báo thì chỉ hiện mục khi người dùng có ÍT NHẤT MỘT trong các khóa (any-of). Rỗng/không khai báo = không cần khóa. */
  permission?: string | string[];
  /** Chỉ platform admin (claim platformAdmin, không có tenantId) thấy mục này; không có khóa quyền động để gán. */
  platformOnly?: boolean;
  /** Ẩn với platform admin không có tenant (mục chỉ có nghĩa trong một đơn vị, ví dụ phiếu của chính mình). */
  tenantOnly?: boolean;
  /** Module của đơn vị phải bật mới hiện mục này (claim `modules`); không khai báo = luôn hiện. Platform admin không bị chặn. */
  module?: "LENDING" | "SALES";
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
type NavSession = { admin?: boolean; platformAdmin?: boolean; permissions: string[]; modules?: string[] };

export function canSeeLink(l: NavChild, s?: NavSession | null): boolean {
  if (l.platformOnly) return s?.platformAdmin === true;
  if (l.tenantOnly && s?.platformAdmin === true) return false;
  if (l.module && s?.platformAdmin !== true && !(s?.modules ?? ["LENDING"]).includes(l.module)) return false;
  const keys = l.permission == null ? [] : Array.isArray(l.permission) ? l.permission : [l.permission];
  return keys.length === 0 || s?.admin === true || keys.some((k) => s?.permissions.includes(k));
}

/** Kết quả lọc theo quyền: mục cha (nếu có children) chỉ mang các mục con thấy được. */
/** `icon`: tên icon từ menu động (GET /api/menus/me); menu mặc định không dùng, sidebar tra icon theo href. */
export type VisibleNavLink = { href: string; label: string; group?: string; icon?: string; children?: { href: string; label: string }[] };

export function visibleNav(links: NavLink[], s?: NavSession | null): VisibleNavLink[] {
  const out: VisibleNavLink[] = [];
  for (const l of links) {
    if (!l.children?.length) {
      if (canSeeLink(l, s)) out.push({ href: l.href, label: l.label, group: l.group });
      continue;
    }
    if (l.module && !canSeeLink({ href: l.href, label: l.label, module: l.module }, s)) continue;
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
      {
        href: "/circulation/return",
        label: "Nhận trả sách",
        permission: [PERMISSIONS.RETURN_BOOK, PERMISSIONS.BORROWING_RETURN_COPY, PERMISSIONS.BORROWING_REPORT_LOST],
      },
      // GET /api/borrowings/mine chỉ cần đăng nhập (không có khóa) nên mục này hiện cho mọi người dùng.
      { href: "/circulation/mine", label: "Phiếu của tôi", tenantOnly: true },
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
    href: "/sales",
    label: "Bán hàng",
    group: "Nghiệp vụ",
    module: "SALES",
    children: [
      { href: "/sales/pos", label: "Bán tại quầy", module: "SALES", permission: [PERMISSIONS.POS_ORDER_CREATE, PERMISSIONS.POS_ORDER_CREATE_DISCOUNTED] },
      { href: "/sales/orders", label: "Đơn hàng", module: "SALES", permission: PERMISSIONS.SALES_ORDER_SEARCH },
      { href: "/sales/refunds", label: "Hoàn tiền", module: "SALES", permission: PERMISSIONS.REFUND_SEARCH },
      { href: "/sales/audit", label: "Nhật ký", module: "SALES", permission: PERMISSIONS.SALES_AUDIT_SEARCH },
      { href: "/sales/stock", label: "Tồn kho", module: "SALES", permission: PERMISSIONS.STOCK_SEARCH },
      { href: "/sales/receipts", label: "Phiếu nhập kho", module: "SALES", permission: PERMISSIONS.RECEIPT_SEARCH },
      { href: "/sales/suppliers", label: "Nhà cung cấp", module: "SALES", permission: PERMISSIONS.SUPPLIER_SEARCH },
      { href: "/sales/settings", label: "Cấu hình bán hàng", module: "SALES", permission: PERMISSIONS.SALES_SETTINGS_VIEW },
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
      { href: "/admin/menus", label: "Menu", permission: PERMISSIONS.MENU_LIST },
      { href: "/admin/contract", label: "Hợp đồng", permission: [PERMISSIONS.CONTRACT_LIST, PERMISSIONS.CONTRACT_CURRENT], tenantOnly: true },
      { href: "/admin/storefront-origins", label: "Website", permission: PERMISSIONS.STOREFRONT_ORIGIN_LIST, tenantOnly: true, module: "SALES" },
    ],
  },
  {
    href: "/platform",
    label: "Nền tảng SaaS",
    group: "Hệ thống",
    children: [
      { href: "/platform/tenants", label: "Đơn vị (tenant)", platformOnly: true },
      { href: "/platform/contracts", label: "Hợp đồng", platformOnly: true },
      { href: "/platform/organizations", label: "Tổ chức", platformOnly: true },
      { href: "/platform/cms-pages", label: "Trang website", platformOnly: true },
      { href: "/platform/contact-requests", label: "Yêu cầu liên hệ", platformOnly: true },
    ],
  },
];
