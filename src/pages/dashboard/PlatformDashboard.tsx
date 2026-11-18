import { Link } from "react-router";
import { useApi } from "@/api";
import { Skeleton, formatDate, formatMoney } from "@/ui";
import { C, Kpi, Panel } from "./Dashboard";
import { Donut, RankBars } from "./charts";

type Overview = {
  tenants: { total: number; active: number; suspended: number };
  activeTenantsByModule: Record<string, number>;
  withinDays: number;
  expiringContractCount: number;
  expiringContracts: {
    contractId: string;
    tenantId: string;
    tenantCode: string;
    tenantName: string;
    name: string;
    endDate: string;
    daysLeft: number;
    inGrace: boolean;
    outstandingAmount: number;
  }[];
};

const MODULE_NAME: Record<string, string> = { LENDING: "Mượn trả (LENDING)", SALES: "Bán hàng (SALES)" };

/** Tổng quan nền tảng SaaS cho platform admin chưa chọn đơn vị: số tenant, module đang bật, hợp đồng sắp hết hạn. */
export default function PlatformDashboard() {
  const q = useApi<Overview>("/api/platform/dashboard/overview?withinDays=30", { staleTime: 30_000 });
  const o = q.data;
  if (q.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (!o) return <div className="mb-6 text-body text-muted">Không tải được tổng quan nền tảng.</div>;

  const { total, active, suspended } = o.tenants;
  const modules = Object.entries(o.activeTenantsByModule).map(([k, v]) => ({ key: k, label: MODULE_NAME[k] ?? k, value: v, hint: "đơn vị" }));
  return (
    <div className="mb-6 grid gap-4" data-testid="platform-dashboard">
      <h2 className="m-0 text-section font-semibold text-ink">Tổng quan nền tảng</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Tổng đơn vị" value={String(total)} sub="Tenant đã tạo" color={C.primary} />
        <Kpi label="Đang hoạt động" value={String(active)} sub={total ? `${Math.round((active / total) * 100)}% tổng số` : undefined} color={C.success} />
        <Kpi label="Tạm ngưng" value={String(suspended)} sub="Cần xem xét" color={suspended > 0 ? C.warning : C.success} />
        <Kpi label="Hợp đồng sắp hết hạn" value={String(o.expiringContractCount)} sub={`Trong ${o.withinDays} ngày tới`} color={o.expiringContractCount > 0 ? C.error : C.success} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Trạng thái đơn vị">
          <Donut
            centerLabel="đơn vị"
            slices={[
              { name: "Hoạt động", value: active, color: C.success },
              { name: "Tạm ngưng", value: suspended, color: C.warning },
            ]}
          />
        </Panel>
        <Panel title="Đơn vị đang dùng theo module" hint="Chỉ tính đơn vị đang hoạt động">
          {modules.length === 0 ? <div className="grid h-32 place-items-center text-body text-muted">Chưa có module nào được bật</div> : <RankBars color={C.violet} items={modules} />}
        </Panel>
        <Panel title="Hợp đồng sắp hết hạn" hint={`Trong ${o.withinDays} ngày tới`} right={<Link to="/platform/contracts" className="text-caption font-medium text-primary no-underline hover:underline">Xem tất cả</Link>}>
          {o.expiringContracts.length === 0 ? (
            <div className="grid h-32 place-items-center text-body text-muted">Không có hợp đồng sắp hết hạn</div>
          ) : (
            <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
              {o.expiringContracts.slice(0, 5).map((c) => (
                <li key={c.contractId} className="flex items-center justify-between gap-3 text-body">
                  <Link to={`/platform/tenants/${c.tenantId}`} className="min-w-0 flex-1 text-ink no-underline hover:text-primary">
                    <div className="truncate font-medium">{c.tenantName}</div>
                    <div className="truncate text-caption text-muted">{c.name} · hết hạn {formatDate(c.endDate)}{c.outstandingAmount > 0 ? ` · nợ ${formatMoney(c.outstandingAmount)}` : ""}</div>
                  </Link>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${c.inGrace || c.daysLeft <= 7 ? "bg-error-soft text-error" : "bg-warning-soft text-warning"}`}>
                    {c.inGrace ? "Ân hạn" : `${c.daysLeft} ngày`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
