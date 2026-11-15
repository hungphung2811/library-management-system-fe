import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { Alert, Card, DataTable, ErrorPanel, PageHeader, Text } from "@mfe/ui";
import { load } from "./data";
import type { RoleView } from "./types";

const SHORTCUTS = [
  { href: "/admin/users", title: "Người dùng", desc: "Tạo người dùng, gán vai trò, quản lý thẻ độc giả.", key: PERMISSIONS.USER_SEARCH },
  { href: "/admin/roles", title: "Vai trò và quyền", desc: "Xem vai trò, gán hoặc gỡ quyền.", key: PERMISSIONS.LIST_ROLES },
  { href: "/admin/departments", title: "Phòng ban", desc: "Cây phòng ban của đơn vị.", key: PERMISSIONS.DEPT_TREE },
  { href: "/admin/audit-logs", title: "Nhật ký hoạt động", desc: "Các sự kiện nghiệp vụ được ghi lại.", key: PERMISSIONS.AUDIT_SEARCH },
];

export default async function AdminPage() {
  const s = await requireSession("/admin");
  const cards = SHORTCUTS.filter((c) => can(s, c.key));
  const canListRoles = can(s, PERMISSIONS.LIST_ROLES);
  const roles = canListRoles ? await load<RoleView[]>("/api/roles") : null;

  return (
    <>
      <PageHeader title="Quản trị" description="Người dùng, vai trò, phòng ban và nhật ký hệ thống." />
      <div className="flex max-w-[1200px] flex-col gap-5">
        <Text type="secondary">Vai trò của bạn: {s.roles.join(", ") || "—"}</Text>

        {cards.length === 0 && (
          <Alert
            type="warning"
            showIcon
            title={`Cần quyền ${PERMISSIONS.LIST_ROLES} (hoặc một quyền quản trị khác) để dùng khu vực này.`}
          />
        )}

        {cards.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((c) => (
              <a
                key={c.href}
                href={c.href}
                className="block min-h-16 rounded-xl border border-line bg-white p-4 no-underline hover:border-brand-600"
              >
                <div className="font-medium text-ink">{c.title}</div>
                <div className="text-sm text-muted">{c.desc}</div>
              </a>
            ))}
          </div>
        )}

        {roles && (
          <Card title="Vai trò" styles={{ body: { padding: 0 } }} className="overflow-hidden">
            {roles.error ? (
              <div className="p-4">
                <ErrorPanel error={roles.error} retryHref="/admin" />
              </div>
            ) : (
              <DataTable
                rowKey="id"
                rows={roles.data}
                columns={[{ key: "name", title: "Vai trò", dataIndex: "name", kind: "link", href: "/admin/roles/{id}" }]}
                empty={{ title: "Chưa có vai trò nào." }}
              />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
