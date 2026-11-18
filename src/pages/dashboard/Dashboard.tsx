import { useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { useApi } from "@/api";
import { Segmented, Skeleton, formatMoney } from "@/ui";
import { Donut, Legend, RankBars, Sparkline, TrendChart, compact } from "./charts";

type Summary = {
  catalog?: { titles: number; copies?: { total: number; byStatus: Record<string, number> } | null } | null;
  lending?: { activeBorrowings: number; overdueBorrowings: number; overdueCopies: number; borrowedToday: number; returnedToday: number } | null;
  fines?: { unpaidCount: number; unpaidAmount: number } | null;
  sales?: { ordersToday: number; revenueToday: number; pendingOnlineOrders: number; lowStockCount: number } | null;
};
type BorrowTrend = { points: { bucket: string; borrowed: number; returned: number }[] };
type RevenueTrend = { totals: { gross: number; refunds: number; net: number; orders: number }; points: { date: string; gross: number; net: number; orders: number }[] };
type TopBorrowed = { items: { titleId: string; titleName: string | null; count: number }[] };
type TopSold = { items: { titleId: string; titleName: string | null; quantity: number; revenue: number }[] };

// Màu biểu đồ lấy từ token theme (CSS variable) để khớp thương hiệu.
export const C = {
  primary: "var(--color-primary)",
  violet: "var(--color-violet)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-info)",
};
const COPY_STATUS: Record<string, { name: string; color: string }> = {
  AVAILABLE: { name: "Sẵn sàng", color: C.success },
  LOANED: { name: "Đang mượn", color: C.primary },
  RESERVED: { name: "Đã đặt trước", color: C.info },
  DAMAGED: { name: "Hư hỏng", color: C.warning },
  LOST: { name: "Mất", color: C.error },
};

const RANGES = [
  { label: "7 ngày", value: 7 },
  { label: "30 ngày", value: 30 },
  { label: "90 ngày", value: 90 },
];

export function Panel({ title, hint, right, children, className = "" }: { title: string; hint?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-4 shadow-card ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="m-0 text-section font-semibold text-ink">{title}</h3>
          {hint && <p className="m-0 mt-0.5 text-caption text-muted">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ loading, error, empty }: { loading: boolean; error: boolean; empty?: boolean }) {
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} title={false} />;
  return (
    <div className="grid h-40 place-items-center text-body text-muted">
      {error ? "Không tải được dữ liệu phần này" : empty ? "Chưa có dữ liệu trong khoảng này" : null}
    </div>
  );
}

export function Kpi({ label, value, sub, color, spark }: { label: string; value: string; sub?: string; color: string; spark?: number[] }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="text-caption text-muted">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <div className="text-[26px] leading-tight font-semibold text-ink">{value}</div>
          {sub && <div className="mt-0.5 text-caption text-muted">{sub}</div>}
        </div>
        {spark && <Sparkline values={spark} color={color} />}
      </div>
    </div>
  );
}

const shortDate = (iso: string) => dayjs(iso).format("DD/MM");

