import type { ReactNode } from "react";
import { getNavLinks, visibleNav, type NavLink } from "./nav-links";
import { ShellFrame } from "./ShellFrame";

type NavSession = {
  userId: string;
  username?: string;
  roles?: string[];
  permissions: string[];
  /** Quản trị viên thấy mọi link, không cần permission. */
  admin?: boolean;
  /** Đơn vị hiện tại (claim tenantId), để menu người dùng đánh dấu đơn vị đang làm việc. */
  tenantId?: string;
};

/**
 * Khung ứng dụng (sidebar + thanh trên + vùng nội dung). Server component: lọc link theo permission
 * (đọc cấu hình lúc chạy; any-of nếu permission là mảng) rồi giao cho ShellFrame (client) vẽ.
 * Mọi trang có đăng nhập bọc nội dung bằng thành phần này.
 */
export function AppShell({
  current,
  basePath = "",
  session,
  links = getNavLinks(),
  crumb,
  crumbs,
  children,
}: {
  /**
   * Đường dẫn của mục đang mở ("/admin"). Bỏ trống thì ShellFrame tự suy ra từ URL (dùng ở shell);
   * zone admin có basePath nên truyền sẵn, vì usePathname() của zone không gồm basePath.
   */
  current?: string;
  /** basePath của zone ("/admin"); để trống ở shell. ShellFrame ghép lại để so khớp mục sidebar. */
  basePath?: string;
  session?: NavSession | null;
  links?: NavLink[];
  /** Tên trang trên breadcrumb khi trang không nằm trong sidebar (hồ sơ, thông báo). */
  crumb?: string;
  /** Tên breadcrumb theo đường dẫn, cho layout chung (ví dụ { "/profile": "Hồ sơ" }). */
  crumbs?: Record<string, string>;
  children: ReactNode;
}) {
  const items = visibleNav(links, session);
  return (
    <ShellFrame
      items={items}
      current={current}
      basePath={basePath}
      crumb={crumb}
      crumbs={crumbs}
      tenantId={session?.tenantId}
      user={
        session
          ? { id: session.userId, name: session.username ?? session.userId.slice(0, 8), role: session.roles?.[0] }
          : undefined
      }
    >
      {children}
    </ShellFrame>
  );
}
