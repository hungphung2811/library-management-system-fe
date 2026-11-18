import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import { Alert, App, Button, ConfirmAction, Form, FormModal, Input, InputNumber, Select, describeError, formatMoney, useFormModal } from "@/ui";
import { MoneyInput } from "./MoneyInput";
import { ALL_PAYMENT_METHODS, FULFILMENTS, PAYMENT_METHODS, label, type Discount, type SalesOrder } from "../_lib/sales";

const ACTIVE = ["PENDING_CONFIRMATION", "CONFIRMED", "READY_FOR_PICKUP", "SHIPPING"];

type DiscountValues = Record<string, unknown>;

/** Giảm giá nhập ở form: loại (₫ hoặc %) và giá trị; % nhập theo phần trăm, gửi BE theo điểm cơ bản (10% = 1000). */
function DiscountField({ name, labelText, ariaLabel }: { name: string; labelText: string; ariaLabel: string }) {
  return (
    <Form.Item label={labelText} className="mb-2">
      <div className="flex gap-2" role="group" aria-label={ariaLabel}>
        <Form.Item name={`${name}Type`} noStyle initialValue="AMOUNT">
          <Select
            aria-label={`${ariaLabel}: loại`}
            className="w-24"
            options={[
              { value: "AMOUNT", label: "₫" },
              { value: "PERCENT", label: "%" },
            ]}
          />
        </Form.Item>
        <Form.Item name={`${name}Value`} noStyle>
          <InputNumber aria-label={`${ariaLabel}: giá trị`} className="w-40" min={0} precision={2} decimalSeparator="," />
        </Form.Item>
      </div>
    </Form.Item>
  );
}

function toDiscount(v: DiscountValues, name: string): Discount | undefined {
  const n = Number(v[`${name}Value`] ?? 0);
  if (!(n > 0)) return undefined;
  return v[`${name}Type`] === "PERCENT" ? { type: "PERCENT", value: Math.round(n * 100) } : { type: "AMOUNT", value: Math.round(n) };
}

/**
 * Thao tác của nhân viên trên đơn (đơn online): mỗi nút chỉ hiện khi có khóa và đơn đang ở trạng thái cho phép
 * (BE là nơi quyết định cuối). Mọi thao tác gửi `version` đã đọc; lệch thì 409 ORDER_STATE_CONFLICT và có nút tải lại.
 */
