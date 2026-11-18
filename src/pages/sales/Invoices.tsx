import { useMemo, useState } from "react";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Alert, DataTable, Eye, FilterBar, QueryBoundary, Tag, actionsColumn, dayjs, useFilterParams, type DataColumn, type FilterField } from "@/ui";
import { InvoiceViewModal } from "./_components/InvoiceViewModal";
import { SalesGate } from "./_components/SalesGate";
import { INVOICE_KIND, INVOICE_STATUS, INVOICE_STATUS_COLOR, buyerLabel, type InvoiceSummary } from "./_lib/invoices";
import { label, type Page } from "./_lib/sales";

const SCHEMA: FilterField[] = [
  { type: "text", name: "keyword", label: "Tìm theo số đơn, số hóa đơn, người mua, MST", placeholder: "Số đơn, số hóa đơn, người mua, MST" },
  { type: "select", name: "status", label: "Trạng thái", options: Object.entries(INVOICE_STATUS).map(([value, l]) => ({ value, label: l })) },
  { type: "select", name: "kind", label: "Loại", options: Object.entries(INVOICE_KIND).map(([value, l]) => ({ value, label: l })) },
  { type: "dateRange", name: "created", label: "Ngày lập" },
];

/** Danh sách hóa đơn VAT nội bộ của cửa hàng: lọc theo trạng thái, loại, ngày và từ khóa (số hóa đơn, số đơn, người mua). */
export default function InvoicesPage() {
  const s = useSession();
  const f = useFilterParams(SCHEMA, { defaultSize: 20 });
  const allowed = can(s, PERMISSIONS.INVOICE_SEARCH);
  const [view, setView] = useState<string | null>(null);
  const range = f.range("created");
  // `from` bao gồm, `to` loại trừ (ISO-8601): ngày kết thúc người dùng chọn là bao gồm nên cộng một ngày.
  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of ["keyword", "status", "kind"]) if (f.str(k)) q.set(k, f.str(k));
    if (range.from) q.set("from", dayjs(range.from).startOf("day").toISOString());
    if (range.to) q.set("to", dayjs(range.to).add(1, "day").startOf("day").toISOString());
    q.set("page", String(f.page - 1));
    q.set("size", String(f.size));
    return q.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.values, f.page, f.size]);
  const q = useApi<Page<InvoiceSummary>>(allowed ? `/api/sales/invoices?${query}` : null);
  const canView = can(s, PERMISSIONS.INVOICE_GET) || can(s, PERMISSIONS.INVOICE_PRINT);
  const canOrder = can(s, PERMISSIONS.SALES_ORDER_VIEW);

  const columns: DataColumn[] = [
    {
      key: "no",
      title: "Số hóa đơn",
      dataIndex: "invoiceNumber",
      render: (v, r) =>
        canView ? (
          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-mono font-medium text-primary hover:underline" onClick={() => setView(String(r.id))}>
            {String(v ?? "(chưa có số)")}
          </button>
        ) : (
          <span className="font-mono">{String(v ?? "—")}</span>
        ),
    },
    { key: "series", title: "Mẫu / ký hiệu", dataIndex: "series", render: (v, r) => `${String(r.templateCode ?? "")} / ${String(v ?? "")}` },
    { key: "kind", title: "Loại", dataIndex: "kind", render: (v) => label(INVOICE_KIND, v as string) },
    { key: "st", title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={INVOICE_STATUS_COLOR[v as string]}>{label(INVOICE_STATUS, v as string)}</Tag> },
    { key: "order", title: "Đơn", dataIndex: "orderNo", kind: canOrder ? "link" : "mono", href: "/sales/orders/{orderId}" },
    { key: "buyer", title: "Người mua", dataIndex: "buyerName", render: (_, r) => <span>{buyerLabel({ name: r.buyerName as string | null, company: r.buyerCompany as string | null })}</span> },
    { key: "tax", title: "MST", dataIndex: "buyerTaxCode", kind: "mono" },
    { key: "total", title: "Tổng tiền", dataIndex: "grandTotal", kind: "money", align: "right" },
    { key: "at", title: "Ngày lập", dataIndex: "issuedAt", kind: "datetime" },
    ...(canView ? [actionsColumn((row) => [{ key: "view", label: "Xem và in", icon: <Eye size={16} />, onClick: () => setView(String(row.id)) }], 1)] : []),
  ];

  return (
    <SalesGate title="Hóa đơn" description="Hóa đơn VAT nội bộ của cửa hàng, mới nhất trước." permission={PERMISSIONS.INVOICE_SEARCH}>
      <div className="flex flex-col gap-4">
        <Alert type="warning" showIcon title="Hóa đơn nội bộ, không thay thế hóa đơn điện tử." description="Chưa có giá trị pháp lý của hóa đơn điện tử cho tới khi tích hợp nhà cung cấp hóa đơn điện tử." />
        <FilterBar filters={f} total={q.data?.total} unit="hóa đơn" />
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              mobileTitleKey="no"
              pagination={{ mode: "server", page: f.page, pageSize: f.size, total: p.total, onSizeChange: f.setSize }}
              empty={{ title: "Chưa có hóa đơn nào.", hint: f.hasFilter ? "Thử đổi hoặc bỏ bộ lọc." : "Hóa đơn xuất từ chi tiết đơn hàng sẽ hiện ở đây." }}
            />
          )}
        </QueryBoundary>
      </div>
      <InvoiceViewModal invoiceId={view} onClose={() => setView(null)} />
    </SalesGate>
  );
}
