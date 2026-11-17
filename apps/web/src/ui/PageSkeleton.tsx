import type { CSSProperties } from "react";

/** Khối xám nhấp nháy; `motion-reduce` tắt hiệu ứng cho người dùng giảm chuyển động. */
function Bar({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div style={style} className={`animate-pulse rounded-control bg-line/70 motion-reduce:animate-none ${className}`} />;
}

/** Cột nhiều dòng của bảng: độ rộng so le để trông giống dữ liệu thật. */
const WIDTHS = ["72%", "58%", "84%", "46%", "66%", "78%", "52%", "70%"];

function TableBody({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex gap-6 border-b border-line bg-canvas px-4 py-2.5">
        {Array.from({ length: cols }, (_, c) => (
          <Bar key={c} className="h-3 flex-1" style={{ maxWidth: c === 0 ? 120 : 96 }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line px-4 py-3 last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <Bar key={c} className="h-3.5 flex-1" style={{ maxWidth: c === 0 ? 140 : undefined, width: WIDTHS[(r + c * 3) % WIDTHS.length] }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Khung chờ tải của một trang: dựng đúng bố cục PageHeader (tiêu đề + mô tả) rồi phần thân theo `variant`,
 * để lúc dữ liệu về trang không bị nhảy bố cục.
 * - table: thanh công cụ + bảng; detail: ảnh bìa + khối thông tin; cards: hàng thẻ số liệu + bảng; form: các ô nhập.
 */
export function PageSkeleton({
  variant = "table",
  rows = 6,
  maxWidth = 1200,
}: {
  variant?: "table" | "detail" | "cards" | "form";
  rows?: number;
  maxWidth?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite" role="status" style={{ maxWidth }}>
      <span className="sr-only">Đang tải…</span>
      <div className="mb-4">
        <Bar className="h-5 w-48" />
        <Bar className="mt-2.5 h-3 w-72 max-w-full" />
      </div>
      {variant === "table" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Bar className="h-8 w-72 max-w-full" />
            <Bar className="h-8 w-28" />
          </div>
          <TableBody rows={rows} cols={5} />
        </div>
      )}
      {variant === "cards" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-card border border-line bg-surface p-4">
                <Bar className="h-3 w-20" />
                <Bar className="mt-3 h-6 w-14" />
              </div>
            ))}
          </div>
          <TableBody rows={Math.min(rows, 5)} cols={3} />
        </div>
      )}
      {variant === "detail" && (
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <Bar className="aspect-[3/4] w-full rounded-card" />
          <div className="flex flex-col gap-3">
            <Bar className="h-6 w-2/3" />
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex gap-4">
                <Bar className="h-3.5 w-28" />
                <Bar className="h-3.5 flex-1" style={{ maxWidth: WIDTHS[i % WIDTHS.length] }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {variant === "form" && (
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
            <div key={i}>
              <Bar className="h-3 w-28" />
              <Bar className="mt-2 h-8 w-full" />
            </div>
          ))}
          <Bar className="h-8 w-28" />
        </div>
      )}
    </div>
  );
}
