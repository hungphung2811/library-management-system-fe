import { useEffect, useRef, useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import {
  Alert,
  App,
  Button,
  Card,
  DataTable,
  Drawer,
  ERROR_MESSAGES,
  InputNumber,
  Input,
  ArrowLeftRight,
  Modal,
  QueryBoundary,
  Select,
  Tag,
  actionsColumn,
  describeError,
  formatDateTime,
  formatMoney,
  type DataColumn,
} from "@/ui";
import { DISPOSITIONS, label, newRequestId, parseKv, type SalesOrder, type SalesReturn } from "../_lib/sales";

const asRows = <T,>(items: T[]) => items as unknown as Record<string, unknown>[];

type Row = { qty: number; disposition: "RESTOCK" | "WRITE_OFF" };

function ReturnDrawer({ order, id, onClose }: { order: SalesOrder; id: string | null; onClose: () => void }) {
  const q = useApi<SalesReturn>(id ? `/api/sales/returns/${encodeURIComponent(id)}` : null);
  const lineName = (lineId: string) => order.lines.find((l) => l.id === lineId)?.titleName ?? lineId.slice(0, 8);
  return (
    <Drawer open={id !== null} onClose={onClose} size="large" title="Chi tiết phiếu trả hàng" destroyOnHidden>
      <QueryBoundary query={q}>
        {(r) => (
          <div className="flex flex-col gap-3" data-testid="return-detail">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">Số phiếu</dt>
              <dd className="m-0 font-mono">{r.returnNo}</dd>
              <dt className="text-muted">Lúc tạo</dt>
              <dd className="m-0">{formatDateTime(r.createdAt)}</dd>
              <dt className="text-muted">Người tạo</dt>
              <dd className="m-0 font-mono">{r.createdBy ? r.createdBy.slice(0, 8) : "—"}</dd>
              <dt className="text-muted">Lý do</dt>
              <dd className="m-0">{r.reason}</dd>
              {r.late && (
                <>
                  <dt className="text-muted">Trả quá hạn</dt>
                  <dd className="m-0">
                    Quá {r.daysOverdue} ngày. Lý do quản lý cho phép: {r.lateReason || "—"}
                  </dd>
                </>
              )}
              <dt className="text-muted">Tiền hoàn</dt>
              <dd className="m-0 font-semibold">{formatMoney(r.refundTotal)}</dd>
            </dl>
            <DataTable
              columns={[
                { key: "t", title: "Mặt hàng", dataIndex: "orderLineId", render: (v) => lineName(v as string) },
                { key: "q", title: "SL", dataIndex: "quantity", align: "right" },
                { key: "d", title: "Tình trạng", dataIndex: "disposition", render: (v) => label(DISPOSITIONS, v as string) },
                { key: "a", title: "Tiền hoàn", dataIndex: "refundAmount", kind: "money", align: "right" },
              ]}
              rows={asRows(r.lines)}
              rowKey="id"
              embedded
              empty={{ title: "Phiếu không có dòng nào." }}
            />
            <p className="m-0 text-xs text-muted">Khoản hoàn của phiếu này ở trạng thái chờ hoàn cho tới khi nhân viên có quyền đánh dấu đã hoàn (trang Hoàn tiền).</p>
          </div>
        )}
      </QueryBoundary>
    </Drawer>
  );
}

function ReturnModal({ order, remaining, open, onClose }: { order: SalesOrder; remaining: Record<string, number>; open: boolean; onClose: () => void }) {
  const s = useSession();
  const { message } = App.useApp();
  const invalidate = useInvalidateApi();
  const canNormal = can(s, PERMISSIONS.SALES_RETURN_CREATE);
  const canLate = can(s, PERMISSIONS.SALES_RETURN_CREATE_LATE);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [reason, setReason] = useState("");
  const [lateReason, setLateReason] = useState("");
  const [expired, setExpired] = useState(!canNormal && canLate);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reqId = useRef(newRequestId());
  useEffect(() => {
    if (!open) return;
    reqId.current = newRequestId();
    setRows({});
    setReason("");
    setLateReason("");
    setExpired(!canNormal && canLate);
    setErr(null);
    setLocalErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rowOf = (id: string): Row => rows[id] ?? { qty: 0, disposition: "RESTOCK" };
  const left = (lineId: string, bought: number) => remaining[lineId] ?? bought;

  const submit = async (late: boolean) => {
    if (busy) return;
    setErr(null);
    setLocalErr(null);
    const lines = order.lines.flatMap((l) => {
      const r = rowOf(l.id);
      return r.qty > 0 ? [{ orderLineId: l.id, quantity: r.qty, disposition: r.disposition }] : [];
    });
    if (lines.length === 0) return setLocalErr("Chọn ít nhất một dòng và số lượng trả.");
    if (!reason.trim()) return setLocalErr("Nhập lý do trả hàng.");
    if (late && !lateReason.trim()) return setLocalErr(ERROR_MESSAGES.LATE_REASON_REQUIRED!);
    setBusy(true);
    try {
      const r = await apiFetch<SalesReturn>(late ? "/api/sales/returns/late" : "/api/sales/returns", {
        method: "POST",
        json: { orderId: order.id, lines, reason: reason.trim(), ...(late ? { lateReason: lateReason.trim() } : {}), clientRequestId: reqId.current },
      });
      await invalidate("/api/sales/orders", "/api/sales/refunds", "/api/sales/stock-items");
      message.success(`Đã tạo phiếu trả ${r.returnNo}. Khoản hoàn ${formatMoney(r.refundTotal)} đang chờ hoàn.`);
      onClose();
    } catch (e) {
      const info = toErrorInfo(e);
      if (info.code === "RETURN_WINDOW_EXPIRED") setExpired(true);
      setErr(info);
    } finally {
      setBusy(false);
    }
  };

  const errBody = (() => {
    if (!err) return null;
    const d = describeError(err);
    const kv = parseKv(err.details);
    let extra: string | null = null;
    if (err.code === "RETURN_WINDOW_EXPIRED") {
      const g = kv[0] ?? {};
      extra = `Hạn trả hàng ${g.windowDays ?? "?"} ngày, đã quá ${g.daysOverdue ?? "?"} ngày.`;
    } else if (err.code === "RETURN_QUANTITY_EXCEEDED") {
      extra = kv
        .map((g) => {
          const l = order.lines.find((x) => x.id === g.orderLineId);
          return `${l ? l.titleName : (g.orderLineId ?? "").slice(0, 8)}: chỉ còn trả được ${g.remaining ?? "?"}.`;
        })
        .join(" ");
    }
    return <Alert type="error" showIcon title={d.text} description={extra ?? (d.details?.length ? d.details.join("; ") : d.detail)} />;
  })();

  return (
    <Modal
      open={open}
      title={`Tạo phiếu trả hàng: ${order.orderNo}`}
      onCancel={busy ? undefined : onClose}
      mask={{ closable: false }}
      width={720}
      destroyOnHidden
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          {canNormal && !expired && (
            <Button type="primary" loading={busy} onClick={() => void submit(false)}>
              Tạo phiếu trả
            </Button>
          )}
          {expired && canLate && (
            <Button type="primary" danger loading={busy} onClick={() => void submit(true)}>
              Trả quá hạn (quản lý cho phép)
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-testid="return-form">
        <DataTable
          columns={[
            { key: "t", title: "Mặt hàng", dataIndex: "titleName" },
            { key: "b", title: "Đã mua", dataIndex: "quantity", align: "right" },
            { key: "r", title: "Còn trả được", dataIndex: "id", align: "right", render: (_v, l) => left(l.id as string, l.quantity as number) },
            {
              key: "q",
              title: "SL trả",
              dataIndex: "id",
              render: (_v, l) => (
                <InputNumber
                  aria-label={`Số lượng trả ${l.titleName}`}
                  min={0}
                  max={left(l.id as string, l.quantity as number)}
                  precision={0}
                  disabled={left(l.id as string, l.quantity as number) <= 0}
                  value={rowOf(l.id as string).qty}
                  onChange={(n) => setRows((c) => ({ ...c, [l.id as string]: { ...rowOf(l.id as string), qty: n ?? 0 } }))}
                />
              ),
            },
            {
              key: "d",
              title: "Tình trạng hàng",
              dataIndex: "id",
              render: (_v, l) => (
                <Select
                  aria-label={`Tình trạng ${l.titleName}`}
                  className="w-44"
                  value={rowOf(l.id as string).disposition}
                  onChange={(v) => setRows((c) => ({ ...c, [l.id as string]: { ...rowOf(l.id as string), disposition: v } }))}
                  options={Object.entries(DISPOSITIONS).map(([value, l]) => ({ value, label: l }))}
                />
              ),
            },
          ]}
          rows={asRows(order.lines)}
          rowKey="id"
          embedded
          empty={{ title: "Đơn không có dòng nào." }}
        />
        <div>
          <label htmlFor="return-reason" className="mb-1 block text-sm font-medium text-ink">
            Lý do trả hàng
          </label>
          <Input.TextArea id="return-reason" rows={2} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {expired && canLate && (
          <div>
            <label htmlFor="late-reason" className="mb-1 block text-sm font-medium text-ink">
              Lý do cho phép trả quá hạn (bắt buộc)
            </label>
            <Input.TextArea id="late-reason" rows={2} maxLength={500} showCount value={lateReason} onChange={(e) => setLateReason(e.target.value)} />
          </div>
        )}
        {expired && !canLate && <Alert type="warning" showIcon title="Đơn đã quá hạn trả hàng. Chỉ quản lý được phép cho trả quá hạn." />}
        {localErr && <Alert type="error" showIcon title={localErr} />}
        {errBody}
        <p className="m-0 text-xs text-muted">Phí vận chuyển không được hoàn khi trả hàng. Hàng nhập lại tồn cộng vào kho; hàng hao hụt ghi xuất hủy, tồn không đổi.</p>
      </div>
    </Modal>
  );
}

/** Trả/đổi hàng của một đơn: danh sách phiếu trả, tạo phiếu (trong hạn hoặc quá hạn có khóa riêng), đổi hàng qua POS. */
export function ReturnsPanel({ order }: { order: SalesOrder }) {
  const s = useSession();
  const canList = can(s, PERMISSIONS.SALES_RETURN_LIST_BY_ORDER);
  const canGet = can(s, PERMISSIONS.SALES_RETURN_GET);
  const canCreate = can(s, PERMISSIONS.SALES_RETURN_CREATE) || can(s, PERMISSIONS.SALES_RETURN_CREATE_LATE);
  const canPos = can(s, PERMISSIONS.POS_ORDER_CREATE) || can(s, PERMISSIONS.POS_ORDER_CREATE_DISCOUNTED);
  const q = useApi<SalesReturn[]>(canList ? `/api/sales/orders/${encodeURIComponent(order.id)}/returns` : null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const eligible = order.status === "COMPLETED" && (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED");
  if (!canList && !(canCreate && eligible)) return null;

  const returned: Record<string, number> = {};
  for (const r of q.data ?? []) for (const l of r.lines) returned[l.orderLineId] = (returned[l.orderLineId] ?? 0) + l.quantity;
  const remaining = Object.fromEntries(order.lines.map((l) => [l.id, Math.max(0, l.quantity - (returned[l.id] ?? 0))]));
  const anyLeft = canList ? order.lines.some((l) => (remaining[l.id] ?? 0) > 0) : true;

  const columns: DataColumn[] = [
    {
      key: "no",
      title: "Số phiếu",
      dataIndex: "returnNo",
      render: (v, r) =>
        canGet ? (
          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-mono font-medium text-primary hover:underline" onClick={() => setOpenId(String(r.id))}>
            {String(v)}
          </button>
        ) : (
          <span className="font-mono">{String(v)}</span>
        ),
    },
    { key: "at", title: "Lúc tạo", dataIndex: "createdAt", kind: "datetime" },
    { key: "late", title: "Quá hạn", dataIndex: "late", render: (v, r) => (v ? <Tag color="orange">Quá {String(r.daysOverdue)} ngày</Tag> : "—") },
    { key: "amt", title: "Tiền hoàn", dataIndex: "refundTotal", kind: "money", align: "right" },
    actionsColumn(
      (r) => [
        {
          key: "exchange",
          label: "Đổi hàng",
          icon: <ArrowLeftRight size={16} />,
          hidden: !canPos,
          to: `/sales/pos?exchangeOfReturnId=${encodeURIComponent(String(r.id))}`,
        },
      ],
      1,
    ),
  ];

  return (
    <Card
      title="Trả hàng và đổi hàng"
      data-testid="returns-panel"
      extra={
        canCreate && eligible && anyLeft ? (
          <Button type="primary" size="small" onClick={() => setCreating(true)}>
            Tạo phiếu trả
          </Button>
        ) : undefined
      }
    >
      {!eligible && <p className="mt-0 text-sm text-muted">Chỉ đơn đã hoàn tất và đã thu tiền mới trả hàng được.</p>}
      {canList && (
        <QueryBoundary query={q}>
          {(list) => (
            <DataTable columns={columns} rows={asRows(list)} rowKey="id" embedded empty={{ title: "Đơn này chưa có phiếu trả hàng." }} />
          )}
        </QueryBoundary>
      )}
      <p className="mb-0 mt-2 text-xs text-muted">
        Đổi hàng là phiếu trả cộng một đơn bán tại quầy mới: chênh lệch tiền xử lý ngoài hệ thống (khoản hoàn của phiếu trả và thanh toán của đơn mới là hai bản ghi riêng).
      </p>
      <ReturnModal order={order} remaining={remaining} open={creating} onClose={() => setCreating(false)} />
      <ReturnDrawer order={order} id={openId} onClose={() => setOpenId(null)} />
    </Card>
  );
}
