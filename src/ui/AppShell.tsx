import { Outlet } from "react-router";
import { useSession } from "@/auth/AuthProvider";
import { useNavItems } from "./useNavItems";
import { ShellFrame } from "./ShellFrame";

// Tên breadcrumb cho trang không nằm trong sidebar (khớp theo đường dẫn dài nhất). Trang trong sidebar tự suy ra từ URL.
const CRUMBS = { "/profile": "Hồ sơ", "/notifications": "Thông báo" };

/**
 * Khung ứng dụng (sidebar + thanh trên + vùng nội dung) là layout route: bọc mọi trang đã đăng nhập bằng `<Outlet />`.
 * Lọc link theo quyền của session bằng đúng quy tắc `visibleNav`; chỉ có một danh sách link (DEFAULT_NAV_LINKS).
 */
export function AppShell() {
  const session = useSession();
  const items = useNavItems(session);
  return (
    <ShellFrame
      items={items}
      crumbs={CRUMBS}
      tenantId={session.tenantId}
      platformAdmin={session.platformAdmin}
      user={{ id: session.userId, name: session.username, role: session.roles[0] }}
    >
      <Outlet />
    </ShellFrame>
  );
}
