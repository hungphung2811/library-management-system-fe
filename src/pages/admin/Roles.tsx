import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { DataTable, NoPermission, PageHeader, PageSkeleton, SearchBar, Select, Eye, actionsColumn } from "@/ui";
import { CreateRoleButton } from "./_components/CreateRoleButton";
import { ErrorBlock } from "./_components/ErrorBlock";
import { FilterChips, type Chip } from "./_components/FilterChips";
import { isAdminRole, type RoleView } from "./_lib/types";

export default function RolesPage() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.LIST_ROLES);
  const [sp, setSp] = useSearchParams();
  const q = (sp.get("q") ?? "").trim();
  const kind = sp.get("type") === "admin" || sp.get("type") === "normal" ? (sp.get("type") as "admin" | "normal") : "";
  const roles = useApi<RoleView[]>(allowed ? "/api/roles" : null);

  if (!allowed) return <NoPermission feature="Vai trò và quyền" />;
  if (roles.isPending) return <PageSkeleton />;

  const setKind = (v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set("type", v);
    else n.delete("type");
    setSp(n, { replace: true });
  };
  const needle = q.toLowerCase();
  const filtered = (roles.data ?? []).filter(
    (r) =>
      (!needle || r.name.toLowerCase().includes(needle) || (r.description ?? "").toLowerCase().includes(needle)) &&
      (!kind || (kind === "admin") === isAdminRole(r)),
  );
  const chips: Chip[] = [
    ...(q ? [{ key: "q", label: `Từ khóa: ${q}`, onClose: () => { const n = new URLSearchParams(sp); n.delete("q"); setSp(n, { replace: true }); } }] : []),
    ...(kind ? [{ key: "type", label: `Loại: ${kind === "admin" ? "Quản trị viên" : "Thường"}`, onClose: () => setKind() }] : []),
  ];

  const rows = filtered.map((r) => ({
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
      <div className="flex flex-col gap-4">
        <SearchBar
          placeholder="Tìm theo tên hoặc mô tả vai trò"
          extra={
            <Select
              aria-label="Lọc theo loại vai trò"
              className="min-w-44"
              placeholder="Loại vai trò"
              allowClear
              value={kind || undefined}
              options={[
                { value: "admin", label: "Quản trị viên" },
                { value: "normal", label: "Thường" },
              ]}
              onChange={(v) => setKind(v)}
            />
          }
        />
        <FilterChips
          chips={chips}
          count={`${filtered.length}${chips.length ? ` / ${roles.data?.length ?? 0}` : ""} vai trò`}
          onClear={() => setSp({}, { replace: true })}
        />
        {roles.isError ? (
          <ErrorBlock query={roles} />
        ) : (
          <DataTable
            rowKey="id"
            rows={rows}
            mobileTitleKey="name"
            columns={[
{ key: "id", title: "ID", dataIndex: "id", kind: "id", width: 120 },
              { key: "name", title: "Tên", dataIndex: "name", kind: "link", href: "/admin/roles/{id}" },
              { key: "description", title: "Mô tả", dataIndex: "description" },
              { key: "type", title: "Loại", dataIndex: "type" },
              { key: "count", title: "Số quyền", dataIndex: "count", align: "right" },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/admin/roles/${encodeURIComponent(String(row.id))}` }], 1),
]}
            empty={chips.length ? { title: "Không có vai trò khớp bộ lọc." } : { title: "Chưa có vai trò nào." }}
          />
        )}
      </div>
    </>
  );
}
