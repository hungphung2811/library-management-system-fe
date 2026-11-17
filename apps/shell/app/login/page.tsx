"use client";
import { useEffect, useState } from "react";
import { Alert, AuthShell, Button, Form, Input, Title, Lock, User } from "@mfe/ui";

type Values = { username: string; password: string };

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [changed, setChanged] = useState(false);

  // Sau khi đổi mật khẩu, change-password chuyển về đây kèm ?changed=1
  useEffect(() => {
    setChanged(new URLSearchParams(location.search).get("changed") === "1");
  }, []);

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      const result = await res.json().catch(() => ({}));
      if (result.mustChangePassword) {
        location.href = "/change-password";
        return;
      }
      const raw = new URLSearchParams(location.search).get("next") ?? "/";
      // Full reload để cookie có hiệu lực với mọi zone
      location.href = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.message ?? "Đăng nhập thất bại");
    setLoading(false);
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
        {error && <Alert type="error" showIcon title={error} className="mb-4" />}
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đăng nhập
        </Button>
      </Form>
    </AuthShell>
  );
}
