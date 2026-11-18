import { usePageSize } from "@/ui";
import { Link, useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { DataTable, DatePicker, QueryBoundary, Select, dayjs, type DataColumn } from "@/ui";
import { SalesGate } from "./_components/SalesGate";
import { AUDIT_ACTIONS, label, pageParams, type AuditEntry, type Page } from "./_lib/sales";

const AGGREGATES: Record<string, string> = {
  ORDER: "Đơn hàng",
  RETURN: "Phiếu trả",
  REFUND: "Khoản hoàn",
  GOODS_RECEIPT: "Phiếu nhập",
  STOCK_ITEM: "Mặt hàng",
  SETTINGS: "Cấu hình",
  SUPPLIER: "Nhà cung cấp",
};
// Phòng thủ: BE đã không trả dữ liệu cá nhân; FE vẫn không hiển thị các khóa nghi là PII nếu sau này lọt vào.
const PII_KEYS = /name|phone|address|email|contact|recipient/i;

function summarize(data: Record<string, unknown> | null): string {
  if (!data) return "—";
  const parts = Object.entries(data)
    .filter(([k, v]) => !PII_KEYS.test(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
    .map(([k, v]) => `${k}=${String(v)}`);
  return parts.length ? parts.join(", ") : "—";
}

export default function AuditPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const SIZE = usePageSize();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const action = sp.get("action") ?? "";
  const aggregateType = sp.get("aggregateType") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const allowed = can(s, PERMISSIONS.SALES_AUDIT_SEARCH);
  const canOrder = can(s, PERMISSIONS.SALES_ORDER_VIEW);
  // `from` bao gồm, `to` loại trừ (ISO-8601): ngày kết thúc người dùng chọn là bao gồm nên cộng một ngày.
  const iso = (d: string, plus = 0) => (d ? dayjs(d).add(plus, "day").startOf("day").toISOString() : undefined);
  const q = useApi<Page<AuditEntry>>(
    allowed ? `/api/sales/audit-log?${pageParams(sp, SIZE, { action, aggregateType, from: iso(from), to: iso(to, 1) })}` : null,
  );

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete("page");
    setSp(n, { replace: true });
  };

  const columns: DataColumn[] = [
    { key: "at", title: "Thời điểm", dataIndex: "occurredAt", kind: "datetime" },
    { key: "act", title: "Hành động", dataIndex: "action", render: (v) => label(AUDIT_ACTIONS, v as string) },
    { key: "actor", title: "Người thao tác", dataIndex: "actorId", render: (v) => (v ? <span className="font-mono">{String(v).slice(0, 8)}</span> : "Hệ thống") },
    {
      key: "ref",
      title: "Tham chiếu",
      dataIndex: "aggregateId",
      render: (v, r) => {
        const type = String(r.aggregateType);
        const text = `${label(AGGREGATES, type)} ${v ? String(v).slice(0, 8) : ""}`.trim();
        return canOrder && v && type === "ORDER" ? (
          <Link className="text-primary hover:underline" to={`/sales/orders/${encodeURIComponent(String(v))}`}>
            {text}
          </Link>
        ) : (
          text
        );
      },
    },
    { key: "data", title: "Chi tiết", dataIndex: "data", render: (v) => <span className="text-xs text-muted">{summarize(v as Record<string, unknown> | null)}</span> },
  ];

  return (
    <SalesGate
      title="Nhật ký bán hàng"
      description="Các thao tác nghiệp vụ bán hàng, mới nhất trước. Nhật ký không chứa dữ liệu cá nhân của khách."
      permission={PERMISSIONS.SALES_AUDIT_SEARCH}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Hành động"
            className="w-56"
            value={action}
            onChange={(v) => set("action", v)}
            options={[{ value: "", label: "Mọi hành động" }, ...Object.entries(AUDIT_ACTIONS).map(([value, l]) => ({ value, label: l }))]}
          />
          <Select
            aria-label="Đối tượng"
            className="w-44"
            value={aggregateType}
            onChange={(v) => set("aggregateType", v)}
            options={[{ value: "", label: "Mọi đối tượng" }, ...Object.entries(AGGREGATES).map(([value, l]) => ({ value, label: l }))]}
          />
          <DatePicker.RangePicker
            allowClear
            format="DD/MM/YYYY"
            placeholder={["Từ ngày", "Đến ngày"]}
            value={from && to ? [dayjs(from), dayjs(to)] : null}
            onChange={(v) => {
              const n = new URLSearchParams(sp);
              if (v?.[0] && v?.[1]) {
                n.set("from", v[0].format("YYYY-MM-DD"));
                n.set("to", v[1].format("YYYY-MM-DD"));
              } else {
                n.delete("from");
                n.delete("to");
              }
              n.delete("page");
              setSp(n, { replace: true });
            }}
          />
        </div>
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: "Chưa có nhật ký nào.", hint: "Thử đổi bộ lọc." }}
            />
          )}
        </QueryBoundary>
      </div>
    </SalesGate>
  );
}
