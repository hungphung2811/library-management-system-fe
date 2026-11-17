import { useState } from "react";
import { useNavigate } from "react-router";
import { apiFetch, toErrorInfo } from "@/api";
import { useAuth } from "@/auth/AuthProvider";
import { Alert, AuthShell, Button, Form, Input, Lock, Title, describeError } from "@/ui";

type Values = { currentPassword: string; newPassword: string; confirm: string };

export default function ChangePasswordPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/password", {
        method: "POST",
        json: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
    } catch (e) {
      const info = toErrorInfo(e);
      setError(info.status >= 400 && info.status < 500 && info.message ? info.message : describeError(info).text);
      setLoading(false);
      return;
    }
    // Token cũ không mang quyền; xóa phiên rồi đăng nhập lại để nhận token đầy đủ.
    await logout();
    void navigate("/login?changed=1", { replace: true });
  }

  return (
    <AuthShell>
      <Title level={1} className="mb-1! text-title! leading-tight! font-semibold!">Đổi mật khẩu</Title>
      <p className="mt-0 mb-8 text-sm text-muted">Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.</p>

      <Form<Values> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
        <Form.Item name="currentPassword" rules={[{ required: true, message: "Nhập mật khẩu hiện tại" }]}>
          <Input.Password prefix={<Lock size={16} strokeWidth={1.75} className="text-muted" />} placeholder="Mật khẩu hiện tại" autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          rules={[
            { required: true, message: "Nhập mật khẩu mới" },
            { min: 8, message: "Mật khẩu mới tối thiểu 8 ký tự" },
            { max: 72, message: "Mật khẩu mới tối đa 72 ký tự" },
          ]}
        >
          <Input.Password prefix={<Lock size={16} strokeWidth={1.75} className="text-muted" />} placeholder="Mật khẩu mới" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: "Nhập lại mật khẩu mới" },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue("newPassword") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Mật khẩu nhập lại không khớp")),
            }),
          ]}
        >
          <Input.Password prefix={<Lock size={16} strokeWidth={1.75} className="text-muted" />} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} className="mb-4" />}
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đổi mật khẩu
        </Button>
      </Form>
    </AuthShell>
  );
}