export default function Dashboard({ lending, sales }: { lending: boolean; sales: boolean }) {
  const [days, setDays] = useState(30);
  const { from, to } = useMemo(() => ({ from: dayjs().subtract(days - 1, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") }), [days]);
  const range = `from=${from}&to=${to}`;
  const gran = days > 60 ? "week" : "day";
  const opt = { staleTime: 30_000 };

  const summary = useApi<Summary>("/api/dashboard/summary", opt);
  const borrow = useApi<BorrowTrend>(lending ? `/api/dashboard/charts/borrowings?${range}&granularity=${gran}` : null, opt);
  const revenue = useApi<RevenueTrend>(sales ? `/api/dashboard/charts/revenue?${range}` : null, opt);
  const topBorrowed = useApi<TopBorrowed>(lending ? `/api/dashboard/top-titles/borrowed?${range}&limit=5` : null, opt);
  const topSold = useApi<TopSold>(sales ? `/api/dashboard/top-titles/sold?${range}&limit=5` : null, opt);

  const s = summary.data;
  const bp = borrow.data?.points ?? [];
  const rp = revenue.data?.points ?? [];
  const copies = s?.catalog?.copies?.byStatus ?? {};
  const slices = Object.keys(COPY_STATUS).map((k) => ({ ...COPY_STATUS[k], value: copies[k] ?? 0 })).filter((x) => x.value > 0);

  const kpis: { label: string; value: string; sub?: string; color: string; spark?: number[] }[] = [];
  if (s?.catalog) kpis.push({ label: "Đầu sách", value: compact(s.catalog.titles), sub: s.catalog.copies ? `${s.catalog.copies.total} bản sao` : undefined, color: C.primary });
  if (s?.lending) {
    kpis.push({ label: "Đang mượn", value: String(s.lending.activeBorrowings), sub: `Hôm nay: ${s.lending.borrowedToday} mượn, ${s.lending.returnedToday} trả`, color: C.violet, spark: bp.map((p) => p.borrowed) });
    kpis.push({ label: "Quá hạn", value: String(s.lending.overdueBorrowings), sub: `${s.lending.overdueCopies} bản sao chưa trả`, color: s.lending.overdueBorrowings > 0 ? C.error : C.success });
  }
  if (s?.fines) kpis.push({ label: "Phạt chưa thu", value: formatMoney(s.fines.unpaidAmount), sub: `${s.fines.unpaidCount} khoản`, color: C.warning });
  if (s?.sales) {
    kpis.push({ label: "Doanh thu hôm nay", value: formatMoney(s.sales.revenueToday), sub: `${s.sales.ordersToday} đơn, ${s.sales.pendingOnlineOrders} chờ xử lý`, color: C.success, spark: rp.map((p) => p.net) });
    kpis.push({ label: "Sắp hết hàng", value: String(s.sales.lowStockCount), sub: "Mặt hàng dưới ngưỡng tồn", color: s.sales.lowStockCount > 0 ? C.warning : C.success });
  }

  if (summary.isError && !s && !lending && !sales) return null;

  return (
    <div className="mb-6 grid gap-4" data-testid="dashboard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-section font-semibold text-ink">Số liệu hoạt động</h2>
        <Segmented size="small" value={days} onChange={(v) => setDays(Number(v))} options={RANGES} aria-label="Khoảng thời gian" />
      </div>

      {summary.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card border border-line bg-subtle" />
          ))}
        </div>
      ) : (
        kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => (
              <Kpi key={k.label} {...k} />
            ))}
          </div>
        )
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {lending && (
          <Panel title="Lượt mượn và trả" hint={gran === "week" ? "Theo tuần" : "Theo ngày"} right={<Legend items={[{ name: "Mượn", color: C.primary }, { name: "Trả", color: C.success }]} />}>
            {bp.length === 0 ? (
              <Placeholder loading={borrow.isLoading} error={borrow.isError} empty />
            ) : (
              <TrendChart
                kind="area"
                ariaLabel="Biểu đồ lượt mượn và trả theo thời gian"
                labels={bp.map((p) => shortDate(p.bucket))}
                series={[
                  { name: "Mượn", color: C.primary, values: bp.map((p) => p.borrowed) },
                  { name: "Trả", color: C.success, values: bp.map((p) => p.returned) },
                ]}
              />
            )}
          </Panel>
        )}
        {sales && (
          <Panel
            title="Doanh thu thực thu"
            hint={revenue.data ? `Tổng ${formatMoney(revenue.data.totals.net)} từ ${revenue.data.totals.orders} đơn` : undefined}
          >
            {rp.length === 0 ? (
              <Placeholder loading={revenue.isLoading} error={revenue.isError} empty />
            ) : (
              <TrendChart kind="bar" ariaLabel="Biểu đồ doanh thu theo ngày" labels={rp.map((p) => shortDate(p.date))} series={[{ name: "Thực thu", color: C.violet, values: rp.map((p) => p.net) }]} format={formatMoney} />
            )}
          </Panel>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {lending && slices.length > 0 && (
          <Panel title="Tình trạng bản sao">
            <Donut slices={slices} centerLabel="bản sao" />
          </Panel>
        )}
        {lending && (
          <Panel title="Sách được mượn nhiều" hint={`${days} ngày gần nhất`}>
            {(topBorrowed.data?.items.length ?? 0) === 0 ? (
              <Placeholder loading={topBorrowed.isLoading} error={topBorrowed.isError} empty />
            ) : (
              <RankBars color={C.primary} items={topBorrowed.data!.items.map((i) => ({ key: i.titleId, label: i.titleName ?? "(không rõ tên)", value: i.count, hint: "lượt" }))} />
            )}
          </Panel>
        )}
        {sales && (
          <Panel title="Sách bán chạy" hint={`${days} ngày gần nhất`}>
            {(topSold.data?.items.length ?? 0) === 0 ? (
              <Placeholder loading={topSold.isLoading} error={topSold.isError} empty />
            ) : (
              <RankBars color={C.violet} items={topSold.data!.items.map((i) => ({ key: i.titleId, label: i.titleName ?? "(không rõ tên)", value: i.quantity, hint: formatMoney(i.revenue) }))} />
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
