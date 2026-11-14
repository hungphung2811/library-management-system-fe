"use client";
import { Avatar, Button, Menu, Tag, Typography } from "antd";
import { LogoutOutlined, ReadOutlined, UserOutlined } from "@ant-design/icons";

export type NavBarProps = {
  items: { href: string; label: string }[];
  current: string;
  user?: { id: string; role?: string };
};

/** Layout/spacing bằng Tailwind, control (Menu, Button, Avatar, Tag) bằng antd. */
export function NavBar({ items, current, user }: NavBarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-6 border-b border-slate-200/70 bg-white px-6 shadow-sm">
      <a href="/" className="flex items-center gap-2.5 no-underline">
        <span className="grid size-9 place-items-center rounded-[10px] bg-linear-to-br from-brand-500 to-accent text-lg text-white">
          <ReadOutlined />
        </span>
        <Typography.Text strong className="text-base">
          Thư viện
        </Typography.Text>
      </a>

      {/* Điều hướng giữa các zone phải là full page load nên dùng thẻ <a>, không dùng next/link */}
      <Menu
        mode="horizontal"
        selectedKeys={[current]}
        items={items.map((l) => ({ key: l.href, label: <a href={l.href}>{l.label}</a> }))}
        className="min-w-0 flex-1 border-b-0 bg-transparent"
      />

      {user ? (
        <form method="post" action="/api/session/logout" className="m-0 flex items-center gap-3">
          <Avatar size={32} icon={<UserOutlined />} className="bg-brand-600" />
          <span className="flex items-center gap-1.5">
            <Typography.Text title={user.id}>{user.id.slice(0, 8)}</Typography.Text>
            {user.role && <Tag color="geekblue" className="me-0">{user.role}</Tag>}
          </span>
          <Button htmlType="submit" icon={<LogoutOutlined />}>
            Đăng xuất
          </Button>
        </form>
      ) : (
        <Button type="primary" href="/login">
          Đăng nhập
        </Button>
      )}
    </header>
  );
}
