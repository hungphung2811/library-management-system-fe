import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { Breadcrumb, Button, ErrorPanel, NoPermission, PageHeader, Result } from "@mfe/ui";
import { AdminNav } from "../../_components/AdminNav";
import { load } from "../../data";
import { isAdminRole, type PermissionView, type RoleView } from "../../types";
import { RoleDetail } from "./RoleDetail";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/admin/roles/${id}`;
  const s = await requireSession(path);

  if (!can(s, PERMISSIONS.ROLE_VIEW)) {
    return (
      <>
        <NoPermission feature="Chi tiết vai trò" />
      </>
    );
  }

  const canCatalog = can(s, PERMISSIONS.PERMISSION_LIST);
  const [role, catalog] = await Promise.all([
    load<RoleView>(`/api/roles/${encodeURIComponent(id)}`),
    canCatalog ? load<PermissionView[]>("/api/permissions") : Promise.resolve(null),
  ]);

  if (role.error) {
    return (
      <>
        {role.error.status === 404 ? (
          <Result
            status="404"
            title="Không tìm thấy vai trò"
            extra={<Button href="/admin/roles">Về danh sách vai trò</Button>}
          />
        ) : (
          <ErrorPanel error={role.error} retryHref={path} />
        )}
      </>
    );
  }

  const r = role.data;
  return (
    <>
      <div className="flex max-w-[1200px] flex-col gap-4">
        <Breadcrumb
          items={[
            { title: "Quản trị", href: "/admin" },
            { title: "Vai trò và quyền", href: "/admin/roles" },
            { title: r.name },
          ]}
        />
        <PageHeader title={r.name} description={r.description} />
        <AdminNav session={s} current="/admin/roles" />
        <RoleDetail
          roleId={r.id}
          isAdmin={isAdminRole(r)}
          granted={r.permissions ?? []}
          catalog={catalog?.data ?? null}
          catalogError={catalog?.error ?? null}
          canGrant={can(s, PERMISSIONS.ROLE_GRANT)}
          canRevoke={can(s, PERMISSIONS.ROLE_REVOKE)}
          canCreatePermission={can(s, PERMISSIONS.PERMISSION_CREATE)}
        />
      </div>
    </>
  );
}
