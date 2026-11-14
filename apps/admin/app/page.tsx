import { Alert, Card, Nav, Page, PageHeader, Table } from "@mfe/ui";
import { can, gatewayFetch, GatewayError, requireSession } from "@mfe/api";

type Role = { id: string; name: string };

export default async function AdminPage() {
  const s = await requireSession("/admin");
  let roles: Role[] = [];
  let error: string | null = null;

  if (can(s, "ROLE_VIEW")) {
    try {
      roles = await gatewayFetch<Role[]>("/api/roles");
    } catch (e) {
      error = e instanceof GatewayError ? `${e.status}: ${e.message}` : "Không gọi được gateway";
    }
  }

  return (
    <>
      <Nav current="/admin" session={s} />
      <Page>
        <PageHeader title="Quản trị" description={`Roles của bạn: ${s.roles.join(", ") || "-"}`} />
        {!can(s, "ROLE_VIEW") && (
          <Alert type="warning" showIcon title="Cần quyền ROLE_VIEW để xem danh sách role." />
        )}
        {error && <Alert type="error" showIcon title={error} className="mb-4" />}
        {can(s, "ROLE_VIEW") && !error && (
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
      </Page>
    </>
  );
}
