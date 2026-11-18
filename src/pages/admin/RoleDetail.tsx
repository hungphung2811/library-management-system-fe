import { Link, useParams } from "react-router";
import { PERMISSIONS, can, toErrorInfo, useApi, useSession } from "@/api";
import { Breadcrumb, Button, ErrorPanel, NoPermission, PageHeader, PageSkeleton, Result, useDetailModal } from "@/ui";
import { RoleActions } from "./_components/RoleActions";
import { RolePermissions } from "./_components/RolePermissions";
import { isAdminRole, type PermissionView, type RoleView } from "./_lib/types";

export default function RoleDetailPage() {
  const { id = "" } = useParams();
  const s = useSession();
  const modal = useDetailModal();
  const inModal = !!modal;
  const canView = can(s, PERMISSIONS.ROLE_VIEW);
  const canCatalog = can(s, PERMISSIONS.PERMISSION_LIST);

  const role = useApi<RoleView>(canView ? `/api/roles/${encodeURIComponent(id)}` : null);
  const catalog = useApi<PermissionView[]>(canView && canCatalog ? "/api/permissions" : null);

  if (!canView) return <NoPermission feature="Chi tiết vai trò" />;
  if (role.isPending) return <PageSkeleton variant="form" />;
  if (role.isError) {
    const info = toErrorInfo(role.error);
    return info.status === 404 ? (
      <Result
        status="404"
        title="Không tìm thấy vai trò"
        extra={
          inModal ? (
            <Button onClick={modal.close}>Đóng</Button>
          ) : (
            <Link to="/admin/roles">
              <Button>Về danh sách vai trò</Button>
            </Link>
          )
        }
      />
    ) : (
      <ErrorPanel error={info} onRetry={() => void role.refetch()} />
    );
  }

  const r = role.data;
  return (
    <div className="flex flex-col gap-4">
      {!inModal && (
        <Breadcrumb
          items={[
            { title: <Link to="/admin">Quản trị</Link> },
            { title: <Link to="/admin/roles">Vai trò và quyền</Link> },
            { title: r.name },
          ]}
        />
      )}
      <PageHeader
        title={r.name}
        description={r.description}
        actions={
          <RoleActions
            role={r}
            isAdminRole={isAdminRole(r)}
            sessionAdmin={s.admin}
            canUpdate={can(s, PERMISSIONS.ROLE_UPDATE)}
            canDelete={can(s, PERMISSIONS.ROLE_DELETE)}
          />
        }
      />
      <RolePermissions
        roleId={r.id}
        isAdmin={isAdminRole(r)}
        granted={r.permissions ?? []}
        catalog={catalog.data ?? null}
        catalogLoading={canCatalog && catalog.isPending}
        catalogError={catalog.isError ? toErrorInfo(catalog.error) : null}
        canGrant={can(s, PERMISSIONS.ROLE_GRANT)}
        canRevoke={can(s, PERMISSIONS.ROLE_REVOKE)}
        canCreatePermission={can(s, PERMISSIONS.PERMISSION_CREATE)}
      />
    </div>
  );
}
