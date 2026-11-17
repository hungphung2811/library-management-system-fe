import { useState } from "react";
import { useNavigate } from "react-router";
import { apiFetch, useApiMutation } from "@/api";
import { App, Button, ConfirmAction, DeleteOutlined, EditOutlined, Form, FormModal, Input, Text } from "@/ui";
import type { RoleView } from "../_lib/types";

type Values = { name: string; description: string };

/**
 * Nút "Sửa" (tên, mô tả) và "Xóa" vai trò. Vai trò quản trị viên chỉ quản trị viên được sửa/xóa: người khác thấy nút bị
 * vô hiệu hóa kèm lời giải thích (BE vẫn là nơi quyết định). Lỗi ROLE_IN_USE, LAST_ADMIN_ROLE, DUPLICATE hiện bằng thông điệp tiếng Việt.
 */
export function RoleActions({
  role,
  isAdminRole,
  sessionAdmin,
  canUpdate,
  canDelete,
}: {
  role: RoleView;
  isAdminRole: boolean;
  sessionAdmin: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const url = `/api/roles/${encodeURIComponent(role.id)}` as const;
  const locked = isAdminRole && !sessionAdmin;

  const update = useApiMutation((v: Values) => apiFetch<RoleView>(url, { method: "PUT", json: v }), {
    invalidate: ["/api/roles", "/api/access"],
  });
  const remove = useApiMutation(() => apiFetch(url, { method: "DELETE" }), { invalidate: ["/api/roles", "/api/access"] });

  if (!canUpdate && !canDelete) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canUpdate && (
          <Button icon={<EditOutlined />} disabled={locked} onClick={() => setEditing(true)}>
            Sửa
          </Button>
        )}
        {canDelete && (
          <ConfirmAction
            danger
            title={`Xóa vai trò «${role.name}»?`}
            description={
              isAdminRole ? "Đây là vai trò quản trị viên. Chỉ xóa được khi không còn ai được gán và còn vai trò quản trị khác." : "Chỉ xóa được khi không còn người dùng nào được gán."
            }
            okText="Xóa"
            onConfirm={async () => {
              await remove.mutateAsync();
              message.success("Đã xóa vai trò.");
              void navigate("/admin/roles", { replace: true });
            }}
          >
            <Button danger icon={<DeleteOutlined />} disabled={locked}>
              Xóa
            </Button>
          </ConfirmAction>
        )}
        {locked && <Text type="secondary">Chỉ quản trị viên được sửa hoặc xóa vai trò quản trị.</Text>}
      </div>
      <FormModal<Values>
        open={editing}
        title="Sửa vai trò"
        okText="Lưu"
        successMessage="Đã cập nhật vai trò."
        onCancel={() => setEditing(false)}
        initialValues={{ name: role.name, description: role.description ?? "" }}
        onSubmit={async (v) => {
          await update.mutateAsync({ name: v.name.trim(), description: v.description.trim() });
        }}
      >
        <Form.Item name="name" label="Tên vai trò" rules={[{ required: true, whitespace: true, message: "Nhập tên vai trò" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ required: true, whitespace: true, message: "Nhập mô tả" }]}>
          <Input autoComplete="off" />
        </Form.Item>
      </FormModal>
    </>
  );
}
