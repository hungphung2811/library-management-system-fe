import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { toErrorInfo } from "@/api";
import { BootScreen, safeNext } from "@/auth/ProtectedRoute";
import { useAuth } from "@/auth/AuthProvider";
import { Alert, AuthShell, Button, Form, Input, Lock, Title, User, describeError } from "@/ui";

type Values = { username: string; password: string };

export default function LoginPage() {
  const { session, ready, login } = useAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Sau khi đổi mật khẩu, change-password chuyển về đây kèm ?changed=1
  const changed = sp.get("changed") === "1";
  const reset = sp.get("reset") === "1";
  const next = safeNext(sp.get("next"));

  if (!ready) return <BootScreen />;
  // Đã có phiên (mở /login khi đang đăng nhập, hoặc vừa đăng nhập xong): vào trang định tới; ProtectedRoute lo mustChangePassword.
  if (session && !loading) return <Navigate to={next} replace />;

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    try {
      const r = await login(values.username, values.password);
      void navigate(r.mustChangePassword ? "/change-password" : next, { replace: true });
    } catch (e) {
      const info = toErrorInfo(e);
      // 4xx: giữ nguyên message của BE ("Sai tên đăng nhập hoặc mật khẩu"...); lỗi mạng/5xx dùng câu chung.
      setError(info.status >= 400 && info.status < 500 && info.message ? info.message : describeError(info).text);
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Title level={1} className="mb-2! text-center text-xl! leading-tight! font-semibold!">Đăng nhập vào Thư viện</Title>
      <p className="mt-0 mb-7 text-center text-sm text-muted">Nhập tài khoản được cấp để vào hệ thống quản lý thư viện.</p>

      <Form<Values> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
        <Form.Item label="Tên đăng nhập" name="username" rules={[{ required: true, message: "Nhập tên đăng nhập" }]}>
          <Input prefix={<User size={16} strokeWidth={1.75} className="text-muted" />} placeholder="Nhập tên đăng nhập" autoComplete="username" />
        </Form.Item>
        <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
          <Input.Password prefix={<Lock size={16} strokeWidth={1.75} className="text-muted" />} placeholder="Nhập mật khẩu" autoComplete="current-password" />
        </Form.Item>
        {changed && !error && (
          <Alert type="success" showIcon title="Đổi mật khẩu thành công, vui lòng đăng nhập lại." className="mb-4" />
        )}
        {reset && !changed && !error && (
          <Alert type="success" showIcon title="Đã đặt lại mật khẩu, vui lòng đăng nhập bằng mật khẩu mới." className="mb-4" />
        )}
        <p className="mt-0 mb-4 text-right text-sm">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </p>
        {error && <Alert type="error" showIcon title={error} className="mb-4" />}
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đăng nhập
        </Button>
      </Form>
    </AuthShell>
  );
}
