import { useRef } from "react";
import { useNavigate } from "react-router";
import { ApiCallError, apiFetch } from "@/api";
import { Button, Form, FormModal, Input, PlusOutlined, Select, Switch, useFormModal } from "@/ui";
import type { UserView } from "../_lib/types";
import { UserPersonalFields, personalPayload, type UserPersonalValues } from "./UserPersonalFields";

type Values = UserPersonalValues & {
  username: string;
  fullName: string;
  email: string;
  departmentId?: string;
  password?: string;
  mustChangePassword?: boolean;
};

/**
 * Nút + hộp thoại tạo người dùng. POST /api/users không tạo mật khẩu; nếu có quyền AuthController/register thì
 * cùng hộp thoại tạo luôn tài khoản đăng nhập (POST /api/auth/credentials). Nếu bước 2 lỗi, người dùng đã tồn tại
 * nên lần gửi lại bỏ qua bước 1.
 */
export function CreateUserButton({
  departments,
  canCredential,
}: {
  departments: { value: string; label: string }[] | null;
  canCredential: boolean;
}) {
  const navigate = useNavigate();
  const created = useRef<UserView | null>(null);
  const create = useFormModal<Values, UserView>({
    title: "Thêm người dùng",
    okText: "Tạo",
    invalidate: ["/api/users"],
    initialValues: { mustChangePassword: true },
    onSuccess: (user) => {
      void navigate(`/admin/users/${user.id}`);
    },
    request: async (v) => {
      if (!created.current) {
        created.current = await apiFetch<UserView>("/api/users", {
          method: "POST",
          json: { username: v.username, fullName: v.fullName, email: v.email, departmentId: v.departmentId || undefined, ...personalPayload(v) },
        });
      }
      const user = created.current;
      if (canCredential) {
        try {
          await apiFetch("/api/auth/credentials", {
            method: "POST",
            json: {
              userId: user.id,
              username: user.username,
              password: v.password,
              departmentId: v.departmentId || undefined,
              mustChangePassword: v.mustChangePassword ?? true,
            },
          });
        } catch (e) {
          if (e instanceof ApiCallError) {
            throw new ApiCallError(
              e.status,
              e.code,
              `Đã tạo người dùng nhưng chưa tạo được mật khẩu: ${e.message}. Sửa lại rồi bấm Tạo để thử tiếp.`,
              e.details,
            );
          }
          throw e;
        }
      }
      created.current = null;
      return user;
    },
  });

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => create.openModal()}>
        Thêm người dùng
      </Button>
      <FormModal<Values> {...create.modalProps}>
        <Form.Item
          name="username"
          label="Tên đăng nhập"
          rules={[{ required: true, message: "Nhập tên đăng nhập" }, { min: 3, max: 100, message: "Từ 3 đến 100 ký tự" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
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
        <UserPersonalFields />
        {canCredential && (
          <>
            <Form.Item
              name="password"
              label="Mật khẩu tạm"
              extra="Người dùng dùng mật khẩu này để đăng nhập lần đầu."
              rules={[{ required: true, message: "Nhập mật khẩu" }, { min: 8, max: 72, message: "Từ 8 đến 72 ký tự" }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="mustChangePassword" label="Bắt đổi mật khẩu ở lần đăng nhập đầu" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        )}
      </FormModal>
    </>
  );
}
