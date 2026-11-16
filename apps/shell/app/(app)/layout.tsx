import type { ReactNode } from "react";
import { getSession } from "@mfe/api";
import { AppShell } from "@mfe/ui";

// Tên breadcrumb cho trang không nằm trong sidebar. `current` không truyền: ShellFrame tự suy ra từ URL.
const CRUMBS = { "/profile": "Hồ sơ", "/notifications": "Thông báo" };

// Link trong sidebar thuộc cùng app này thì chuyển trang phía client (giữ sidebar). /admin là zone riêng nên KHÔNG có ở đây.
const CLIENT_HREFS = ["/", "/catalog", "/circulation", "/profile", "/notifications"];

/**
 * Khung dùng chung cho mọi trang đã/đang vào hệ thống trong group. Chỉ đọc phiên để vẽ sidebar, KHÔNG redirect:
 * layout không chạy lại khi điều hướng client và trang "/" cho khách xem. Việc chặn do requireSession ở từng trang.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await getSession();
  return (
    <AppShell session={s} crumbs={CRUMBS} clientHrefs={CLIENT_HREFS}>
      {children}
    </AppShell>
  );
}
