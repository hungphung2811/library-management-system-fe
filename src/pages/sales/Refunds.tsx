import { usePageSize } from "@/ui";
import { Link, useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, useApi, useSession } from "@/api";
import { DataTable, Form, FormModal, Input, QueryBoundary, Select, Tag, Banknote, actionsColumn, formatDateTime, formatMoney, type DataColumn, useFormModal } from "@/ui";
import { SalesGate } from "./_components/SalesGate";
import { ALL_PAYMENT_METHODS, REFUND_SOURCE, REFUND_STATUS, label, pageParams, type Page, type Refund } from "./_lib/sales";


export default function RefundsPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const SIZE = usePageSize();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const status = sp.get("status") ?? "";
  const allowed = can(s, PERMISSIONS.REFUND_SEARCH);
  const canMark = can(s, PERMISSIONS.REFUND_MARK_REFUNDED);
  const canOrder = can(s, PERMISSIONS.SALES_ORDER_VIEW);
  const q = useApi<Page<Refund>>(allowed ? `/api/sales/refunds?${pageParams(sp, SIZE, { status })}` : null);
  const form = useFormModal<{ method: string; reference?: string }, unknown, Refund>({
    title: "Đánh dấu đã hoàn tiền",
    okText: "Đánh dấu đã hoàn",
    successMessage: "Đã ghi nhận hoàn tiền.",
    initialValues: (t) => ({ method: t?.source === "CANCELLATION" ? "BANK_TRANSFER" : "CASH" }),
    invalidate: ["/api/sales/refunds", "/api/sales/orders"],
    request: async (v, t) => {
      if (!t) return;
      await apiFetch(`/api/sales/refunds/${encodeURIComponent(t.id)}/completion`, {
        method: "POST",
        json: { method: v.method, ...(v.reference?.trim() ? { reference: v.reference.trim() } : {}), version: t.version },
      });
    },
  });
  const target = form.target;

  const columns: DataColumn[] = [
    { key: "at", title: "Tạo lúc", dataIndex: "createdAt", kind: "datetime" },
    { key: "src", title: "Nguồn", dataIndex: "source", render: (v) => label(REFUND_SOURCE, v as string) },
    {
      key: "ord",
      title: "Đơn",
      dataIndex: "orderId",
      render: (v) =>
        canOrder ? (
          <Link className="font-mono text-primary hover:underline" to={`/sales/orders/${encodeURIComponent(String(v))}`}>
            {String(v).slice(0, 8)}
          </Link>
        ) : (
          <span className="font-mono">{String(v).slice(0, 8)}</span>
        ),
    },
    { key: "amt", title: "Số tiền", dataIndex: "amount", kind: "money", align: "right" },
    {
      key: "st",
      title: "Trạng thái",
      dataIndex: "status",
      render: (v) => <Tag color={v === "PENDING" ? "orange" : "success"}>{label(REFUND_STATUS, v as string)}</Tag>,
    },
    {
      key: "m",
      title: "Đã hoàn",
      dataIndex: "refundedAt",
      render: (v, r) => (v ? `${formatDateTime(v as string)} · ${label(ALL_PAYMENT_METHODS, r.method as string)}${r.reference ? ` · ${String(r.reference)}` : ""}` : "—"),
    },
    actionsColumn(
      (r) => [
        {
          key: "mark",
          label: "Đánh dấu đã hoàn",
          icon: <Banknote size={16} />,
          hidden: !(canMark && r.status === "PENDING"),
          onClick: () => form.openModal(r as unknown as Refund),
        },
      ],
      1,
    ),
  ];

  return (
    <SalesGate
      title="Hoàn tiền"
      description="Khoản hoàn sinh ra khi hủy đơn đã thu hoặc khi trả hàng. Hoàn tiền cho khách ngoài hệ thống rồi đánh dấu đã hoàn."
      permission={PERMISSIONS.REFUND_SEARCH}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="refund-status" className="text-sm font-medium text-ink">
            Trạng thái
          </label>
          <Select
            id="refund-status"
            className="w-48"
            value={status}
            onChange={(v) => {
              const n = new URLSearchParams(sp);
              if (v) n.set("status", v);
              else n.delete("status");
              n.delete("page");
              setSp(n, { replace: true });
            }}
            options={[{ value: "", label: "Tất cả" }, ...Object.entries(REFUND_STATUS).map(([value, l]) => ({ value, label: l }))]}
          />
        </div>
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: "Không có khoản hoàn nào.", hint: "Thử đổi bộ lọc." }}
            />
          )}
        </QueryBoundary>
      </div>
      <FormModal<{ method: string; reference?: string }> {...form.modalProps}>
        {target && (
          <dl className="m-0 mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="refund-confirm">
            <dt className="text-muted">Nguồn</dt>
            <dd className="m-0">{label(REFUND_SOURCE, target.source)}</dd>
            <dt className="text-muted">Số tiền</dt>
            <dd className="m-0 font-semibold">{formatMoney(target.amount)}</dd>
          </dl>
        )}
        <p className="mt-0 text-muted">Chỉ bấm sau khi đã trả tiền cho khách. Khoản hoàn đã đánh dấu không đổi lại được.</p>
        <Form.Item name="method" label="Phương thức hoàn" rules={[{ required: true, message: "Chọn phương thức" }]}>
          <Select options={Object.entries(ALL_PAYMENT_METHODS).map(([value, l]) => ({ value, label: l }))} />
        </Form.Item>
        <Form.Item name="reference" label="Mã tham chiếu (tùy chọn)">
          <Input maxLength={100} autoComplete="off" />
        </Form.Item>
      </FormModal>
    </SalesGate>
  );
}
