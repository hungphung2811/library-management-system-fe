import type { ReactNode } from "react";
import { Title } from "./antd";
import { useDetailModal } from "./DetailModal";
import { Logo } from "./Logo";

/** Khung các trang chưa vào hệ thống (đăng nhập, đổi mật khẩu), bám Metronic: logo và thẻ form căn giữa trên nền nhạt. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-linear-to-br from-primary-soft via-canvas to-violet-soft p-4">
      <main className="flex w-full max-w-[420px] flex-col items-center gap-6 py-8">
        <Logo size={48} />
        <div className="w-full rounded-card border border-line bg-surface p-8 shadow-card">{children}</div>
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
  // Trong modal chi tiết: tiêu đề nhỏ hơn, tránh hai tiêu đề cấp 1 trên cùng trang (trang danh sách ở nền đã có).
  const inModal = !!useDetailModal();
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <Title level={inModal ? 2 : 1} className="mb-0! text-title! leading-snug! font-semibold!">
          {title}
        </Title>
        {description && <p className="mt-0.5 mb-0 text-body text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
