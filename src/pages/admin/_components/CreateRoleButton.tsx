import { useNavigate } from "react-router";
import { ApiCallError, apiFetch } from "@/api";
import { App, Button, Form, FormModal, Input, PlusOutlined, Switch, Text, useFormModal } from "@/ui";
import type { RoleView } from "../_lib/types";

type Values = { name: string; description: string; isAdmin?: boolean };

/** Nút + hộp thoại "Thêm vai trò". Công tắc vai trò quản trị viên chỉ hiện với quản trị viên và đòi xác nhận lần hai. */
export function CreateRoleButton({ sessionAdmin }: { sessionAdmin: boolean }) {
  const navigate = useNavigate();
  const { modal } = App.useApp();

  const confirmAdmin = () =>
    new Promise<void>((resolve, reject) =>
      modal.confirm({
        title: "Tạo vai trò quản trị viên?",
        content: "Người có vai trò này được bỏ qua mọi kiểm tra quyền.",
        okText: "Tạo vai trò quản trị viên",
        cancelText: "Không",
        okButtonProps: { danger: true },
        onOk: () => resolve(),
        onCancel: () => reject(new ApiCallError(400, "ADMIN_ROLE_CANCELLED", "Đã hủy tạo vai trò quản trị viên.")),
      }),
    );

  const form = useFormModal<Values, RoleView>({
    title: "Thêm vai trò",
    okText: "Tạo",
    successMessage: "Đã tạo vai trò.",
    invalidate: ["/api/roles"],
    request: async (v) => {
      const isAdmin = sessionAdmin && v.isAdmin === true;
      if (isAdmin) await confirmAdmin();
      return apiFetch<RoleView>("/api/roles", { method: "POST", json: { name: v.name.trim(), description: v.description.trim(), isAdmin } });
    },
    onSuccess: (created) => {
      if (created?.id) void navigate(`/admin/roles/${encodeURIComponent(created.id)}`);
    },
  });

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => form.openModal()}>
        Thêm vai trò
      </Button>
      <FormModal<Values> {...form.modalProps}>
        <Form.Item name="name" label="Tên vai trò" rules={[{ required: true, whitespace: true, message: "Nhập tên vai trò" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ required: true, whitespace: true, message: "Nhập mô tả" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        {sessionAdmin && (
          <Form.Item
            name="isAdmin"
            label="Vai trò quản trị viên"
            valuePropName="checked"
            extra={<Text type="warning">Người có vai trò này được bỏ qua mọi kiểm tra quyền.</Text>}
          >
            <Switch />
          </Form.Item>
        )}
      </FormModal>
    </>
  );
}
