import type { ReactNode } from "react";
import { getNavLinks, type NavLink } from "./nav-links";
import { ShellFrame } from "./ShellFrame";

type NavSession = {
  userId: string;
  username?: string;
  roles?: string[];
  permissions: string[];
  /** Quản trị viên thấy mọi link, không cần permission. */
  admin?: boolean;
};

/**
 * Khung ứng dụng (sidebar + thanh trên + vùng nội dung). Server component: lọc link theo permission
 * (đọc cấu hình lúc chạy) rồi giao cho ShellFrame (client) vẽ. Mọi trang có đăng nhập bọc nội dung bằng thành phần này.
 */
export function AppShell({
  current,
  session,
  links = getNavLinks(),
  children,
}: {
  /** Đường dẫn của mục đang mở, ví dụ "/catalog". */
  current: string;
  session?: NavSession | null;
  links?: NavLink[];
  children: ReactNode;
}) {
  const items = links
    .filter((l) => !l.permission || session?.admin || session?.permissions.includes(l.permission))
    .map(({ href, label, group }) => ({ href, label, group }));
  return (
    <ShellFrame
      items={items}
      current={current}
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
