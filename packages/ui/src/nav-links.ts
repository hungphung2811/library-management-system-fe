export type NavLink = {
  href: string;
  label: string;
  /** Có khai báo thì chỉ hiện link khi người dùng có permission này. */
  permission?: string;
};

export const DEFAULT_NAV_LINKS: NavLink[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/catalog", label: "Sách" },
  { href: "/circulation", label: "Mượn trả" },
  // Khóa quyền của BE (ADR-0003) = PERMISSIONS.LIST_ROLES trong @mfe/api; admin=true thì luôn thấy.
  { href: "/admin", label: "Quản trị", permission: "AccessControlController/listRoles" },
];

/**
 * Danh sách link đọc lúc chạy từ biến môi trường MFE_NAV_LINKS (JSON mảng NavLink),
 * nên thêm/bớt zone chỉ cần đổi cấu hình, không phải sửa code package chung.
 */
export function getNavLinks(): NavLink[] {
  const raw = process.env.MFE_NAV_LINKS;
  if (!raw) return DEFAULT_NAV_LINKS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((l) => typeof l?.href === "string" && typeof l?.label === "string")
    ) {
      return parsed as NavLink[];
    }
  } catch {
    /* rơi xuống mặc định */
  }
  console.warn("MFE_NAV_LINKS không hợp lệ, dùng danh sách mặc định");
  return DEFAULT_NAV_LINKS;
}
