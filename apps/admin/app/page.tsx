import { Alert, AppShell, Card, PageHeader, Table } from "@mfe/ui";
import { PERMISSIONS, can, gatewayFetch, GatewayError, requireSession } from "@mfe/api";

type Role = { id: string; name: string };

export default async function AdminPage() {
  const s = await requireSession("/admin");
  const canListRoles = can(s, PERMISSIONS.LIST_ROLES);
  let roles: Role[] = [];
  let error: string | null = null;

  if (canListRoles) {
    try {
      roles = await gatewayFetch<Role[]>("/api/roles");
    } catch (e) {
      error = e instanceof GatewayError ? `${e.status}: ${e.message}` : "Không gọi được gateway";
    }
  }

  return (
    <AppShell current="/admin" session={s}>
      <PageHeader title="Quản trị" description={`Roles của bạn: ${s.roles.join(", ") || "-"}`} />
      {!canListRoles && (
        <Alert type="warning" showIcon title={`Cần quyền ${PERMISSIONS.LIST_ROLES} để xem danh sách role.`} />
      )}
      {error && <Alert type="error" showIcon title={error} className="mb-5" />}
      {canListRoles && !error && (
        <Card title="Danh sách role" styles={{ body: { padding: 0 } }} className="overflow-hidden">
          <Table
            rowKey="id"
            dataSource={roles}
            pagination={false}
            columns={[{ title: "Role", dataIndex: "name" }]}
            locale={{ emptyText: "Chưa có role nào" }}
          />
        </Card>
      )}
    </AppShell>
  );
}
