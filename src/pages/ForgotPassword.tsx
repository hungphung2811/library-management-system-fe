import { useState } from "react";
import { Link } from "react-router";
import { apiFetch, toErrorInfo } from "@/api";
import { Alert, AuthShell, Button, Form, Input, Title, User, describeError } from "@/ui";

type Values = { username: string };

/** Quên mật khẩu (công khai). BE luôn trả 202 dù tài khoản có tồn tại hay không, nên UI chỉ hiện thông báo trung lập. */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/password-reset-requests", {
        method: "POST",
        json: { username: values.username.trim() },
        anonymous: true,
      });
      setSent(true);
    } catch (e) {
      setError(describeError(toErrorInfo(e)).text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Title level={1} className="mb-2! text-center text-xl! leading-tight! font-semibold!">Quên mật khẩu</Title>
      <p className="mt-0 mb-7 text-center text-sm text-muted">Nhập tên đăng nhập để nhận hướng dẫn đặt lại mật khẩu.</p>

      {sent ? (
        <Alert
          type="success"
          showIcon
          title="Nếu tài khoản tồn tại, hướng dẫn đặt lại đã được gửi."
          description="Liên kết có hiệu lực trong 30 phút. Nếu không nhận được, hãy liên hệ quản trị viên."
          className="mb-4"
        />
      ) : (
        <Form<Values> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <Form.Item label="Tên đăng nhập" name="username" rules={[{ required: true, whitespace: true, message: "Nhập tên đăng nhập" }]}>
            <Input prefix={<User size={16} strokeWidth={1.75} className="text-muted" />} placeholder="Nhập tên đăng nhập" autoComplete="username" />
          </Form.Item>
          {error && <Alert type="error" showIcon title={error} className="mb-4" />}
          <Button type="primary" htmlType="submit" block loading={loading}>
            Gửi hướng dẫn
          </Button>
        </Form>
      )}
      <p className="mt-6 mb-0 text-center text-sm">
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </AuthShell>
  );
}
