import { redirect } from "next/navigation";
import { Button, Card, Descriptions, Nav, Page, PageHeader, ReadOutlined, SettingOutlined, SwapOutlined, Tag, Text } from "@mfe/ui";
import { getSession } from "@mfe/api";

const modules = [
  { href: "/catalog", title: "Sách", desc: "Tra cứu và quản lý đầu sách", icon: <ReadOutlined /> },
  { href: "/circulation", title: "Mượn trả", desc: "Mượn, trả và gia hạn sách", icon: <SwapOutlined /> },
  { href: "/admin", title: "Quản trị", desc: "Người dùng, phân quyền, nhật ký", icon: <SettingOutlined /> },
];

export default async function Home() {
  const s = await getSession();
  if (s?.mustChangePassword) redirect("/change-password");
  return (
    <>
      <Nav current="/" session={s} />
      <Page>
        <PageHeader title="Hệ thống quản lý thư viện" description="Chọn một phân hệ để bắt đầu" />

        <Card className="mb-6">
          {s ? (
            <Descriptions
              column={1}
              items={[
                { key: "roles", label: "Vai trò", children: s.roles.map((r) => <Tag key={r} color="geekblue">{r}</Tag>) },
                { key: "perm", label: "Quyền", children: s.admin ? "Quản trị viên (toàn quyền)" : `${s.permissions.length} khóa quyền` },
              ]}
            />
          ) : (
            <div className="flex items-center gap-3">
              <Text>Bạn chưa đăng nhập.</Text>
              <Button type="primary" href="/login">Đăng nhập</Button>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {modules.map((m) => (
            <a key={m.href} href={m.href} className="no-underline">
              <Card hoverable className="h-full">
                <div className="text-3xl text-brand-600">{m.icon}</div>
                <div className="mt-2 text-base font-semibold">{m.title}</div>
                <Text type="secondary">{m.desc}</Text>
              </Card>
            </a>
          ))}
        </div>
      </Page>
    </>
  );
}
