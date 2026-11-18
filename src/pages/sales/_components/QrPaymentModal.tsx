import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import { Alert, Button, Modal, Popconfirm, Tag, describeError, formatMoney } from "@/ui";
import type { PaymentIntent, SalesOrder } from "../_lib/sales";

const POLL_MS = 2500;

/** Giây còn lại tới hạn (>= 0). */
function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type Props = {
  /** Đơn QR vừa tạo (status AWAITING_PAYMENT, có paymentIntent). */
  order: SalesOrder;
  /** Khung hiển thị; đóng khung không hủy lệnh, thăm dò vẫn chạy ở nền. */
  open: boolean;
  onClose: () => void;
  /** Cổng báo đã nhận tiền. */
  onPaid: (order: SalesOrder) => void;
  /** Lệnh hết hạn hoặc đã hủy: người dùng bỏ đơn này (giỏ giữ nguyên); `retry` thì tạo lại ngay. */
  onAbandon: (retry: boolean) => void;
};

/**
 * Thanh toán QR ở POS (cổng giả lập nội bộ): vẽ mã từ qrPayload, đếm ngược tới expiresAt, thăm dò trạng thái 2,5 giây/lần.
 * Luôn được mount khi còn đơn chờ để thăm dò không dừng khi thu ngân đóng khung.
 */
export function QrPaymentModal({ order, open, onClose, onPaid, onAbandon }: Props) {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const first = order.paymentIntent as PaymentIntent;
  const canCancel = can(s, PERMISSIONS.PAYMENT_INTENT_CANCEL);
  const isMomo = first.provider === "MOMO";
  // Nút giả lập chỉ có với cổng giả lập nội bộ; MoMo sandbox thì thanh toán thật bằng app MoMo test
  const canSimulate = can(s, PERMISSIONS.PAYMENT_INTENT_SIMULATE_PAID) && !isMomo;

  const q = useApi<PaymentIntent>(`/api/sales/payments/intents/${encodeURIComponent(first.id)}`, {
    initialData: first,
    // initialData coi như đã mới: staleTime 0 để lần thăm dò đầu chạy ngay khi mount lại (khôi phục sau F5).
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

  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [busy, setBusy] = useState<"cancel" | "simulate" | null>(null);
  const [sandboxOff, setSandboxOff] = useState(false);

  // PAID: báo lên trang một lần; kết thúc (EXPIRED/CANCELLED) thì làm mới tồn và đơn vì hàng giữ đã được nhả.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (status === "PENDING" || handled.current === status) return;
    handled.current = status;
    void invalidate("/api/sales/stock-items", "/api/sales/orders");
    if (status === "PAID") onPaid({ ...order, status: "COMPLETED", paymentStatus: "PAID", paidAt: intent.paidAt, paymentIntent: intent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const refresh = () => void q.refetch();

  const cancel = async () => {
    setBusy("cancel");
    setErr(null);
    try {
      await apiFetch(`/api/sales/payments/intents/${encodeURIComponent(intent.id)}/cancel`, { method: "POST" });
    } catch (e) {
      // 409: lệnh đã PAID/EXPIRED trong lúc bấm; trạng thái thật lấy ở lần đọc lại bên dưới.
      setErr(toErrorInfo(e));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const simulate = async () => {
    setBusy("simulate");
    setErr(null);
    try {
      await apiFetch(`/api/sales/payments/intents/${encodeURIComponent(intent.id)}/simulate-paid`, { method: "POST" });
    } catch (e) {
      const info = toErrorInfo(e);
      if (info.code === "PAYMENT_SANDBOX_DISABLED") setSandboxOff(true);
      setErr(info);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const terminal = status === "EXPIRED" || status === "CANCELLED";
  const d = err ? describeError(err) : null;

  return (
    <Modal
      open={open && status !== "PAID"}
      title={`${isMomo ? "Thanh toán MoMo" : "Thanh toán QR"} · đơn ${order.orderNo}`}
      onCancel={onClose}
      footer={null}
      destroyOnHidden={false}
      maskClosable={false}
      width={440}
    >
      <div className="flex flex-col items-center gap-3" data-testid="qr-panel">
        <Tag color="orange">{isMomo ? "MoMo sandbox, không phải tiền thật" : "Cổng giả lập (sandbox), không phải tiền thật"}</Tag>
        {isMomo && status === "PENDING" && (
          <p className="m-0 text-center text-sm text-muted" data-testid="momo-hint">
            Mở app MoMo bản test, chọn quét mã rồi xác nhận thanh toán. Màn hình này tự cập nhật khi MoMo báo thành công.
          </p>
        )}

        {terminal ? (
          <Alert
            className="w-full"
            type={status === "EXPIRED" ? "warning" : "info"}
            showIcon
            data-testid="qr-terminal"
            title={status === "EXPIRED" ? "Mã QR đã hết hạn." : "Đã hủy thanh toán."}
            description="Đơn đã được hủy và hàng giữ đã trả về tồn. Giỏ hàng vẫn còn nguyên, có thể tạo mã QR mới."
          />
        ) : (
          <div className="rounded-card border border-line bg-white p-3" data-testid="qr-code">
            <QRCodeSVG value={intent.qrPayload ?? intent.reference} size={220} marginSize={1} title={`Mã QR thanh toán ${intent.reference}`} />
          </div>
        )}

        <dl className="m-0 grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Số tiền</dt>
          <dd className="m-0 text-right text-base font-semibold" data-testid="qr-amount">
            {formatMoney(intent.amount)}
          </dd>
          <dt className="text-muted">Mã tham chiếu</dt>
          <dd className="m-0 text-right font-mono" data-testid="qr-reference">
            {intent.reference}
          </dd>
          <dt className="text-muted">Trạng thái</dt>
          <dd className="m-0 text-right" data-testid="qr-status">
            {status === "PENDING" ? "Đang chờ thanh toán" : status === "EXPIRED" ? "Hết hạn" : status === "CANCELLED" ? "Đã hủy" : status === "PAID" ? "Đã thanh toán" : status}
          </dd>
          {status === "PENDING" && (
            <>
              <dt className="text-muted">Còn lại</dt>
              <dd className="m-0 text-right font-mono" data-testid="qr-countdown" aria-live="off">
                {left > 0 ? clock(left) : "00:00 · đang kiểm tra"}
              </dd>
            </>
          )}
        </dl>

        {q.isError && !terminal && <Alert className="w-full" type="warning" showIcon title="Chưa đọc được trạng thái thanh toán, đang thử lại." description={describeError(toErrorInfo(q.error)).text} />}
        {d && <Alert className="w-full" type="error" showIcon title={d.text} description={d.details?.length ? d.details.join("; ") : d.detail} />}

        <div className="flex w-full flex-wrap justify-end gap-2">
          {terminal ? (
            <>
              <Button onClick={() => onAbandon(false)}>Đóng</Button>
              <Button type="primary" onClick={() => onAbandon(true)}>
                Tạo mã QR mới
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose}>Đóng (giữ chờ)</Button>
              {canCancel && (
                <Popconfirm title="Hủy thanh toán QR?" description="Đơn bị hủy và hàng giữ được trả về tồn." okText="Hủy thanh toán" cancelText="Không" onConfirm={() => cancel()}>
                  <Button danger loading={busy === "cancel"} disabled={busy !== null}>
                    Hủy thanh toán
                  </Button>
                </Popconfirm>
              )}
              {canSimulate && !sandboxOff && (
                <Button type="primary" loading={busy === "simulate"} disabled={busy !== null} onClick={() => void simulate()}>
                  Giả lập đã thanh toán (sandbox)
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
