import { usePageSize, Eye, actionsColumn } from "@/ui";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { DataTable, DatePicker, QueryBoundary, SearchBar, Select, Tag, dayjs, type DataColumn } from "@/ui";
import { SalesGate } from "./_components/SalesGate";
import { ALL_PAYMENT_METHODS, CHANNELS, FULFILMENTS, ORDER_STATUS, ORDER_STATUS_COLOR, PAYMENT_STATUS, label, pageParams, type Page, type SalesOrder } from "./_lib/sales";

/** Bộ lọc "chuyển khoản chưa thu quá X giờ": chọn số giờ. */
const OVERDUE_HOURS = [24, 48, 72];


export default function OrdersPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const SIZE = usePageSize();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const status = sp.get("status") ?? "";
  const channel = sp.get("channel") ?? "";
  const overdue = OVERDUE_HOURS.includes(Number(sp.get("overdue"))) ? Number(sp.get("overdue")) : 0;
  // Lọc "chưa thu quá X giờ" luôn là UNPAID; không có job tự hủy, nhân viên mở từng đơn rồi hủy tay.
  const payment = overdue ? "UNPAID" : (sp.get("payment") ?? "");
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const kw = (sp.get("q") ?? "").trim();
  const allowed = can(s, PERMISSIONS.SALES_ORDER_SEARCH);
  // `from` bao gồm, `to` loại trừ (ISO-8601): ngày kết thúc người dùng chọn là bao gồm nên cộng một ngày.
  const overdueTo = useMemo(() => (overdue ? dayjs().subtract(overdue, "hour").startOf("minute").toISOString() : undefined), [overdue]);
  const iso = (d: string, plus = 0) => (d ? dayjs(d).add(plus, "day").startOf("day").toISOString() : undefined);
  const q = useApi<Page<SalesOrder>>(
    allowed
      ? `/api/sales/orders?${pageParams(sp, SIZE, { status, channel, paymentStatus: payment, from: iso(from), to: overdueTo ?? iso(to, 1), keyword: kw })}`
      : null,
  );

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete("page");
    setSp(n, { replace: true });
  };

  const columns: DataColumn[] = [
    { key: "no", title: "Số đơn", dataIndex: "orderNo", kind: "link", href: "/sales/orders/{id}" },
    { key: "at", title: "Thời điểm", dataIndex: "createdAt", kind: "datetime" },
    { key: "ch", title: "Kênh", dataIndex: "channel", render: (v) => label(CHANNELS, v as string) },
    { key: "st", title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={ORDER_STATUS_COLOR[v as string]}>{label(ORDER_STATUS, v as string)}</Tag> },
    {
      key: "pay",
      title: "Thanh toán",
      dataIndex: "paymentStatus",
      render: (v, r) => (
        <span>
          <Tag color={v === "UNPAID" ? "orange" : v === "PAID" ? "success" : undefined}>{label(PAYMENT_STATUS, v as string)}</Tag>
          {r.paymentMethod ? <span className="text-xs text-muted">{label(ALL_PAYMENT_METHODS, r.paymentMethod as string)}</span> : null}
        </span>
      ),
    },
    { key: "ful", title: "Nhận hàng", dataIndex: "fulfilment", render: (v) => label(FULFILMENTS, v as string) },
    {
      key: "cust",
      title: "Khách",
      dataIndex: ["contact", "name"],
      render: (v, r) => {
        const c = r.contact as { name?: string | null; phone?: string | null } | null;
        return c?.name || c?.phone ? `${c?.name ?? ""} ${c?.phone ?? ""}`.trim() : "—";
      },
    },
    { key: "total", title: "Tổng tiền", dataIndex: "grandTotal", kind: "money", align: "right" },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/sales/orders/${encodeURIComponent(String(row.id))}` }], 1),
];

  return (
    <SalesGate title="Đơn hàng" description="Đơn tại quầy và đơn trực tuyến, mới nhất trước." permission={PERMISSIONS.SALES_ORDER_SEARCH}>
      <div className="flex flex-col gap-4">
        <SearchBar
          placeholder="Tìm theo số đơn"
          extra={
            <>
              <Select
                aria-label="Trạng thái đơn"
                className="w-40"
                value={status}
                onChange={(v) => set("status", v)}
                options={[{ value: "", label: "Mọi trạng thái" }, ...Object.entries(ORDER_STATUS).map(([value, l]) => ({ value, label: l }))]}
              />
              <Select
                aria-label="Kênh bán"
                className="w-36"
                value={channel}
                onChange={(v) => set("channel", v)}
                options={[{ value: "", label: "Mọi kênh" }, ...Object.entries(CHANNELS).map(([value, l]) => ({ value, label: l }))]}
              />
              <Select
                aria-label="Thanh toán"
                className="w-44"
                value={payment}
                disabled={overdue > 0}
                onChange={(v) => set("payment", v)}
                options={[{ value: "", label: "Mọi thanh toán" }, ...Object.entries(PAYMENT_STATUS).map(([value, l]) => ({ value, label: l }))]}
              />
              <Select
                aria-label="Chưa thu quá"
                className="w-52"
                value={overdue ? String(overdue) : ""}
                onChange={(v) => set("overdue", v)}
                options={[{ value: "", label: "Chưa thu: mọi thời gian" }, ...OVERDUE_HOURS.map((h) => ({ value: String(h), label: `Chưa thu quá ${h} giờ` }))]}
              />
              <DatePicker.RangePicker
                disabled={overdue > 0}
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
            </>
          }
        />
        {overdue > 0 && (
          <p className="m-0 text-sm text-muted" data-testid="overdue-hint">
            Đơn chưa thu tiền và tạo cách đây hơn {overdue} giờ. Hệ thống không tự hủy đơn: mở từng đơn và hủy tay (bắt buộc nhập lý do) nếu khách không thanh toán.
          </p>
        )}
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              mobileTitleKey="no"
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: "Không có đơn hàng nào.", hint: "Thử đổi bộ lọc." }}
            />
          )}
        </QueryBoundary>
      </div>
    </SalesGate>
  );
}
