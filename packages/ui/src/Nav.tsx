import type { ReactNode } from "react";
import { canSeeLink, getNavLinks, type NavLink } from "./nav-links";
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
  session,
  links = getNavLinks(),
  crumb,
  children,
}: {
  /** Đường dẫn của mục đang mở, ví dụ "/catalog". */
  current: string;
  session?: NavSession | null;
  links?: NavLink[];
  /** Tên trang trên breadcrumb khi trang không nằm trong sidebar (hồ sơ, thông báo). */
  crumb?: string;
  children: ReactNode;
}) {
  const items = links.filter((l) => canSeeLink(l, session)).map(({ href, label, group }) => ({ href, label, group }));
  return (
    <ShellFrame
      items={items}
      current={current}
      crumb={crumb}
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