export function OrderActions({ order, onReload }: { order: SalesOrder; onReload: () => void }) {
  const s = useSession();
  const { message } = App.useApp();
  const invalidate = useInvalidateApi();
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const st = order.status;
  const unpaid = order.paymentStatus === "UNPAID";
  const online = order.channel === "ONLINE";
  const show = {
    confirm: st === "PENDING_CONFIRMATION" && can(s, PERMISSIONS.SALES_ORDER_CONFIRM),
    discount: online && unpaid && (st === "PENDING_CONFIRMATION" || st === "CONFIRMED") && can(s, PERMISSIONS.SALES_ORDER_APPLY_DISCOUNT),
    paid: unpaid && ["CONFIRMED", "READY_FOR_PICKUP", "SHIPPING"].includes(st) && can(s, PERMISSIONS.SALES_ORDER_MARK_PAID),
    ready: st === "CONFIRMED" && order.fulfilment === "PICKUP" && can(s, PERMISSIONS.SALES_ORDER_READY_FOR_PICKUP),
    ship: st === "CONFIRMED" && order.fulfilment === "DELIVERY" && can(s, PERMISSIONS.SALES_ORDER_SHIPPING),
    complete: (st === "READY_FOR_PICKUP" || st === "SHIPPING") && can(s, PERMISSIONS.SALES_ORDER_COMPLETE),
    cancel: ACTIVE.includes(st) && can(s, PERMISSIONS.SALES_ORDER_CANCEL),
  };
  const post = async (suffix: string, json: Record<string, unknown>) => {
    const r = await apiFetch<SalesOrder>(`/api/sales/orders/${encodeURIComponent(order.id)}/${suffix}`, {
      method: "POST",
      json: { ...json, version: order.version },
    });
    await invalidate("/api/sales/orders", "/api/sales/refunds", "/api/sales/stock-items");
    return r;
  };

  const confirmForm = useFormModal<{ shippingFee?: number | null }>({
    title: `Xác nhận đơn ${order.orderNo}`,
    okText: "Xác nhận đơn",
    successMessage: "Đã xác nhận đơn.",
    request: async (v) => {
      await post("confirmation", order.fulfilment === "DELIVERY" && v.shippingFee != null ? { shippingFee: v.shippingFee } : {});
    },
  });
  const paidForm = useFormModal<{ method: string; reference?: string }>({
    title: `Đánh dấu đã thu: ${order.orderNo}`,
    okText: "Đánh dấu đã thu",
    successMessage: "Đã ghi nhận thu tiền.",
    initialValues: { method: order.paymentMethod ?? "BANK_TRANSFER" },
    request: async (v) => {
      await post("payment", { method: v.method, ...(v.reference?.trim() ? { reference: v.reference.trim() } : {}) });
    },
  });
  const discountForm = useFormModal<DiscountValues>({
    title: `Áp giảm giá: ${order.orderNo}`,
    okText: "Áp giảm giá",
    successMessage: "Đã cập nhật giảm giá.",
    request: async (v) => {
      const orderDiscount = toDiscount(v, "order");
      const lineDiscounts = order.lines.flatMap((l) => {
        const d = toDiscount(v, `line${l.lineNo}`);
        return d ? [{ lineNo: l.lineNo, discount: d }] : [];
      });
      await post("discount", { ...(orderDiscount ? { orderDiscount } : {}), ...(lineDiscounts.length ? { lineDiscounts } : {}) });
    },
  });
  const cancelForm = useFormModal<{ reason: string }>({
    title: `Hủy đơn ${order.orderNo}`,
    okText: "Hủy đơn",
    cancelText: "Không hủy",
    successMessage: "Đã hủy đơn.",
    request: async (v) => {
      await post("cancellation", { reason: v.reason.trim() });
    },
  });
  if (!Object.values(show).some(Boolean)) return null;

  /** Thao tác một chạm (có hộp xác nhận): lỗi hiện ở khung báo lỗi phía trên các nút. */
  const run = async (suffix: string, okMsg: string) => {
    setErr(null);
    setBusy(true);
    try {
      await post(suffix, {});
      message.success(okMsg);
    } catch (e) {
      setErr(toErrorInfo(e));
    } finally {
      setBusy(false);
    }
  };

  const grand = formatMoney(order.grandTotal);
  const conflict = err?.code === "ORDER_STATE_CONFLICT";
  const errText = err ? describeError(err) : null;
  return (
    <div className="flex flex-col gap-3" data-testid="order-actions">
      {errText && (
        <Alert
          type="error"
          showIcon
          title={errText.text}
          description={errText.detail}
          action={
            conflict ? (
              <Button
                size="small"
                onClick={() => {
                  setErr(null);
                  onReload();
                }}
              >
                Tải lại đơn
              </Button>
            ) : undefined
          }
        />
      )}
      <div className="flex flex-wrap gap-2">
        {show.confirm && (
          <Button type="primary" disabled={busy} onClick={() => confirmForm.openModal()}>
            Xác nhận đơn
          </Button>
        )}
        {show.discount && (
          <Button disabled={busy} onClick={() => discountForm.openModal()}>
            Áp giảm giá
          </Button>
        )}
        {show.paid && (
          <Button type={st === "CONFIRMED" ? "default" : "primary"} disabled={busy} onClick={() => paidForm.openModal()}>
            Đánh dấu đã thu
          </Button>
        )}
        {show.ready && (
          <ConfirmAction
            title="Đánh dấu sẵn sàng nhận?"
            description="Hàng được giữ tại quầy chờ khách đến nhận."
            okText="Sẵn sàng nhận"
            onConfirm={() => run("ready-for-pickup", "Đơn đã sẵn sàng để khách nhận.")}
          >
            <Button disabled={busy}>Sẵn sàng nhận</Button>
          </ConfirmAction>
        )}
        {show.ship && (
          <ConfirmAction
            title="Đánh dấu đang giao?"
            description="Hàng rời cửa hàng: tồn kho được trừ ngay."
            okText="Đang giao"
            onConfirm={() => run("shipping", "Đơn đang được giao.")}
          >
            <Button disabled={busy}>Đang giao</Button>
          </ConfirmAction>
        )}
        {show.complete && (
          <ConfirmAction title="Hoàn tất đơn?" description="Đơn hoàn tất không hủy được." okText="Hoàn tất" onConfirm={() => run("completion", "Đơn đã hoàn tất.")}>
            <Button type="primary" disabled={busy || unpaid} title={unpaid ? "Cần đánh dấu đã thu trước khi hoàn tất" : undefined}>
              Hoàn tất
            </Button>
          </ConfirmAction>
        )}
        {show.cancel && (
          <Button danger disabled={busy} onClick={() => cancelForm.openModal()}>
            Hủy đơn
          </Button>
        )}
      </div>
      {show.complete && unpaid && <p className="m-0 text-xs text-muted">Chỉ hoàn tất được khi đơn đã được đánh dấu thu tiền.</p>}

      <FormModal<{ shippingFee?: number | null }> {...confirmForm.modalProps}>
        <p className="mt-0 text-muted">
          Nhận hàng: {label(FULFILMENTS, order.fulfilment)}. Phí vận chuyển không chịu VAT.
          {order.fulfilment === "DELIVERY" ? " Để trống để dùng phí cố định trong cấu hình." : " Nhận tại cửa hàng thì không có phí vận chuyển."}
        </p>
        {order.fulfilment === "DELIVERY" && (
          <Form.Item name="shippingFee" label="Phí vận chuyển (đồng)">
            <MoneyInput placeholder="Mặc định theo cấu hình" />
          </Form.Item>
        )}
      </FormModal>

      <FormModal<{ method: string; reference?: string }> {...paidForm.modalProps}>
        <p className="mt-0">
          Số tiền thu: <strong>{grand}</strong> (tổng đơn tại thời điểm này). Chỉ đánh dấu được một lần.
        </p>
        <Form.Item name="method" label="Phương thức" rules={[{ required: true, message: "Chọn phương thức" }]}>
          <Select options={Object.entries({ ...PAYMENT_METHODS, COD: ALL_PAYMENT_METHODS.COD }).map(([value, l]) => ({ value, label: l }))} />
        </Form.Item>
        <Form.Item name="reference" label="Mã tham chiếu giao dịch (tùy chọn)">
          <Input maxLength={100} autoComplete="off" />
        </Form.Item>
      </FormModal>

      <FormModal<DiscountValues> {...discountForm.modalProps}>
        <p className="mt-0 text-muted">Mỗi lần áp dụng thay toàn bộ giảm giá hiện có; để trống mọi ô là gỡ giảm giá.</p>
        <DiscountField name="order" labelText="Giảm giá cả đơn" ariaLabel="Giảm giá cả đơn" />
        {order.lines.map((l) => (
          <DiscountField key={l.id} name={`line${l.lineNo}`} labelText={`Dòng ${l.lineNo}: ${l.titleName}`} ariaLabel={`Giảm giá dòng ${l.lineNo}`} />
        ))}
      </FormModal>

      <FormModal<{ reason: string }> {...cancelForm.modalProps}>
        <Alert
          type="warning"
          showIcon
          className="mb-3"
          title={
            order.paymentStatus === "PAID"
              ? `Đơn đã thu tiền: hủy sẽ tạo khoản hoàn ${grand} (gồm phí vận chuyển) ở trạng thái chờ hoàn.`
              : "Đơn chưa thu tiền nên không phát sinh khoản hoàn."
          }
          description={st === "SHIPPING" ? "Giao thất bại: hàng được nhập lại tồn kho." : "Hàng đang giữ cho đơn được trả lại tồn khả dụng."}
        />
        <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, whitespace: true, message: "Nhập lý do hủy" }]}>
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </FormModal>
    </div>
  );
}
