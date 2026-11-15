import { PERMISSIONS, can, requireSession } from "@mfe/api";
import type { ErrorInfo } from "@mfe/api/client";
import { Breadcrumb, Button, ErrorPanel, NoPermission, PageHeader, Result, StatusTag } from "@mfe/ui";
import { load, qp } from "../../data";
import type { DepartmentView, ReaderProfileView, RoleView, UserAccessView, UserView } from "../../types";
import { UserDetail } from "./UserDetail";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const path = `/admin/users/${id}`;
  const s = await requireSession(path);
  const sp = await searchParams;
  const tab = qp(sp.tab);

  if (!can(s, PERMISSIONS.USER_VIEW)) {
    return (
      <>
        <NoPermission feature="Chi tiết người dùng" />
      </>
    );
  }

  const enc = encodeURIComponent(id);
  const canAccess = can(s, PERMISSIONS.ACCESS_VIEW);
  const canReader = can(s, PERMISSIONS.READER_VIEW);
  const [user, access, roles, reader, depts] = await Promise.all([
    load<UserView>(`/api/users/${enc}`),
    canAccess ? load<UserAccessView>(`/api/access/users/${enc}`) : Promise.resolve(null),
    can(s, PERMISSIONS.LIST_ROLES) ? load<RoleView[]>("/api/roles") : Promise.resolve(null),
    canReader ? load<ReaderProfileView>(`/api/users/${enc}/reader-profile`) : Promise.resolve(null),
    can(s, PERMISSIONS.DEPT_LIST) ? load<DepartmentView[]>("/api/departments") : Promise.resolve(null),
  ]);

  if (user.error) {
    return (
      <>
        {user.error.status === 404 ? (
          <Result
            status="404"
            title="Không tìm thấy người dùng"
            extra={<Button href="/admin/users">Về danh sách người dùng</Button>}
          />
        ) : (
          <ErrorPanel error={user.error} retryHref={path} />
        )}
      </>
    );
  }

  const u = user.data;
  // Hồ sơ độc giả 404 nghĩa là chưa có thẻ, không phải lỗi.
  const readerError: ErrorInfo | null = reader?.error && reader.error.status !== 404 ? reader.error : null;

  return (
    <>
      <div className="flex max-w-[1200px] flex-col gap-4">
        <Breadcrumb
          items={[
            { title: "Quản trị", href: "/admin" },
            { title: "Người dùng", href: "/admin/users" },
            { title: u.fullName },
          ]}
        />
        <PageHeader
          title={u.fullName}
          description={`${u.username} · ${u.email}`}
          actions={<StatusTag domain="user" value={u.status} />}
        />
        <UserDetail
          user={u}
          initialTab={tab === "roles" || tab === "reader" ? tab : "info"}
          departments={depts?.data ? depts.data.map((d) => ({ value: d.id, label: d.name })) : null}
          isSelf={u.id === s.userId}
          sessionAdmin={s.admin}
          canEdit={can(s, PERMISSIONS.USER_UPDATE)}
          canStatus={can(s, PERMISSIONS.USER_STATUS)}
          access={{
            canView: canAccess,
            data: access?.data ?? null,
            error: access?.error ?? null,
            roles: roles?.data ?? null,
            canAssign: can(s, PERMISSIONS.ACCESS_ASSIGN),
            canRevoke: can(s, PERMISSIONS.ACCESS_REVOKE),
          }}
          reader={{
            canView: canReader,
            data: reader?.data ?? null,
            error: readerError,
            canIssue: can(s, PERMISSIONS.READER_ISSUE),
            canRenew: can(s, PERMISSIONS.READER_RENEW),
            canStatus: can(s, PERMISSIONS.READER_STATUS),
          }}
        />
      </div>
    </>
  );
}
