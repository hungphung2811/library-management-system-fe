import { useState } from "react";
import { useParams } from "react-router";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useSession, type ErrorInfo } from "@/api";
import { Alert, Button, Card, DataTable, LinkButton, QueryBoundary, Tag, describeError, formatDate, formatDateTime, formatMoney, useDetailModal, type DataColumn } from "@/ui";
import { OrderNotesCard } from "./_components/OrderNotesCard";
import { OrderActions } from "./_components/OrderActions";
import { ReceiptPanel } from "./_components/ReceiptPanel";
import { ReturnsPanel } from "./_components/ReturnsPanel";
import { SalesGate } from "./_components/SalesGate";
import {
  ALL_PAYMENT_METHODS,
  CHANNELS,
  FULFILMENTS,
  ORDER_STATUS,
  ORDER_STATUS_COLOR,
  PAYMENT_STATUS,
  bpsToPercent,
  label,
  type OrderContact,
  type SalesOrder,
} from "./_lib/sales";

const columns: DataColumn[] = [
  { key: "n", title: "#", dataIndex: "lineNo", width: 50 },
  { key: "t", title: "Mặt hàng", dataIndex: "titleName" },
  { key: "i", title: "ISBN", dataIndex: "isbn", kind: "mono" },
  { key: "q", title: "SL", dataIndex: "quantity", align: "right" },
  { key: "p", title: "Đơn giá", dataIndex: "unitPrice", kind: "money", align: "right" },
  { key: "d", title: "Giảm giá", dataIndex: "lineDiscount", kind: "money", align: "right" },
  { key: "a", title: "Thành tiền", dataIndex: "lineTotal", kind: "money", align: "right" },
];

