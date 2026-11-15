import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { DataTable, ErrorPanel, NoPermission, PageHeader } from "@mfe/ui";
import { load } from "../data";
import { isAdminRole, type RoleView } from "../types";
import { CreateRoleButton } from "./_components/CreateRoleButton";

export default async function RolesPage() {
  const s = await requireSession("/admin/roles");
  if (!can(s, PERMISSIONS.LIST_ROLES)) {
    return (
      <>
        <NoPermission feature="Vai trò và quyền" />
      </>
    );
  }

  const roles = await load<RoleView[]>("/api/roles");
  const rows = (roles.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    type: isAdminRole(r) ? "Quản trị viên" : "Thường",
    count: isAdminRole(r) ? "Toàn quyền" : String(r.permissions?.length ?? 0),
  }));

  return (
    <>
      <PageHeader
        title="Vai trò và quyền"
        description="Vai trò gom các quyền; gán vai trò cho người dùng ở trang người dùng."
        actions={can(s, PERMISSIONS.ROLE_CREATE) ? <CreateRoleButton sessionAdmin={s.admin} /> : undefined}
      />
      <div className="flex max-w-[1200px] flex-col gap-4">
        {roles.error ? (
          <ErrorPanel error={roles.error} retryHref="/admin/roles" />
        ) : (
          <DataTable
            rowKey="id"
            rows={rows}
            mobileTitleKey="name"
            columns={[
              { key: "name", title: "Tên", dataIndex: "name", kind: "link", href: "/admin/roles/{id}" },
              { key: "description", title: "Mô tả", dataIndex: "description" },
              { key: "type", title: "Loại", dataIndex: "type" },
              { key: "count", title: "Số quyền", dataIndex: "count", align: "right" },
            ]}
            empty={{ title: "Chưa có vai trò nào." }}
          />
        )}
      </div>
    </>
  );
}
