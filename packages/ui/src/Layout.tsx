import type { ReactNode } from "react";
import { Title } from "./antd";
import { Logo } from "./Logo";

/** Khung các trang chưa vào hệ thống (đăng nhập, đổi mật khẩu), bám Metronic: logo và thẻ form căn giữa trên nền nhạt. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-linear-to-br from-brand-50 via-white to-subtle p-4">
      <main className="flex w-full max-w-[420px] flex-col items-center gap-6 py-8">
        <Logo size={48} />
        <div className="w-full rounded-xl border border-line bg-white p-8 shadow-sm">{children}</div>
      </main>
    </div>
  );
}

/** Tiêu đề trang; `actions` là vùng nút thao tác chính bên phải (Metronic: toolbar). */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        <Title level={1} className="mb-0! text-xl! leading-snug! font-medium!">
          {title}
        </Title>
        {description && <p className="mt-1 mb-0 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