/** Liên hệ khách: mặc định đã che; chỉ khi có khóa SalesOrderController/getContact mới có nút xem đầy đủ. */
function ContactBlock({ order, canFull }: { order: SalesOrder; canFull: boolean }) {
  const [full, setFull] = useState<OrderContact | null>(null);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const c = full ?? order.contact;
  const show = async () => {
    setBusy(true);
    setErr(null);
    try {
      setFull(await apiFetch<OrderContact>(`/api/sales/orders/${encodeURIComponent(order.id)}/contact`));
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={order.channel === "ONLINE" ? "Người nhận" : "Khách hàng"} data-testid="order-contact">
      {c?.piiAnonymizedAt ? (
        <p className="m-0 text-muted">Thông tin khách đã được ẩn danh ({formatDateTime(c.piiAnonymizedAt)}).</p>
      ) : c?.name || c?.phone || c?.address ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Tên</dt>
          <dd className="m-0">{c?.name || "—"}</dd>
          <dt className="text-muted">Điện thoại</dt>
          <dd className="m-0">{c?.phone || "—"}</dd>
          {c?.address && (
            <>
              <dt className="text-muted">Địa chỉ</dt>
              <dd className="m-0">{c.address}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="m-0 text-muted">Khách không để lại thông tin.</p>
      )}
      {!full && !c?.piiAnonymizedAt && (
        <p className="mt-2 mb-0 text-xs text-muted">Thông tin đang được che một phần.</p>
      )}
      {canFull && !full && !c?.piiAnonymizedAt && (
        <Button className="mt-2" size="small" loading={busy} onClick={() => void show()}>
          Xem thông tin đầy đủ
        </Button>
      )}
      {err && <Alert className="mt-2" type="error" showIcon title={describeError(err).text} />}
    </Card>
  );
}

export default function OrderDetailPage() {
  const s = useSession();
  const inModal = !!useDetailModal();
  const { id = "" } = useParams();
  const allowed = can(s, PERMISSIONS.SALES_ORDER_VIEW);
  const q = useApi<SalesOrder>(allowed ? `/api/sales/orders/${encodeURIComponent(id)}` : null);
  return (
    <SalesGate
      title="Chi tiết đơn hàng"
      permission={PERMISSIONS.SALES_ORDER_VIEW}
      actions={inModal ? undefined : <LinkButton to="/sales/orders">Về danh sách</LinkButton>}
    >
      <QueryBoundary query={q}>
        {(o) => (
          <div className={inModal ? "flex flex-col gap-4" : "flex max-w-[1000px] flex-col gap-4"}>
            <div className="print:hidden flex flex-col gap-4">
              <Card
                title={
                  <span>
                    Đơn <span className="font-mono">{o.orderNo}</span>
                  </span>
                }
                extra={<span data-testid="order-status"><Tag color={ORDER_STATUS_COLOR[o.status]}>{label(ORDER_STATUS, o.status)}</Tag></span>}
              >
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted">Kênh</dt>
                  <dd className="m-0">{label(CHANNELS, o.channel)}</dd>
                  <dt className="text-muted">Nhận hàng</dt>
                  <dd className="m-0">{label(FULFILMENTS, o.fulfilment)}</dd>
                  <dt className="text-muted">Thanh toán</dt>
                  <dd className="m-0" data-testid="order-payment">
                    <Tag color={o.paymentStatus === "UNPAID" ? "orange" : o.paymentStatus === "PAID" ? "success" : undefined}>{label(PAYMENT_STATUS, o.paymentStatus)}</Tag>{" "}
                    {label(ALL_PAYMENT_METHODS, o.paymentMethod)}
                  </dd>
                  <dt className="text-muted">Đặt lúc</dt>
                  <dd className="m-0">{formatDateTime(o.createdAt)}</dd>
                  {o.confirmedAt && (
                    <>
                      <dt className="text-muted">Xác nhận lúc</dt>
                      <dd className="m-0">{formatDateTime(o.confirmedAt)}</dd>
                    </>
                  )}
                  {o.paidAt && (
                    <>
                      <dt className="text-muted">Đã thu lúc</dt>
                      <dd className="m-0">{formatDateTime(o.paidAt)}</dd>
                    </>
                  )}
                  {o.completedAt && (
                    <>
                      <dt className="text-muted">Hoàn tất lúc</dt>
                      <dd className="m-0">{formatDateTime(o.completedAt)}</dd>
                    </>
                  )}
                  {o.cancelledAt && (
                    <>
                      <dt className="text-muted">Hủy lúc</dt>
                      <dd className="m-0">{formatDateTime(o.cancelledAt)}</dd>
                      <dt className="text-muted">Lý do hủy</dt>
                      <dd className="m-0" data-testid="order-cancel-reason">{o.cancelReason || "—"}</dd>
                    </>
                  )}
                  {o.expectedDeliveryDate && (
                    <>
                      <dt className="text-muted">Ngày giao dự kiến</dt>
                      <dd className="m-0" data-testid="order-expected-date">{formatDate(o.expectedDeliveryDate)}</dd>
                    </>
                  )}
                  {o.customerNote && (
                    <>
                      <dt className="text-muted">Ghi chú của khách</dt>
                      <dd className="m-0 whitespace-pre-wrap" data-testid="order-customer-note">{o.customerNote}</dd>
                    </>
                  )}
                  {o.exchangeOfReturnId && (
                    <>
                      <dt className="text-muted">Đổi hàng</dt>
                      <dd className="m-0">Đơn đổi cho phiếu trả {o.exchangeOfReturnId.slice(0, 8)}. Chênh lệch tiền xử lý ngoài hệ thống.</dd>
                    </>
                  )}
                </dl>
              </Card>
              <OrderActions order={o} onReload={() => void q.refetch()} />
              <ContactBlock order={o} canFull={can(s, PERMISSIONS.SALES_ORDER_CONTACT)} />
              {can(s, PERMISSIONS.SALES_ORDER_NOTES_VIEW) && <OrderNotesCard key={`${o.id}:${o.version}`} order={o} />}
              <Card title="Các dòng hàng">
                <DataTable columns={columns} rows={o.lines as unknown as Record<string, unknown>[]} rowKey="id" embedded empty={{ title: "Đơn không có dòng nào." }} />
                <dl className="mt-3 mb-0 ml-auto grid max-w-[360px] grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                  <dt>Tạm tính</dt>
                  <dd className="m-0 text-right">{formatMoney(o.subtotal)}</dd>
                  <dt>Giảm giá</dt>
                  <dd className="m-0 text-right">-{formatMoney(o.discountTotal)}</dd>
                  <dt>
                    VAT {bpsToPercent(o.vatRateBps)}%{o.pricesIncludeVat ? " (đã gồm)" : ""}
                  </dt>
                  <dd className="m-0 text-right">{formatMoney(o.vatTotal)}</dd>
                  {o.shippingFee > 0 && (
                    <>
                      <dt>Phí vận chuyển</dt>
                      <dd className="m-0 text-right">{formatMoney(o.shippingFee)}</dd>
                    </>
                  )}
                  <dt className="font-semibold">Tổng cộng</dt>
                  <dd className="m-0 text-right font-semibold">{formatMoney(o.grandTotal)}</dd>
                </dl>
              </Card>
            </div>
            <div className="print:hidden">
              <ReturnsPanel order={o} />
            </div>
            {o.status === "COMPLETED" && can(s, PERMISSIONS.SALES_ORDER_RECEIPT) && (
              <Card title="Phiếu bán hàng" className="print:border-0 print:shadow-none">
                <ReceiptPanel orderId={o.id} />
              </Card>
            )}
          </div>
        )}
      </QueryBoundary>
    </SalesGate>
  );
}
