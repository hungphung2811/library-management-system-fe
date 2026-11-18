import { useSearchParams } from "react-router";
import { apiFetch, toErrorInfo, useApi } from "@/api";
import { Button, DataTable, ErrorPanel, Form, FormModal, Input, PageHeader, PageSkeleton, Pencil, PlusOutlined, SearchBar, actionsColumn, useFormModal } from "@/ui";
import { PlatformGate } from "../_components/PlatformGate";
import { TENANT_ERRORS, withTenantErrors } from "../_lib/tenant-format";
import type { Organization } from "../_lib/tenant-types";

export default function OrganizationsPage() {
  return (
    <PlatformGate>
      <List />
    </PlatformGate>
  );
}

function List() {
  const [sp, setSp] = useSearchParams();
  const q = (sp.get("q") ?? "").trim();
  const orgs = useApi<Organization[]>("/api/platform/organizations");
  const form = useFormModal<{ name: string }, Organization, Organization>({
    title: (t) => (t ? "Đổi tên tổ chức" : "Thêm tổ chức"),
    okText: (t) => (t ? "Lưu" : "Tạo"),
    successMessage: "Đã lưu tổ chức",
    initialValues: (t) => ({ name: t?.name ?? "" }),
    invalidate: ["/api/platform/organizations", "/api/platform/tenants"],
    request: (v, t) =>
      withTenantErrors(() =>
        apiFetch<Organization>(t ? `/api/platform/organizations/${encodeURIComponent(t.id)}` : "/api/platform/organizations", {
          method: t ? "PUT" : "POST",
          json: { name: v.name.trim() },
        }),
      ),
  });

  if (orgs.isPending) return <PageSkeleton />;
  if (orgs.isError) return <ErrorPanel error={toErrorInfo(orgs.error)} onRetry={() => void orgs.refetch()} messages={TENANT_ERRORS} />;

  // BE trả cả mảng không phân trang: tìm theo tên phía client.
  const all = orgs.data;
  const rows = all.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Tổ chức"
        description="Nhóm các đơn vị cùng một chủ thể (ví dụ một trường có nhiều thư viện). Không xóa được vì đơn vị tham chiếu tới tổ chức."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => form.openModal()}>
            Thêm tổ chức
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <SearchBar placeholder="Tìm theo tên tổ chức" />
        <div className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <span data-testid="org-count">{q ? `${rows.length} / ${all.length} tổ chức` : `${all.length} tổ chức`}</span>
          {q && (
            <Button type="link" size="small" onClick={() => setSp(new URLSearchParams(), { replace: true })}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
        <DataTable
          rowKey="id"
          mobileTitleKey="name"
          rows={rows}
          pagination={{ mode: "client", pageSize: 20 }}
          columns={[
{ key: "id", title: "ID", dataIndex: "id", kind: "id", width: 120 },
            { key: "name", title: "Tên tổ chức", dataIndex: "name" },
            { key: "createdAt", title: "Tạo lúc", dataIndex: "createdAt", kind: "datetime" },
            actionsColumn((row) => [
              { key: "rename", label: "Đổi tên", icon: <Pencil size={16} />, onClick: () => form.openModal(row as unknown as Organization) },
            ], 1),
          ]}
          empty={q ? { title: "Không có tổ chức khớp.", action: { label: "Xóa bộ lọc", href: "/platform/organizations" } } : { title: "Chưa có tổ chức nào." }}
        />
      </div>
      <FormModal<{ name: string }> {...form.modalProps}>
        <Form.Item name="name" label="Tên tổ chức" rules={[{ required: true, whitespace: true, message: "Nhập tên tổ chức" }, { max: 255, message: "Tối đa 255 ký tự" }]}>
          <Input autoComplete="off" />
        </Form.Item>
      </FormModal>
    </>
  );
}
