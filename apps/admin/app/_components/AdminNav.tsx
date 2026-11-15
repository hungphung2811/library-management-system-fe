import { PERMISSIONS, can, type Session } from "@mfe/api";

const SECTIONS = [
  { href: "/admin/users", label: "Người dùng", key: PERMISSIONS.USER_SEARCH },
  { href: "/admin/roles", label: "Vai trò và quyền", key: PERMISSIONS.LIST_ROLES },
  { href: "/admin/departments", label: "Phòng ban", key: PERMISSIONS.DEPT_TREE },
  { href: "/admin/audit-logs", label: "Nhật ký hoạt động", key: PERMISSIONS.AUDIT_SEARCH },
];

/** Điều hướng giữa các mục quản trị: div thường (AppShell chỉ cho một <nav>); mục không có quyền xem thì ẩn. */
export function AdminNav({ session, current }: { session: Session; current: string }) {
  const items = SECTIONS.filter((s) => can(session, s.key));
  if (items.length === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Các mục quản trị">
      {items.map((s) => {
        const active = current === s.href;
        return (
          // <a> thường: href đã có basePath /admin, next/link sẽ cộng thêm một lần nữa (ra /admin/admin/...).
          <a
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-lg border px-3 py-1.5 text-sm no-underline " +
              (active
                ? "border-brand-600 bg-brand-50 font-medium text-brand-600"
                : "border-line bg-white text-ink hover:border-brand-600")
            }
          >
            {s.label}
          </a>
        );
      })}
    </div>
  );
}
