import { getNavLinks, type NavLink } from "./nav-links";
import { NavBar } from "./NavBar";

type NavSession = {
  userId: string;
  username?: string;
  roles?: string[];
  permissions: string[];
  /** Quản trị viên thấy mọi link, không cần permission. */
  admin?: boolean;
};

/**
 * Server component: lọc link theo permission (đọc cấu hình lúc chạy) rồi giao cho NavBar (client) vẽ.
 */
export function Nav({
  current,
  session,
  links = getNavLinks(),
}: {
  /** Đường dẫn của mục đang mở, ví dụ "/catalog". */
  current: string;
  session?: NavSession | null;
  links?: NavLink[];
}) {
  const items = links
    .filter((l) => !l.permission || session?.admin || session?.permissions.includes(l.permission))
    .map(({ href, label }) => ({ href, label }));
  return (
    <NavBar
      items={items}
      current={current}
      user={
        session
          ? { id: session.userId, name: session.username ?? session.userId.slice(0, 8), role: session.roles?.[0] }
          : undefined
      }
    />
  );
}
