import { useState } from "react";
import { useSearchParams } from "react-router";
import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import { Button, DataTable, EditOutlined, ErrorPanel, Form, FormModal, Input, PageHeader, PageSkeleton, PlusOutlined, SearchBar } from "@/ui";
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
  const [editing, setEditing] = useState<Organization | "new" | null>(null);
  const orgs = useApi<Organization[]>("/api/platform/organizations");
  const save = useApiMutation(
    (v: { id?: string; name: string }) =>
      withTenantErrors(() =>
        apiFetch<Organization>(v.id ? `/api/platform/organizations/${encodeURIComponent(v.id)}` : "/api/platform/organizations", {
          method: v.id ? "PUT" : "POST",
          json: { name: v.name.trim() },
        }),
      ),
    { invalidate: ["/api/platform/organizations", "/api/platform/tenants"] },
  );

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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
            Thêm tổ chức
          </Button>
        }
      />
      <div className="flex max-w-[1200px] flex-col gap-4">
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
            { key: "name", title: "Tên tổ chức", dataIndex: "name" },
            { key: "createdAt", title: "Tạo lúc", dataIndex: "createdAt", kind: "datetime" },
            {
              key: "actions",
              title: "",
              dataIndex: "id",
              align: "right",
              render: (_v, row) => (
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(row as unknown as Organization)}>
                  Đổi tên
                </Button>
              ),
            },
          ]}
          empty={q ? { title: "Không có tổ chức khớp.", action: { label: "Xóa bộ lọc", href: "/platform/organizations" } } : { title: "Chưa có tổ chức nào." }}
        />
      </div>
      <FormModal<{ name: string }>
        open={editing !== null}
        title={editing === "new" ? "Thêm tổ chức" : "Đổi tên tổ chức"}
        okText={editing === "new" ? "Tạo" : "Lưu"}
        onCancel={() => setEditing(null)}
        successMessage="Đã lưu tổ chức"
        initialValues={{ name: editing && editing !== "new" ? editing.name : "" }}
        onSubmit={async (v) => {
          await save.mutateAsync({ id: editing && editing !== "new" ? editing.id : undefined, name: v.name });
        }}
      >
        <Form.Item name="name" label="Tên tổ chức" rules={[{ required: true, whitespace: true, message: "Nhập tên tổ chức" }, { max: 255, message: "Tối đa 255 ký tự" }]}>
          <Input autoComplete="off" />
        </Form.Item>
      </FormModal>
    </>
  );
}
