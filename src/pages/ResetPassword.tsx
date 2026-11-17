import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { apiFetch, toErrorInfo } from "@/api";
import { Alert, AuthShell, Button, Form, Input, Lock, Title, describeError } from "@/ui";

type Values = { newPassword: string; confirm: string };

/** Đặt lại mật khẩu bằng token một lần (query `?token=`). Công khai; thành công thì về /login. */
export default function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const token = sp.get("token")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/password-reset-confirmations", {
        method: "POST",
        json: { token, newPassword: values.newPassword },
        anonymous: true,
      });
      void navigate("/login?reset=1", { replace: true });
    } catch (e) {
      const info = toErrorInfo(e);
      setError(info.status === 422 && info.message ? info.message : describeError(info).text);
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Title level={1} className="mb-2! text-center text-xl! leading-tight! font-semibold!">Đặt lại mật khẩu</Title>
      {!token ? (
        <>
          <Alert
            type="error"
            showIcon
            title="Liên kết không hợp lệ"
            description="Thiếu mã đặt lại mật khẩu. Hãy mở đúng liên kết trong hướng dẫn hoặc yêu cầu lại."
            className="mt-6 mb-4"
          />
          <p className="m-0 text-center text-sm">
            <Link to="/forgot-password">Yêu cầu đặt lại mật khẩu</Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-0 mb-7 text-center text-sm text-muted">Nhập mật khẩu mới cho tài khoản của bạn.</p>
          <Form<Values> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
            <Form.Item
              label="Mật khẩu mới"
              name="newPassword"
              rules={[{ required: true, message: "Nhập mật khẩu mới" }, { min: 8, max: 72, message: "Từ 8 đến 72 ký tự" }]}
            >
              <Input.Password prefix={<Lock size={16} strokeWidth={1.75} className="text-muted" />} autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              label="Nhập lại mật khẩu mới"
              name="confirm"
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "Nhập lại mật khẩu mới" },
                ({ getFieldValue }) => ({
                  validator: (_, v) => (!v || getFieldValue("newPassword") === v ? Promise.resolve() : Promise.reject(new Error("Mật khẩu nhập lại chưa khớp"))),
                }),
              ]}
            >
              <Input.Password prefix={<Lock size={16} strokeWidth={1.75} className="text-muted" />} autoComplete="new-password" />
            </Form.Item>
            {error && <Alert type="error" showIcon title={error} className="mb-4" />}
            <Button type="primary" htmlType="submit" block loading={loading}>
              Đặt lại mật khẩu
            </Button>
          </Form>
          <p className="mt-6 mb-0 text-center text-sm">
            <Link to="/login">Quay lại đăng nhập</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
