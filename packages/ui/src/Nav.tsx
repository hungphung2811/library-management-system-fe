import { getNavLinks, type NavLink } from "./nav-links";
import { NavBar } from "./NavBar";

type NavSession = { userId: string; roles?: string[]; permissions: string[] };

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
    .filter((l) => !l.permission || session?.permissions.includes(l.permission))
    .map(({ href, label }) => ({ href, label }));
  return (
    <NavBar
      items={items}
      current={current}
      user={session ? { id: session.userId, role: session.roles?.[0] } : undefined}
    />
  );
}
