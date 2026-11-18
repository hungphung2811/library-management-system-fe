import { apiFetch, useApiMutation } from "@/api";
import { App, Button, DataTable, Form, FormModal, Input, PlusOutlined, Radio, Undo2, actionsColumn, useFormModal } from "@/ui";
import { withTenantErrors } from "../_lib/tenant-format";
import type { TenantUser } from "../_lib/tenant-types";

type Values = {
  mode: "new" | "existing";
  username?: string;
  fullName?: string;
  email?: string;
  temporaryPassword?: string;
  existingUserId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quản trị viên của đơn vị: thêm (tài khoản mới hoặc có sẵn) và gỡ vai trò quản trị. */
export function TenantAdmins({ tenantId, adminIds, users }: { tenantId: string; adminIds: string[]; users: Map<string, TenantUser> }) {
  const enc = encodeURIComponent(tenantId);
  const { message } = App.useApp();
  const refresh = ["/api/platform/tenants", "/api/users"];
  const add = useFormModal<Values>({
    title: "Thêm quản trị viên",
    okText: "Thêm",
    successMessage: "Đã thêm quản trị viên",
    initialValues: { mode: "new" },
    invalidate: refresh,
    request: (v) =>
      withTenantErrors(() =>
        apiFetch(`/api/platform/tenants/${enc}/admins`, {
          method: "POST",
          json:
            v.mode === "existing"
              ? { existingUserId: v.existingUserId?.trim() }
              : {
                  newAdmin: {
                    username: v.username?.trim(),
                    fullName: v.fullName?.trim(),
                    email: v.email?.trim(),
                    temporaryPassword: v.temporaryPassword,
                  },
                },
        }),
      ),
  });
  const remove = useApiMutation(
    (userId: string) =>
      withTenantErrors(() => apiFetch(`/api/platform/tenants/${enc}/admins/${encodeURIComponent(userId)}`, { method: "DELETE" })),
    { invalidate: refresh },
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => add.openModal()}>
          Thêm quản trị viên
        </Button>
      </div>
      <DataTable
        rowKey="id"
        mobileTitleKey="fullName"
        rows={adminIds.map((id) => ({
          id,
          fullName: users.get(id)?.fullName ?? "(không rõ tên)",
          username: users.get(id)?.username ?? "—",
          email: users.get(id)?.email ?? "—",
        }))}
        columns={[
{ key: "id", title: "ID", dataIndex: "id", kind: "id", width: 120 },
          { key: "fullName", title: "Họ tên", dataIndex: "fullName" },
          { key: "username", title: "Tên đăng nhập", dataIndex: "username", kind: "mono" },
          { key: "email", title: "Email", dataIndex: "email" },
          { key: "id", title: "Mã người dùng", dataIndex: "id", kind: "mono" },
          actionsColumn(
            (row) => [
              {
                key: "remove",
                label: "Gỡ",
                icon: <Undo2 size={16} />,
                danger: true,
                confirm: {
                  title: "Gỡ quyền quản trị viên?",
                  description: "Tài khoản vẫn là thành viên của đơn vị nhưng không còn vai trò quản trị.",
                  okText: "Gỡ",
                },
                onClick: async () => {
                  await remove.mutateAsync(row.id as string);
                  message.success("Đã gỡ quản trị viên");
                },
              },
            ],
            1,
          ),
        ]}
        empty={{ title: "Đơn vị chưa có quản trị viên.", hint: "Hãy thêm ít nhất một quản trị viên." }}
      />
      <FormModal<Values> {...add.modalProps}>
        <Form.Item name="mode" label="Cách thêm">
          <Radio.Group
            options={[
              { value: "new", label: "Tạo tài khoản mới" },
              { value: "existing", label: "Dùng tài khoản có sẵn" },
            ]}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.mode !== b.mode}>
          {({ getFieldValue }) =>
            getFieldValue("mode") === "existing" ? (
              <Form.Item
                name="existingUserId"
                label="Mã người dùng (UUID)"
                rules={[{ required: true, message: "Nhập mã người dùng" }, { pattern: UUID, message: "Phải là UUID" }]}
              >
                <Input autoComplete="off" className="font-mono" />
              </Form.Item>
            ) : (
              <>
                <Form.Item
                  name="username"
                  label="Tên đăng nhập"
                  rules={[{ required: true, whitespace: true, message: "Nhập tên đăng nhập" }, { min: 3, max: 100, message: "Từ 3 đến 100 ký tự" }]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="fullName"
                  label="Họ tên"
                  rules={[{ required: true, whitespace: true, message: "Nhập họ tên" }, { max: 255, message: "Tối đa 255 ký tự" }]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="temporaryPassword"
                  label="Mật khẩu tạm"
                  rules={[{ required: true, message: "Nhập mật khẩu tạm" }, { min: 8, max: 128, message: "Từ 8 đến 128 ký tự" }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </>
            )
          }
        </Form.Item>
      </FormModal>
    </div>
  );
}
