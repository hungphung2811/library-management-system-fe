import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { Alert, Card, DataTable, ErrorPanel, PageHeader, Text } from "@mfe/ui";
import { load } from "./data";
import type { RoleView } from "./types";

export default async function AdminPage() {
  const s = await requireSession("/admin");
  const anyAdmin = [PERMISSIONS.USER_SEARCH, PERMISSIONS.LIST_ROLES, PERMISSIONS.DEPT_TREE, PERMISSIONS.AUDIT_SEARCH].some((k) => can(s, k));
  const canListRoles = can(s, PERMISSIONS.LIST_ROLES);
  const roles = canListRoles ? await load<RoleView[]>("/api/roles") : null;

  return (
    <>
      <PageHeader title="Quản trị" description="Người dùng, vai trò, phòng ban và nhật ký hệ thống." />
      <div className="flex max-w-[1200px] flex-col gap-5">
        <Text type="secondary">Vai trò của bạn: {s.roles.join(", ") || "—"}</Text>

        {!anyAdmin && (
          <Alert
            type="warning"
            showIcon
            title={`Cần quyền ${PERMISSIONS.LIST_ROLES} (hoặc một quyền quản trị khác) để dùng khu vực này.`}
          />
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
