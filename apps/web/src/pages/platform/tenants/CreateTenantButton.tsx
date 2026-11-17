import { useState } from "react";
import { useNavigate } from "react-router";
import { apiFetch, useApiMutation } from "@/api";
import { Button, Checkbox, Form, FormModal, Input, PlusOutlined, Radio, Select } from "@/ui";
import { MODULE_OPTIONS, withTenantErrors } from "../_lib/tenant-format";
import type { TenantSummary } from "../_lib/tenant-types";

type Values = {
  code: string;
  name: string;
  organizationId?: string;
  modules: string[];
  adminMode: "new" | "existing";
  username?: string;
  fullName?: string;
  email?: string;
  temporaryPassword?: string;
  existingUserId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nút + hộp thoại tạo đơn vị: mã, tên, tổ chức, module bật ban đầu, quản trị viên đầu tiên (tài khoản mới hoặc có sẵn). */
export function CreateTenantButton({ organizations }: { organizations: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const create = useApiMutation(
    (v: Values) =>
      withTenantErrors(
        () =>
          apiFetch<TenantSummary>("/api/platform/tenants", {
            method: "POST",
            json: {
              code: v.code.trim(),
              name: v.name.trim(),
              organizationId: v.organizationId || undefined,
              modules: v.modules,
              ...(v.adminMode === "existing"
                ? { existingUserId: v.existingUserId?.trim() }
                : {
                    newAdmin: {
                      username: v.username?.trim(),
                      fullName: v.fullName?.trim(),
                      email: v.email?.trim(),
                      temporaryPassword: v.temporaryPassword,
                    },
                  }),
            },
          }),
      ),
    { invalidate: ["/api/platform/tenants"] },
  );

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        Tạo đơn vị
      </Button>
      <FormModal<Values>
        open={open}
        title="Tạo đơn vị"
        okText="Tạo"
        onCancel={() => setOpen(false)}
        successMessage="Đã tạo đơn vị"
        initialValues={{ modules: ["LENDING"], adminMode: "new" }}
        onSubmit={async (v) => {
          const t = await create.mutateAsync(v);
          void navigate(`/platform/tenants/${t.id}`);
        }}
      >
        <Form.Item
          name="code"
          label="Mã đơn vị"
          extra="Không đổi được sau khi tạo."
          rules={[{ required: true, whitespace: true, message: "Nhập mã đơn vị" }, { min: 2, max: 50, message: "Từ 2 đến 50 ký tự" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="name"
          label="Tên đơn vị"
          rules={[{ required: true, whitespace: true, message: "Nhập tên đơn vị" }, { max: 255, message: "Tối đa 255 ký tự" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="organizationId" label="Tổ chức">
          <Select allowClear showSearch={{ optionFilterProp: "label" }} options={organizations} placeholder="Không thuộc tổ chức nào" />
        </Form.Item>
        <Form.Item
          name="modules"
          label="Module bật ban đầu"
          rules={[{ required: true, type: "array", min: 1, message: "Chọn ít nhất một module" }]}
        >
          <Checkbox.Group options={MODULE_OPTIONS} />
        </Form.Item>
        <Form.Item name="adminMode" label="Quản trị viên đầu tiên">
          <Radio.Group
            options={[
              { value: "new", label: "Tạo tài khoản mới" },
              { value: "existing", label: "Dùng tài khoản có sẵn" },
            ]}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.adminMode !== b.adminMode}>
          {({ getFieldValue }) =>
            getFieldValue("adminMode") === "existing" ? (
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
                  label="Tên đăng nhập quản trị"
                  rules={[{ required: true, whitespace: true, message: "Nhập tên đăng nhập" }, { min: 3, max: 100, message: "Từ 3 đến 100 ký tự" }]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="fullName"
                  label="Họ tên quản trị"
                  rules={[{ required: true, whitespace: true, message: "Nhập họ tên" }, { max: 255, message: "Tối đa 255 ký tự" }]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="Email quản trị"
                  rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="temporaryPassword"
                  label="Mật khẩu tạm"
                  extra="Quản trị viên dùng mật khẩu này đăng nhập lần đầu (phải đổi ngay)."
                  rules={[{ required: true, message: "Nhập mật khẩu tạm" }, { min: 8, max: 128, message: "Từ 8 đến 128 ký tự" }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </>
            )
          }
        </Form.Item>
      </FormModal>
    </>
  );
}
