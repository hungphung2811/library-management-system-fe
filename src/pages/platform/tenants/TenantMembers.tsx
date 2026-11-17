import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { apiFetch, toErrorInfo, useApiMutation } from "@/api";
import { Button, DataTable, ErrorPanel, Form, FormModal, Input, PlusOutlined, StatusTag } from "@/ui";
import { TENANT_ERRORS, withTenantErrors } from "../_lib/tenant-format";
import type { TenantUserPage } from "../_lib/tenant-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thành viên của đơn vị: danh sách (GET /api/users?tenantId=, tối đa 100 dòng đầu) và gắn tài khoản có sẵn bằng mã người dùng. */
export function TenantMembers({ tenantId, users }: { tenantId: string; users: UseQueryResult<TenantUserPage> }) {
  const enc = encodeURIComponent(tenantId);
  const [open, setOpen] = useState(false);
  const attach = useApiMutation(
    (userId: string) =>
      withTenantErrors(() => apiFetch(`/api/platform/tenants/${enc}/members`, { method: "POST", json: { userId: userId.trim() } })),
    { invalidate: ["/api/platform/tenants", "/api/users"] },
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {users.data ? `${users.data.total} người dùng${users.data.total > users.data.items.length ? ` (hiện ${users.data.items.length} đầu tiên)` : ""}` : ""}
        </span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Thêm thành viên
        </Button>
      </div>
      {users.isError ? (
        <ErrorPanel error={toErrorInfo(users.error)} onRetry={() => void users.refetch()} messages={TENANT_ERRORS} />
      ) : (
        <DataTable
          rowKey="id"
          mobileTitleKey="fullName"
          loading={users.isPending}
          rows={(users.data?.items ?? []) as unknown as Record<string, unknown>[]}
          pagination={{ mode: "client", pageSize: 20 }}
          columns={[
            { key: "fullName", title: "Họ tên", dataIndex: "fullName" },
            { key: "username", title: "Tên đăng nhập", dataIndex: "username", kind: "mono" },
            { key: "email", title: "Email", dataIndex: "email" },
            {
              key: "status",
              title: "Trạng thái",
              dataIndex: "status",
              render: (v) => (v ? <StatusTag domain="user" value={String(v)} /> : "—"),
            },
          ]}
          empty={{ title: "Đơn vị chưa có thành viên." }}
        />
      )}
      <FormModal<{ userId: string }>
        open={open}
        title="Thêm thành viên"
        okText="Thêm"
        onCancel={() => setOpen(false)}
        successMessage="Đã thêm thành viên"
        onSubmit={async (v) => {
          await attach.mutateAsync(v.userId);
        }}
      >
        <Form.Item
          name="userId"
          label="Mã người dùng (UUID)"
          extra="Gắn một tài khoản có sẵn vào đơn vị này (tài khoản có thể thuộc nhiều đơn vị)."
          rules={[{ required: true, message: "Nhập mã người dùng" }, { pattern: UUID, message: "Phải là UUID" }]}
        >
          <Input autoComplete="off" className="font-mono" />
        </Form.Item>
      </FormModal>
    </div>
  );
}
