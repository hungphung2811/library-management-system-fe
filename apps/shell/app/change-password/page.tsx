"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, LockOutlined, Text, Title } from "@mfe/ui";

type Values = { currentPassword: string; newPassword: string; confirm: string };

export default function ChangePasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Trang này ở shell; đã đăng nhập mới vào được (proxy.ts chặn), dùng token qua BFF.
  useEffect(() => setError(null), []);

  async function onFinish(values: Values) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/bff/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    });
    if (res.ok) {
      // Token cũ không mang quyền; xoá phiên rồi đăng nhập lại để nhận token đầy đủ.
      await fetch("/api/session/logout", { method: "POST" });
      location.href = "/login?changed=1";
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.message ?? "Đổi mật khẩu thất bại");
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-linear-to-br from-brand-50 to-violet-50 p-4">
      <Card className="w-full max-w-sm shadow-xl shadow-brand-600/10">
        <div className="mb-6 text-center">
          <Title level={3} className="mb-1">Đổi mật khẩu</Title>
          <Text type="secondary">Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống</Text>
        </div>

        <Form<Values> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <Form.Item name="currentPassword" rules={[{ required: true, message: "Nhập mật khẩu hiện tại" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu hiện tại" autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: "Nhập mật khẩu mới" },
              { min: 8, message: "Mật khẩu mới tối thiểu 8 ký tự" },
              { max: 72, message: "Mật khẩu mới tối đa 72 ký tự" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu mới" autoComplete="new-password" />
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
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
          </Form.Item>
          {error && <Alert type="error" showIcon title={error} className="mb-4" />}
          <Button type="primary" htmlType="submit" block loading={loading}>
            Đổi mật khẩu
          </Button>
        </Form>
      </Card>
    </main>
  );
}
