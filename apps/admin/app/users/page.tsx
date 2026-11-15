import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { DataTable, ErrorPanel, NoPermission, PageHeader } from "@mfe/ui";
import { AdminNav } from "../_components/AdminNav";
import { load, pageNo, qp } from "../data";
import type { DepartmentView, UserPage } from "../types";
import { CreateUserButton } from "./_components/CreateUserButton";
import { UserFilters } from "./_components/UserFilters";

const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireSession("/admin/users");
  const sp = await searchParams;
  const q = qp(sp.q);
  const dept = qp(sp.dept);
  const status = qp(sp.status);
  const page = pageNo(sp.page);
  const hasFilter = !!(q || dept || status);

  if (!can(s, PERMISSIONS.USER_SEARCH)) {
    return (
      <>
        <NoPermission feature="Người dùng" />
      </>
    );
  }

  const params = new URLSearchParams({ page: String(page - 1), size: String(PAGE_SIZE) });
  if (q) params.set("keyword", q);
  if (dept) params.set("departmentId", dept);
  if (status) params.set("status", status);

  const [users, depts] = await Promise.all([
    load<UserPage>(`/api/users?${params}`),
    can(s, PERMISSIONS.DEPT_LIST) ? load<DepartmentView[]>("/api/departments") : Promise.resolve(null),
  ]);
  const deptOptions = depts?.data ? depts.data.map((d) => ({ value: d.id, label: d.name })) : null;
  const deptName = new Map((depts?.data ?? []).map((d) => [d.id, d.name]));
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
          can(s, PERMISSIONS.USER_CREATE) ? (
            <CreateUserButton departments={deptOptions} canCredential={can(s, PERMISSIONS.CREDENTIAL_CREATE)} />
          ) : undefined
        }
      />
      <div className="flex max-w-[1200px] flex-col gap-4">
        <AdminNav session={s} current="/admin/users" />
        <UserFilters departments={deptOptions} />
        {users.error ? (
          <ErrorPanel error={users.error} retryHref="/admin/users" />
        ) : (
          <DataTable
            rowKey="id"
            rows={rows}
            mobileTitleKey="fullName"
            columns={[
              { key: "fullName", title: "Họ tên", dataIndex: "fullName", kind: "link", href: "/admin/users/{id}" },
              { key: "username", title: "Tên đăng nhập", dataIndex: "username", kind: "mono" },
              { key: "email", title: "Email", dataIndex: "email" },
              { key: "departmentName", title: "Phòng ban", dataIndex: "departmentName" },
              { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "user" },
            ]}
            pagination={{ mode: "server", page, pageSize: PAGE_SIZE, total: users.data.total }}
            empty={
              hasFilter
                ? { title: "Không có người dùng khớp bộ lọc.", action: { label: "Xóa bộ lọc", href: "/admin/users" } }
                : { title: "Chưa có người dùng nào." }
            }
          />
        )}
      </div>
    </>
  );
}
