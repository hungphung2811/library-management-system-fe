import { redirect } from "next/navigation";
import { AppShell, ArrowLeftRight, BookOpen, Button, KeyRound, PageHeader, ShieldCheck, Tag } from "@mfe/ui";
import { getSession } from "@mfe/api";

const modules = [
  {
    href: "/catalog",
    title: "Sách",
    desc: "Đầu sách và bản sao",
    icon: <BookOpen size={22} strokeWidth={1.75} />,
    tile: "bg-brand-50 text-brand-600",
  },
  {
    href: "/circulation",
    title: "Mượn trả",
    desc: "Mượn, trả, gia hạn",
    icon: <ArrowLeftRight size={22} strokeWidth={1.75} />,
    tile: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/admin",
    title: "Quản trị",
    desc: "Phân quyền hệ thống",
    icon: <ShieldCheck size={22} strokeWidth={1.75} />,
    tile: "bg-amber-50 text-amber-600",
  },
  {
    href: "/change-password",
    title: "Mật khẩu",
    desc: "Đổi mật khẩu của bạn",
    icon: <KeyRound size={22} strokeWidth={1.75} />,
    tile: "bg-violet-50 text-violet-600",
  },
];

export default async function Home() {
  const s = await getSession();
  if (s?.mustChangePassword) redirect("/change-password");
  const name = s?.username ?? s?.userId.slice(0, 8);

  return (
    <AppShell current="/" session={s}>
      <PageHeader title="Tổng quan" description="Chọn một phân hệ để bắt đầu làm việc" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid grid-cols-2 gap-5">
          {modules.map((m) => (
            <a
              key={m.href}
              href={m.href}
              className="group flex flex-col rounded-xl border border-line bg-white p-5 text-ink no-underline shadow-xs transition-colors hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none"
            >
              <span className={`grid size-11 place-items-center rounded-xl ${m.tile}`}>{m.icon}</span>
              <span className="mt-8 text-2xl font-semibold group-hover:text-brand-500">{m.title}</span>
              <span className="mt-1 text-sm text-muted">{m.desc}</span>
            </a>
          ))}
        </div>

        <section className="flex flex-col rounded-xl border border-line bg-white shadow-xs">
          <div className="flex-1 p-8">
            {s ? (
              <>
                <h2 className="m-0 text-2xl leading-snug font-semibold">
                  Xin chào, <span className="text-brand-500">{name}</span>
                </h2>
                <p className="mt-3 mb-0 max-w-lg text-sm leading-relaxed text-muted">
                  Các phân hệ bạn thấy trong thanh bên phụ thuộc vào vai trò và quyền được cấp cho tài khoản này.
                </p>
                <dl className="mt-6 mb-0 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="mb-2 text-sm text-muted">Vai trò</dt>
                    <dd className="m-0 flex flex-wrap gap-2">
                      {s.roles.length ? s.roles.map((r) => <Tag key={r} color="blue" className="me-0">{r}</Tag>) : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-2 text-sm text-muted">Phạm vi quyền</dt>
                    <dd className="m-0 text-sm font-medium">
                      {s.admin ? "Quản trị viên (toàn quyền)" : `${s.permissions.length} khóa quyền được cấp`}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <h2 className="m-0 text-2xl leading-snug font-semibold">Hệ thống quản lý thư viện</h2>
                <p className="mt-3 mb-6 max-w-lg text-sm leading-relaxed text-muted">
                  Bạn chưa đăng nhập. Đăng nhập để dùng các phân hệ được cấp quyền.
                </p>
                <Button type="primary" href="/login">
                  Đăng nhập
                </Button>
              </>
            )}
          </div>
          <div className="border-t border-line px-8 py-4 text-center">
            <a
              href="/circulation"
              className="border-0 border-b border-dashed border-brand-500 pb-px text-sm font-medium text-brand-500 no-underline hover:text-brand-600"
            >
              Mở phân hệ Mượn trả
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
