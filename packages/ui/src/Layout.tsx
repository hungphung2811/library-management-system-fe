import type { ReactNode } from "react";
import { Title } from "./antd";
import { Logo } from "./Logo";

/** [chiều cao, màu] của từng gáy sách ở dải trang trí bên trái màn hình đăng nhập. */
const SPINES: [number, string][] = [
  [150, "#1b84ff"], [190, "#0658be"], [130, "#a9cdff"], [210, "#1b84ff"], [160, "#d6e7ff"],
  [120, "#f5a524"], [200, "#056ee9"], [170, "#a9cdff"], [140, "#0658be"], [185, "#1b84ff"],
  [155, "#d6e7ff"], [205, "#f5a524"], [125, "#056ee9"],
];

/** Khung các trang chưa vào hệ thống (đăng nhập, đổi mật khẩu), bám Metronic demo1: thẻ form bên trái, panel thương hiệu bo góc bên phải. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen gap-5 bg-white p-4 lg:grid-cols-2 lg:p-5">
      <main className="grid place-items-center py-8">
        <div className="w-full max-w-[400px] rounded-xl border border-line bg-white p-8 shadow-xs">{children}</div>
      </main>
      <aside className="relative hidden flex-col overflow-hidden rounded-2xl bg-subtle p-12 lg:flex">
        <Logo size={56} />
        <p className="mt-6 mb-0 text-3xl leading-snug font-semibold text-ink">Mượn, trả và quản lý sách tại một nơi.</p>
        <p className="mt-3 mb-0 max-w-md text-base leading-relaxed text-muted">
          Dành cho thủ thư và quản trị viên. Quyền thao tác của mỗi tài khoản do vai trò quyết định.
        </p>
        <svg aria-hidden viewBox="0 0 520 220" className="mt-auto -mb-12 w-full" preserveAspectRatio="xMinYMax meet">
          {SPINES.map(([h, c], i) => (
            <rect key={i} x={i * 40} y={220 - h} width={34} height={h} rx={4} fill={c} />
          ))}
          <rect x={0} y={216} width={520} height={4} fill="#dbdfe9" />
        </svg>
      </aside>
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
        <Title level={3} className="mb-0! text-xl! font-medium!">
          {title}
        </Title>
        {description && <p className="mt-1 mb-0 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
