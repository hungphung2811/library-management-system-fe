"use client";
import { useState } from "react";
import { Alert, Button, Card, Form, Input, LockOutlined, ReadOutlined, Text, Title, UserOutlined } from "@mfe/ui";

type Values = { username: string; password: string };

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
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
    <main className="grid min-h-screen place-items-center bg-linear-to-br from-brand-50 to-violet-50 p-4">
      <Card className="w-full max-w-sm shadow-xl shadow-brand-600/10">
        <div className="mb-6 text-center">
          <span className="inline-grid size-13 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-accent text-2xl text-white">
            <ReadOutlined />
          </span>
          <Title level={3} className="mt-3 mb-1">Đăng nhập</Title>
          <Text type="secondary">Hệ thống quản lý thư viện</Text>
        </div>

        <Form<Values> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <Form.Item name="username" rules={[{ required: true, message: "Nhập tên đăng nhập" }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "Nhập mật khẩu" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" autoComplete="current-password" />
          </Form.Item>
          {error && <Alert type="error" showIcon title={error} className="mb-4" />}
          <Button type="primary" htmlType="submit" block loading={loading}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </main>
  );
}
