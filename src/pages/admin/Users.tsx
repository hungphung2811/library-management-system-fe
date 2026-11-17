import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { DataTable, NoPermission, PageHeader, PageSkeleton, Tag } from "@/ui";
import { CreateUserButton } from "./_components/CreateUserButton";
import { ExportUsersButton } from "./_components/ExportUsersButton";
import { ImportUsersButton } from "./_components/ImportUsersButton";
import { ErrorBlock } from "./_components/ErrorBlock";
import { ServerPager } from "./_components/ServerPager";
import { UserFilters } from "./_components/UserFilters";
import { keepPreviousData, pageNo, qp } from "./_lib/params";
import type { DepartmentView, UserPage } from "./_lib/types";

const SIZES = [10, 20, 50];

export default function UsersPage() {
  const s = useSession();
  const [sp] = useSearchParams();
  const q = qp(sp, "q");
  const dept = qp(sp, "dept");
  const status = qp(sp, "status");
  const page = pageNo(sp);
  const sizeRaw = Number.parseInt(qp(sp, "size"), 10);
  const pageSize = SIZES.includes(sizeRaw) ? sizeRaw : 20;
  const hasFilter = !!(q || dept || status);
  const allowed = can(s, PERMISSIONS.USER_SEARCH);

  const params = new URLSearchParams({ page: String(page - 1), size: String(pageSize) });
  if (q) params.set("keyword", q);
  if (dept) params.set("departmentId", dept);
  if (status) params.set("status", status);

  const users = useApi<UserPage>(allowed ? `/api/users?${params}` : null, { placeholderData: keepPreviousData });
  const depts = useApi<DepartmentView[]>(allowed && can(s, PERMISSIONS.DEPT_LIST) ? "/api/departments" : null);

  const deptOptions = useMemo(
    () => (depts.data ? depts.data.map((d) => ({ value: d.id, label: d.name })) : null),
    [depts.data],
  );
  const deptName = useMemo(() => new Map((depts.data ?? []).map((d) => [d.id, d.name])), [depts.data]);

  if (!allowed) return <NoPermission feature="Người dùng" />;
  if (users.isPending) return <PageSkeleton />;

  const rows = (users.data?.items ?? []).map((u) => ({
    ...u,
    departmentName: (u.departmentId && deptName.get(u.departmentId)) || null,
  }));

  return (
    <>
      <PageHeader
        title="Người dùng"
        description="Tài khoản, phòng ban và trạng thái."
        actions={
          <>
            {can(s, PERMISSIONS.USER_EXPORT) && (
              <ExportUsersButton filters={{ keyword: q || undefined, departmentId: dept || undefined, status: status || undefined }} />
            )}
            {can(s, PERMISSIONS.USER_IMPORT) && <ImportUsersButton />}
            {can(s, PERMISSIONS.USER_CREATE) && (
              <CreateUserButton departments={deptOptions} canCredential={can(s, PERMISSIONS.CREDENTIAL_CREATE)} />
            )}
          </>
        }
      />
      <div className="flex max-w-[1200px] flex-col gap-4">
        <UserFilters departments={deptOptions} total={users.data?.total ?? null} pageSize={pageSize} />
        {users.isError ? (
          <ErrorBlock query={users} />
        ) : (
          <div>
            <DataTable
              rowKey="id"
              rows={rows}
              mobileTitleKey="fullName"
              loading={users.isPlaceholderData}
              columns={[
                { key: "fullName", title: "Họ tên", dataIndex: "fullName", kind: "link", href: "/admin/users/{id}" },
                { key: "username", title: "Tên đăng nhập", dataIndex: "username", kind: "mono" },
                { key: "email", title: "Email", dataIndex: "email" },
                { key: "departmentName", title: "Phòng ban", dataIndex: "departmentName", render: (v) => (v as string | null) ?? "—" },
                { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "user" },
                {
                  key: "locked",
                  title: "Khóa đăng nhập",
                  dataIndex: "locked",
                  render: (v) => (v ? <Tag color="error">Đang bị khóa</Tag> : "—"),
                },
              ]}
              empty={
                hasFilter
                  ? { title: "Không có người dùng khớp bộ lọc.", action: { label: "Xóa bộ lọc", href: "/admin/users" } }
                  : { title: "Chưa có người dùng nào." }
              }
            />
            <ServerPager page={page} pageSize={pageSize} total={users.data.total} />
          </div>
        )}
      </div>
    </>
  );
}
