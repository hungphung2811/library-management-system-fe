import { Link, useParams, useSearchParams } from "react-router";
import { PERMISSIONS, can, toErrorInfo, useApi, useSession } from "@/api";
import { Breadcrumb, Button, Card, ErrorPanel, NoPermission, PageHeader, PageSkeleton, Result, StatusTag, Tabs } from "@/ui";
import { AccessTab } from "./_components/AccessTab";
import { ResetPasswordButton } from "./_components/ResetPasswordButton";
import { ReaderTab } from "./_components/ReaderTab";
import { UserInfoTab } from "./_components/UserInfoTab";
import type { DepartmentView, ReaderProfileView, RoleView, UserAccessView, UserView } from "./_lib/types";

type TabKey = "info" | "roles" | "reader";

export default function UserDetailPage() {
  const { id = "" } = useParams();
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const t = sp.get("tab");
  const tab: TabKey = t === "roles" || t === "reader" ? t : "info";

  const enc = encodeURIComponent(id);
  const canView = can(s, PERMISSIONS.USER_VIEW);
  const canAccess = can(s, PERMISSIONS.ACCESS_VIEW);
  const canReader = can(s, PERMISSIONS.READER_VIEW);

  const user = useApi<UserView>(canView ? `/api/users/${enc}` : null);
  const access = useApi<UserAccessView>(canView && canAccess ? `/api/access/users/${enc}` : null);
  const roles = useApi<RoleView[]>(canView && can(s, PERMISSIONS.LIST_ROLES) ? "/api/roles" : null);
  const reader = useApi<ReaderProfileView>(canView && canReader ? `/api/users/${enc}/reader-profile` : null);
  const depts = useApi<DepartmentView[]>(canView && can(s, PERMISSIONS.DEPT_LIST) ? "/api/departments" : null);

  if (!canView) return <NoPermission feature="Chi tiết người dùng" />;
  if (user.isPending) return <PageSkeleton variant="form" />;
  if (user.isError) {
    const info = toErrorInfo(user.error);
    return info.status === 404 ? (
      <Result
        status="404"
        title="Không tìm thấy người dùng"
        extra={
          <Link to="/admin/users">
            <Button>Về danh sách người dùng</Button>
          </Link>
        }
      />
    ) : (
      <ErrorPanel error={info} onRetry={() => void user.refetch()} />
    );
  }

  const u = user.data;
  const departments = depts.data ? depts.data.map((d) => ({ value: d.id, label: d.name })) : null;
  // Hồ sơ độc giả 404 nghĩa là chưa có thẻ, không phải lỗi.
  const readerInfo = reader.isError ? toErrorInfo(reader.error) : null;

  const changeTab = (k: string) => setSp({ tab: k }, { replace: true });

  return (
    <div className="flex max-w-[1200px] flex-col gap-4">
      <Breadcrumb
        items={[
          { title: <Link to="/admin">Quản trị</Link> },
          { title: <Link to="/admin/users">Người dùng</Link> },
          { title: u.fullName },
        ]}
      />
      <PageHeader title={u.fullName} description={`${u.username} · ${u.email}`} actions={
          <div className="flex flex-wrap items-center gap-2">
            {can(s, PERMISSIONS.USER_RESET_PASSWORD) && u.id !== s.userId && <ResetPasswordButton userId={u.id} fullName={u.fullName} />}
            <StatusTag domain="user" value={u.status} />
          </div>
        }
      />
      <Card>
        <Tabs
          activeKey={tab}
          onChange={changeTab}
          items={[
            {
              key: "info",
              label: "Thông tin",
              children: (
                <UserInfoTab
                  user={u}
                  departments={departments}
                  isSelf={u.id === s.userId}
                  canEdit={can(s, PERMISSIONS.USER_UPDATE)}
                  canStatus={can(s, PERMISSIONS.USER_STATUS)}
                />
              ),
            },
            {
              key: "roles",
              label: "Vai trò và quyền",
              children: (
                <AccessTab
                  userId={u.id}
                  sessionAdmin={s.admin}
                  canView={canAccess}
                  loading={canAccess && access.isPending}
                  data={access.data ?? null}
                  error={access.isError ? toErrorInfo(access.error) : null}
                  roles={roles.data ?? null}
                  canAssign={can(s, PERMISSIONS.ACCESS_ASSIGN)}
                  canRevoke={can(s, PERMISSIONS.ACCESS_REVOKE)}
                />
              ),
            },
            {
              key: "reader",
              label: "Hồ sơ độc giả",
              children: (
                <ReaderTab
                  user={u}
                  canView={canReader}
                  loading={canReader && reader.isPending}
                  data={reader.data ?? null}
                  error={readerInfo && readerInfo.status !== 404 ? readerInfo : null}
                  canIssue={can(s, PERMISSIONS.READER_ISSUE)}
                  canRenew={can(s, PERMISSIONS.READER_RENEW)}
                  canStatus={can(s, PERMISSIONS.READER_STATUS)}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
