import { useState } from "react";
import { apiFetch, useApiMutation } from "@/api";
import { App, Button, ConfirmAction, EditOutlined, Form, FormModal, Input, KeyValueList, Select, StatusTag, Text } from "@/ui";
import type { UserView } from "../_lib/types";

type Option = { value: string; label: string };

/** Tab "Thông tin": xem, sửa, vô hiệu hóa / kích hoạt lại. */
export function UserInfoTab({
  user,
  departments,
  isSelf,
  canEdit,
  canStatus,
}: {
  user: UserView;
  departments: Option[] | null;
  isSelf: boolean;
  canEdit: boolean;
  canStatus: boolean;
}) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const active = user.status === "ACTIVE";
  const deptName = departments?.find((d) => d.value === user.departmentId)?.label;
  const url = `/api/users/${encodeURIComponent(user.id)}` as const;

  const status = useApiMutation(
    () => apiFetch(`${url}/status`, { method: "PUT", json: { status: active ? "DISABLED" : "ACTIVE" } }),
    { invalidate: ["/api/users"] },
  );
  const update = useApiMutation(
    (v: { fullName: string; email: string; departmentId?: string }) =>
      apiFetch(url, {
        method: "PUT",
        json: { fullName: v.fullName, email: v.email, departmentId: v.departmentId || undefined },
      }),
    { invalidate: ["/api/users"] },
  );

  const setStatus = async () => {
    await status.mutateAsync();
    message.success(active ? "Đã vô hiệu hóa người dùng." : "Đã kích hoạt lại người dùng.");
  };

  return (
    <div className="flex flex-col gap-4">
      <KeyValueList
        columns={2}
        items={[
          { label: "Họ tên", value: user.fullName },
          { label: "Tên đăng nhập", value: user.username, mono: true },
          { label: "Email", value: user.email },
          { label: "Phòng ban", value: deptName },
          { label: "Trạng thái", value: <StatusTag domain="user" value={user.status} /> },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Sửa
          </Button>
        )}
        {canStatus && !isSelf && (
          <ConfirmAction
            danger={active}
            title={active ? `Vô hiệu hóa «${user.fullName}»?` : `Kích hoạt lại «${user.fullName}»?`}
            description={active ? "Người này sẽ không đăng nhập được." : undefined}
            okText={active ? "Vô hiệu hóa" : "Kích hoạt lại"}
            onConfirm={setStatus}
          >
            <Button danger={active}>{active ? "Vô hiệu hóa" : "Kích hoạt lại"}</Button>
          </ConfirmAction>
        )}
        {canStatus && isSelf && <Text type="secondary">Bạn không thể vô hiệu hóa chính mình.</Text>}
      </div>

      <FormModal<{ fullName: string; email: string; departmentId?: string }>
        open={editing}
        title="Sửa thông tin người dùng"
        okText="Lưu"
        successMessage="Đã cập nhật thông tin."
        onCancel={() => setEditing(false)}
        initialValues={{ fullName: user.fullName, email: user.email, departmentId: user.departmentId ?? undefined }}
        onSubmit={async (v) => {
          await update.mutateAsync(v);
        }}
      >
        <Form.Item
          name="fullName"
          label="Họ tên"
          rules={[{ required: true, message: "Nhập họ tên" }, { max: 255, message: "Tối đa 255 ký tự" }]}
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
        {departments && (
          <Form.Item name="departmentId" label="Phòng ban">
            <Select allowClear showSearch={{ optionFilterProp: "label" }} options={departments} placeholder="Không chọn" />
          </Form.Item>
        )}
      </FormModal>
    </div>
  );
}
