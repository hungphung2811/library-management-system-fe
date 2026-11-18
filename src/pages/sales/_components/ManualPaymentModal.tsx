import { useEffect, useRef, useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import { Alert, Button, Input, Modal, Popconfirm, describeError, formatMoney } from "@/ui";
import { PAYMENT_METHODS, type PaymentIntent, type SalesOrder } from "../_lib/sales";
import { MoneyInput } from "./MoneyInput";

const POLL_MS = 5000;

const secondsLeft = (expiresAt: string, now: number) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type Props = {
  /** Đơn POS vừa tạo (AWAITING_PAYMENT, intent MANUAL). */
  order: SalesOrder;
  open: boolean;
  onClose: () => void;
  onPaid: (order: SalesOrder) => void;
  /** Lệnh hết hạn/đã hủy: bỏ đơn này (giỏ giữ nguyên); `retry` thì tạo lại ngay. */
  onAbandon: (retry: boolean) => void;
};

/**
 * Xác nhận đã thu cho tiền mặt, thẻ, chuyển khoản (bước hai của POS). Tiền mặt: nhập tiền khách đưa, hiện tiền thối.
 * Thẻ/chuyển khoản: bắt buộc mã giao dịch. Luôn được mount khi còn đơn chờ để thăm dò hạn không dừng khi đóng khung.
 */
export function ManualPaymentModal({ order, open, onClose, onPaid, onAbandon }: Props) {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const first = order.paymentIntent as PaymentIntent;
  const canConfirm = can(s, PERMISSIONS.PAYMENT_INTENT_CONFIRM);
  const canCancel = can(s, PERMISSIONS.PAYMENT_INTENT_CANCEL);
  const isCash = order.paymentMethod === "CASH";

  const q = useApi<PaymentIntent>(`/api/sales/payments/intents/${encodeURIComponent(first.id)}`, {
    initialData: first,
    staleTime: 0,
    refetchInterval: (query) => ((query.state.data?.status ?? "PENDING") === "PENDING" ? POLL_MS : false),
  });
  const intent = q.data ?? first;
  const status = intent.status;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "PENDING") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [status]);
  const left = secondsLeft(intent.expiresAt, now);

  const [tendered, setTendered] = useState<number | null>(null);
  const [ref, setRef] = useState("");
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);

  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (status === "PENDING" || handled.current === status) return;
    handled.current = status;
    void invalidate("/api/sales/stock-items", "/api/sales/orders");
    if (status === "PAID") onPaid({ ...order, status: "COMPLETED", paymentStatus: "PAID", paidAt: intent.paidAt, paymentIntent: intent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const change = tendered == null ? 0 : tendered - intent.amount;
  const valid = isCash ? tendered != null && tendered >= intent.amount : ref.trim().length > 0;

  const confirm = async () => {
    if (!valid) return;
    setBusy("confirm");
    setErr(null);
    try {
      await apiFetch(`/api/sales/payments/intents/${encodeURIComponent(intent.id)}/confirm`, {
        method: "POST",
        json: isCash ? { tenderedAmount: tendered } : { transactionRef: ref.trim() },
      });
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(null);
      void q.refetch();
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    setErr(null);
    try {
      await apiFetch(`/api/sales/payments/intents/${encodeURIComponent(intent.id)}/cancel`, { method: "POST" });
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(null);
      void q.refetch();
    }
  };

  const terminal = status === "EXPIRED" || status === "CANCELLED";
  const d = err ? describeError(err) : null;
  const method = PAYMENT_METHODS[order.paymentMethod ?? ""] ?? order.paymentMethod;

  return (
    <Modal
      open={open && status !== "PAID"}
      title={`Xác nhận đã thu · đơn ${order.orderNo}`}
      onCancel={onClose}
      footer={null}
      destroyOnHidden={false}
      maskClosable={false}
      width={440}
    >
      <div className="flex flex-col gap-3" data-testid="manual-panel">
        {terminal && (
          <Alert
            type={status === "EXPIRED" ? "warning" : "info"}
            showIcon
            data-testid="manual-terminal"
            title={status === "EXPIRED" ? "Đơn đã hết hạn thanh toán." : "Đã hủy thanh toán."}
            description="Đơn đã được hủy và hàng giữ đã trả về tồn. Giỏ hàng vẫn còn nguyên, có thể tạo đơn mới."
          />
        )}

        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Hình thức</dt>
          <dd className="m-0 text-right">{method}</dd>
          <dt className="text-muted">Cần thu</dt>
          <dd className="m-0 text-right text-base font-semibold" data-testid="manual-amount">
            {formatMoney(intent.amount)}
          </dd>
          {status === "PENDING" && (
            <>
              <dt className="text-muted">Giữ hàng còn</dt>
              <dd className="m-0 text-right font-mono" data-testid="manual-countdown">
                {left > 0 ? clock(left) : "00:00 · đang kiểm tra"}
              </dd>
            </>
          )}
        </dl>

        {!terminal && canConfirm && (
          <div className="flex flex-col gap-2">
            {isCash ? (
              <>
                <label htmlFor="manual-tendered" className="text-sm text-muted">
                  Tiền khách đưa
                </label>
                <MoneyInput id="manual-tendered" value={tendered} onChange={setTendered} placeholder="0" />
                <div className="flex justify-between" aria-live="polite">
                  <span className="text-muted">{change < 0 ? "Còn thiếu" : "Tiền thối"}</span>
                  <span className="font-semibold" data-testid="manual-change">
                    {formatMoney(Math.abs(change))}
                  </span>
                </div>
              </>
            ) : (
              <>
                <label htmlFor="manual-ref" className="text-sm text-muted">
                  {order.paymentMethod === "CARD" ? "Mã giao dịch thẻ (approval code)" : "Mã giao dịch chuyển khoản"}
                </label>
                <Input id="manual-ref" autoComplete="off" maxLength={100} value={ref} onChange={(e) => setRef(e.target.value)} />
              </>
            )}
          </div>
        )}
        {!terminal && !canConfirm && <Alert type="warning" showIcon title="Tài khoản chưa có quyền xác nhận đã thu." />}

        {q.isError && !terminal && <Alert type="warning" showIcon title="Chưa đọc được trạng thái thanh toán, đang thử lại." description={describeError(toErrorInfo(q.error)).text} />}
        {d && <Alert type="error" showIcon title={d.text} description={d.details?.length ? d.details.join("; ") : d.detail} />}

        <div className="flex flex-wrap justify-end gap-2">
          {terminal ? (
            <>
              <Button onClick={() => onAbandon(false)}>Đóng</Button>
              <Button type="primary" onClick={() => onAbandon(true)}>
                Tạo đơn mới
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose}>Đóng (giữ chờ)</Button>
              {canCancel && (
                <Popconfirm title="Hủy thanh toán?" description="Đơn bị hủy và hàng giữ được trả về tồn." okText="Hủy thanh toán" cancelText="Không" onConfirm={() => cancel()}>
                  <Button danger loading={busy === "cancel"} disabled={busy !== null}>
                    Hủy thanh toán
                  </Button>
                </Popconfirm>
              )}
              {canConfirm && (
                <Button type="primary" loading={busy === "confirm"} disabled={!valid || busy !== null} onClick={() => void confirm()}>
                  Xác nhận đã thu
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
