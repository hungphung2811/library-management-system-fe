import { useState } from "react";
import { apiFetch, useApiMutation } from "@/api";
import { Alert, Button, ConfirmAction, Form, FormModal, Input, LockOutlined } from "@/ui";

const CHARS = {
  lower: "abcdefghijkmnpqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digit: "23456789",
  sym: "@#$%&*!?",
};

const rand = (n: number) => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
};

/** Mật khẩu tạm ngẫu nhiên 14 ký tự (crypto): đủ chữ hoa, thường, số, ký hiệu; bỏ ký tự dễ nhầm (0/O, 1/l/I). */
export function generateTempPassword(): string {
  const all = Object.values(CHARS).join("");
  const take = (set: string, n: number) => Array.from({ length: n }, () => set[rand(set.length)]);
  const chars = [...take(CHARS.lower, 3), ...take(CHARS.upper, 3), ...take(CHARS.digit, 3), ...take(CHARS.sym, 2), ...take(all, 3)];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function PasswordField() {
  const form = Form.useFormInstance<{ temporaryPassword: string }>();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Form.Item
        name="temporaryPassword"
        label="Mật khẩu tạm"
        rules={[{ required: true, message: "Nhập mật khẩu tạm" }, { min: 8, message: "Tối thiểu 8 ký tự" }, { max: 128, message: "Tối đa 128 ký tự" }]}
      >
        <Input.Password autoComplete="new-password" visibilityToggle={{ visible, onVisibleChange: setVisible }} />
      </Form.Item>
      <Button
        size="small"
        htmlType="button"
        onClick={() => {
          form.setFieldValue("temporaryPassword", generateTempPassword());
          void form.validateFields(["temporaryPassword"]);
          setVisible(true);
        }}
      >
        Tạo ngẫu nhiên
      </Button>
    </>
  );
}

/**
 * Quản trị đặt lại mật khẩu cho người dùng (`POST /api/users/{id}/password-reset`, 204). Bước 1: ConfirmAction nêu hệ quả
 * (thu hồi phiên, buộc đổi mật khẩu). Bước 2: hộp thoại nhập mật khẩu tạm 8-128 ký tự (hoặc tạo ngẫu nhiên, đưa cho người
 * dùng qua kênh an toàn). BE không trả mật khẩu và không lưu lại; FE không giữ mật khẩu sau khi đóng hộp thoại.
 */
export function ResetPasswordButton({ userId, fullName }: { userId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const reset = useApiMutation((temporaryPassword: string) =>
    apiFetch(`/api/users/${encodeURIComponent(userId)}/password-reset`, { method: "POST", json: { temporaryPassword } }),
  );

  return (
    <>
      <ConfirmAction
        danger
        title={`Đặt lại mật khẩu cho «${fullName}»?`}
        description="Mọi phiên đăng nhập hiện có bị thu hồi và người này phải đổi mật khẩu ở lần đăng nhập sau."
        okText="Tiếp tục"
        onConfirm={() => setOpen(true)}
      >
        <Button icon={<LockOutlined />}>Đặt lại mật khẩu</Button>
      </ConfirmAction>
      <FormModal<{ temporaryPassword: string }>
        open={open}
        title="Đặt mật khẩu tạm"
        okText="Đặt lại mật khẩu"
        successMessage="Đã đặt lại mật khẩu. Người dùng phải đổi mật khẩu khi đăng nhập lại."
        onCancel={() => setOpen(false)}
        onSubmit={async (v) => {
          await reset.mutateAsync(v.temporaryPassword);
        }}
      >
        <Alert type="warning" showIcon className="mb-3" title="Hãy chuyển mật khẩu tạm cho người dùng qua kênh an toàn; hệ thống không hiển thị lại." />
        <PasswordField />
      </FormModal>
    </>
  );
}
