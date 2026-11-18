import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import {
  Alert,
  Button,
  Card,
  DeleteOutlined,
  Input,
  InputNumber,
  LinkButton,
  ScanInput,
  Segmented,
  describeError,
  formatMoney,
} from "@/ui";
import { MoneyInput } from "./_components/MoneyInput";
import { PosCatalog, TitleSearchList } from "./_components/PosCatalog";
import { ManualPaymentModal } from "./_components/ManualPaymentModal";
import { QrPaymentModal } from "./_components/QrPaymentModal";
import { ReceiptPanel } from "./_components/ReceiptPanel";
import { ShiftBar } from "./_components/ShiftBar";
import { SalesGate } from "./_components/SalesGate";
import {
  POS_PAYMENT_METHODS,
  estimateDiscount,
  newRequestId,
  normIsbn,
  notFoundError,
  parseKv,
  searchBooks,
  type Discount,
  type Page,
  type SalesOrder,
  type StockItem,
} from "./_lib/sales";

type CartLine = {
  titleId: string;
  name: string;
  isbn?: string | null;
  unitPrice: number;
  available: number;
  quantity: number;
  discount?: Discount;
};

type Cand = { id: string; name: string; isbn?: string | null };

// Đơn QR đang chờ được nhớ trong sessionStorage để F5 hoặc rời trang rồi quay lại vẫn mở lại được mã QR (BE tự hủy khi hết hạn).
const QR_KEY = "lms_pos_qr_order";
const loadQr = (): SalesOrder | null => {
  try {
    const o = JSON.parse(sessionStorage.getItem(QR_KEY) ?? "null") as SalesOrder | null;
    return o?.paymentIntent ? o : null;
  } catch {
    return null;
  }
};
const saveQr = (o: SalesOrder | null) => {
  try {
    if (o) sessionStorage.setItem(QR_KEY, JSON.stringify(o));
    else sessionStorage.removeItem(QR_KEY);
  } catch {
    /* bỏ qua: không có storage thì chỉ mất khả năng khôi phục */
  }
};

/** Giảm giá theo số tiền (đồng) hoặc phần trăm (nhập %, gửi BE dưới dạng điểm cơ bản: 10% = 1000). */
function DiscountInput({ value, onChange, label }: { value?: Discount; onChange: (d: Discount | undefined) => void; label: string }) {
  const [type, setType] = useState<"AMOUNT" | "PERCENT">(value?.type ?? "AMOUNT");
  const set = (t: "AMOUNT" | "PERCENT", n: number | null) => onChange(n && n > 0 ? { type: t, value: n } : undefined);
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Segmented
        size="small"
        value={type}
        onChange={(v) => {
          setType(v as "AMOUNT" | "PERCENT");
          onChange(undefined);
        }}
        options={[
          { label: "₫", value: "AMOUNT" },
          { label: "%", value: "PERCENT" },
        ]}
      />
      {type === "AMOUNT" ? (
        <MoneyInput value={value?.type === "AMOUNT" ? value.value : null} onChange={(n) => set("AMOUNT", n)} placeholder="0" />
      ) : (
        <InputNumber
          className="w-24"
          min={0}
          max={100}
          step={0.5}
          precision={2}
          decimalSeparator=","
          aria-label={`${label} (%)`}
          value={value?.type === "PERCENT" ? value.value / 100 : null}
          onChange={(n) => set("PERCENT", n == null ? null : Math.round(n * 100))}
        />
      )}
    </div>
  );
}

export default function PosPage() {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const canDiscount = can(s, PERMISSIONS.POS_ORDER_CREATE_DISCOUNTED);
  const canSell = canDiscount || can(s, PERMISSIONS.POS_ORDER_CREATE);
  const canBookSearch = can(s, PERMISSIONS.BOOK_SEARCH);
  // Danh sách chọn sách có bộ lọc cần khóa liệt kê mặt hàng; thiếu khóa thì chỉ còn ô quét và ô tìm theo tên.
  const canStockList = can(s, PERMISSIONS.STOCK_SEARCH);
  // Đổi hàng: mở từ phiếu trả (?exchangeOfReturnId=<id>); đơn mới gắn với phiếu trả, chênh lệch tiền xử lý ngoài hệ thống.
  const [sp, setSp] = useSearchParams();
  const exchangeOfReturnId = sp.get("exchangeOfReturnId") ?? "";

  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<Discount | undefined>();
  const [payment, setPayment] = useState<keyof typeof POS_PAYMENT_METHODS>("CASH");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [done, setDone] = useState<SalesOrder | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const busy = useRef(false);
  const [qrOrder, setQrOrder] = useState<SalesOrder | null>(loadQr);
  const [qrOpen, setQrOpen] = useState(true);
  // Tăng mỗi lần cần mở hộp thoại Mở ca (khi BE trả SHIFT_NOT_OPEN).
  const [shiftSignal, setShiftSignal] = useState(0);
  const canQr = can(s, PERMISSIONS.PAYMENT_INTENT_VIEW);
  useEffect(() => saveQr(qrOrder), [qrOrder]);
  // "Tạo mã QR mới" sau khi lệnh hết hạn/hủy: đợi qrOrder được bỏ rồi mới gọi checkout (closure mới nhất).
  const [retryTick, setRetryTick] = useState(0);
  // clientRequestId gắn với nội dung đơn: gửi lại đúng đơn đó (sau lỗi mạng) thì dùng lại id, đổi nội dung thì sinh id mới.
  const req = useRef<{ sig: string; id: string } | null>(null);

  /** Tìm đầu sách: qua catalog nếu có khóa tra sách, không thì lọc theo tên trong danh sách mặt hàng tồn. */
  const findTitles = async (keyword: string): Promise<Cand[]> => {
    if (canBookSearch) return (await searchBooks(keyword)).map((b) => ({ id: b.id, name: b.name, isbn: b.isbn }));
    const kw = keyword.toLowerCase();
    const p = await apiFetch<Page<StockItem>>("/api/sales/stock-items?page=0&size=100");
    return p.items.filter((i) => (i.titleName ?? "").toLowerCase().includes(kw)).map((i) => ({ id: i.titleId, name: i.titleName ?? i.titleId }));
  };

  const addTitle = async (c: Cand) => {
    const it = await apiFetch<StockItem>(`/api/sales/stock-items/${encodeURIComponent(c.id)}`);
    if (it.effectivePrice == null) throw notFoundError(`«${c.name}» chưa có giá bán.`);
    if (it.available <= 0) throw notFoundError(`«${c.name}» đã hết hàng.`);
    setError(null);
    setCart((cur) => {
      const i = cur.findIndex((l) => l.titleId === c.id);
      if (i < 0) return [...cur, { titleId: c.id, name: it.titleName ?? c.name, isbn: c.isbn, unitPrice: it.effectivePrice!, available: it.available, quantity: 1 }];
      return cur.map((l, k) => (k === i ? { ...l, available: it.available, unitPrice: it.effectivePrice!, quantity: Math.min(l.quantity + 1, it.available) } : l));
    });
    setAdded(`Đã thêm «${it.titleName ?? c.name}».`);
  };

  const scan = async (code: string) => {
    const found = await findTitles(code);
    const exact = found.find((b) => normIsbn(b.isbn) === normIsbn(code));
    const one = exact ?? (found.length === 1 ? found[0] : undefined);
    if (!one) throw notFoundError(found.length ? "Có nhiều kết quả, hãy chọn ở ô tìm theo tên." : "Không tìm thấy sách có mã hoặc ISBN này.");
    await addTitle(one);
  };

  const update = (titleId: string, patch: Partial<CartLine>) => setCart((cur) => cur.map((l) => (l.titleId === titleId ? { ...l, ...patch } : l)));

  const gross = cart.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  const lineDisc = cart.reduce((a, l) => a + estimateDiscount(l.unitPrice * l.quantity, canDiscount ? l.discount : undefined), 0);
  const orderDisc = estimateDiscount(gross - lineDisc, canDiscount ? orderDiscount : undefined);
  const estimate = gross - lineDisc - orderDisc;

  const resetAfterSale = () => {
    setCart([]);
    setOrderDiscount(undefined);
    setWalkName("");
    setWalkPhone("");
    setCustomerNote("");
    req.current = null;
  };

  const checkout = async () => {
    if (busy.current || cart.length === 0 || qrOrder) return;
    const body: Record<string, unknown> = {
      lines: cart.map((l) => ({
        titleId: l.titleId,
        quantity: l.quantity,
        ...(canDiscount && l.discount ? { discount: l.discount } : {}),
      })),
      paymentMethod: payment,
      ...(walkName.trim() || walkPhone.trim() ? { walkIn: { name: walkName.trim() || null, phone: walkPhone.trim() || null } } : {}),
      ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
      ...(canDiscount && orderDiscount ? { orderDiscount } : {}),
      ...(exchangeOfReturnId ? { exchangeOfReturnId } : {}),
    };
    const sig = JSON.stringify(body);
    if (req.current?.sig !== sig) req.current = { sig, id: newRequestId() };
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const o = await apiFetch<SalesOrder>(canDiscount ? "/api/sales/pos-orders/discounted" : "/api/sales/pos-orders", {
        method: "POST",
        json: { ...body, clientRequestId: req.current.id },
      });
      void invalidate("/api/sales/stock-items", "/api/sales/orders", "/api/sales/shifts/me/current");
      if (o.paymentIntent && o.status === "AWAITING_PAYMENT") {
        // Đơn QR chưa thu: giữ giỏ và clientRequestId (bấm lại cùng nội dung trả đúng đơn này), mở khung QR.
        setQrOrder(o);
        setQrOpen(true);
        return;
      }
      setDone(o);
      resetAfterSale();
      if (exchangeOfReturnId) setSp(new URLSearchParams(), { replace: true });
    } catch (e) {
      const info = toErrorInfo(e);
      setError(info);
      if (info.code === "INSUFFICIENT_STOCK") {
        for (const g of parseKv(info.details)) {
          const n = Number(g.available);
          if (g.titleId && Number.isFinite(n)) setCart((cur) => cur.map((l) => (l.titleId === g.titleId ? { ...l, available: n, quantity: Math.max(1, Math.min(l.quantity, n)) } : l)));
        }
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (retryTick > 0) void checkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  const errorNode = (() => {
    if (!error) return null;
    const d = describeError(error);
    if (error.code === "SHIFT_NOT_OPEN") {
      return (
        <Alert
          type="warning"
          showIcon
          data-testid="shift-not-open"
          title={d.text}
          action={
            can(s, PERMISSIONS.SHIFT_OPEN) ? (
              <Button size="small" type="primary" onClick={() => setShiftSignal((n) => n + 1)}>
                Mở ca
              </Button>
            ) : undefined
          }
        />
      );
    }
    if (error.code === "INSUFFICIENT_STOCK") {
      const groups = parseKv(error.details);
      return (
        <Alert
          type="error"
          showIcon
          title={d.text}
          description={
            groups.length > 0 ? (
              <ul className="m-0 pl-4">
                {groups.map((g, i) => (
                  <li key={i}>
                    «{cart.find((l) => l.titleId === g.titleId)?.name ?? g.titleId?.slice(0, 8) ?? "Mặt hàng"}»: chỉ còn {g.available ?? "?"} cuốn khả dụng.
                  </li>
                ))}
              </ul>
            ) : undefined
          }
        />
      );
    }
    return <Alert type="error" showIcon title={d.text} description={d.details?.length ? d.details.join("; ") : d.detail} />;
  })();

  return (
    <SalesGate title="Bán tại quầy" description="Quét hoặc tìm sách, lập đơn và thu tiền." permission={[PERMISSIONS.POS_ORDER_CREATE, PERMISSIONS.POS_ORDER_CREATE_DISCOUNTED]}>
      <ShiftBar openSignal={shiftSignal} />
      {done ? (
        <div className="flex max-w-[1000px] flex-col gap-4">
          <div className="flex flex-col gap-3 print:hidden">
            <Alert
              type="success"
              showIcon
              title={
                <span data-testid="pos-done">
                  Đã bán đơn <span className="font-mono">{done.orderNo}</span>, tổng {formatMoney(done.grandTotal)}.
                </span>
              }
            />
            <div>
              <span className="inline-flex flex-wrap gap-2">
                <Button type="primary" onClick={() => setDone(null)}>
                  Bán đơn mới
                </Button>
                {can(s, PERMISSIONS.INVOICE_ISSUE) && can(s, PERMISSIONS.SALES_ORDER_VIEW) && (
                  <LinkButton to={`/sales/orders/${encodeURIComponent(done.id)}`} data-testid="pos-issue-invoice">
                    Xuất hóa đơn
                  </LinkButton>
                )}
              </span>
            </div>
          </div>
          {can(s, PERMISSIONS.SALES_ORDER_RECEIPT) && <ReceiptPanel orderId={done.id} />}
        </div>
      ) : (
        canSell && (
          <div className="flex flex-col gap-4">
            {exchangeOfReturnId && (
              <Alert
                type="info"
                showIcon
                data-testid="pos-exchange"
                title={`Đổi hàng theo phiếu trả ${exchangeOfReturnId.slice(0, 8)}`}
                description="Đơn mới được gắn với phiếu trả (mỗi phiếu chỉ đổi một lần). Chênh lệch tiền được xử lý ngoài hệ thống: khoản hoàn của phiếu trả và thanh toán của đơn mới là hai bản ghi riêng."
                action={
                  <Button size="small" onClick={() => setSp(new URLSearchParams(), { replace: true })}>
                    Bỏ đổi hàng
                  </Button>
                }
              />
            )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card title="Thêm hàng">
              <div className="flex flex-col gap-4">
                <ScanInput
                  label="Quét mã ISBN hoặc nhập mã rồi Enter"
                  hint="Chỉ thêm khi khớp đúng ISBN hoặc chỉ có một kết quả."
                  autoFocus
                  maxLength={64}
                  onScan={scan}
                  status={added}
                />
                {canStockList ? (
                  <PosCatalog
                    onPick={async (it) => {
                      setPickError(null);
                      try {
                        await addTitle({ id: it.titleId, name: it.titleName ?? it.titleId });
                      } catch (e) {
                        setPickError(describeError(toErrorInfo(e)).text);
                      }
                    }}
                  />
                ) : (
                  <TitleSearchList
                    find={findTitles}
                    onPick={async (c) => {
                      setPickError(null);
                      try {
                        await addTitle(c);
                      } catch (e) {
                        setPickError(describeError(toErrorInfo(e)).text);
                      }
                    }}
                  />
                )}
                {pickError && (
                  <div className="text-sm text-red-600" role="alert">
                    {pickError}
                  </div>
                )}
              </div>
            </Card>
            <Card title="Giỏ hàng">
              <div className="flex flex-col gap-3">
                {cart.length === 0 ? (
                  <p className="m-0 text-muted" data-testid="cart-empty">
                    Chưa có mặt hàng nào. Quét mã hoặc tìm sách để thêm.
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Các dòng trong giỏ">
                    {cart.map((l) => (
                      <li key={l.titleId} className="rounded-card border border-line p-2.5" data-testid="cart-line">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-ink">{l.name}</div>
                            <div className="text-xs text-muted">
                              {formatMoney(l.unitPrice)} · còn {l.available}
                            </div>
                          </div>
                          <Button size="small" aria-label={`Bỏ ${l.name}`} icon={<DeleteOutlined />} onClick={() => setCart((c) => c.filter((x) => x.titleId !== l.titleId))} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <InputNumber
                            aria-label={`Số lượng ${l.name}`}
                            min={1}
                            max={Math.max(1, l.available)}
                            precision={0}
                            value={l.quantity}
                            onChange={(n) => update(l.titleId, { quantity: n ?? 1 })}
                          />
                          {canDiscount && <DiscountInput label={`Giảm giá ${l.name}`} value={l.discount} onChange={(d) => update(l.titleId, { discount: d })} />}
                          <span className="ml-auto font-medium">{formatMoney(l.unitPrice * l.quantity)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {canDiscount && cart.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">Giảm giá cả đơn</span>
                    <DiscountInput label="Giảm giá cả đơn" value={orderDiscount} onChange={setOrderDiscount} />
                  </div>
                )}

                <div>
                  <div className="mb-1 text-sm font-medium text-ink">Hình thức thanh toán</div>
                  <Segmented
                    aria-label="Hình thức thanh toán"
                    value={payment}
                    onChange={(v) => setPayment(v as keyof typeof POS_PAYMENT_METHODS)}
                    options={Object.entries(POS_PAYMENT_METHODS)
                      .filter(([value]) => (value !== "QR" && value !== "MOMO") || (canQr && !exchangeOfReturnId))
                      .map(([value, label]) => ({ value, label }))}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label htmlFor="walk-name" className="mb-1 block text-sm text-muted">
                      Tên khách (tùy chọn)
                    </label>
                    <Input id="walk-name" autoComplete="off" maxLength={200} value={walkName} onChange={(e) => setWalkName(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="walk-phone" className="mb-1 block text-sm text-muted">
                      Điện thoại (tùy chọn)
                    </label>
                    <Input id="walk-phone" autoComplete="off" maxLength={30} value={walkPhone} onChange={(e) => setWalkPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label htmlFor="customer-note" className="mb-1 block text-sm text-muted">
                    Ghi chú của khách (tùy chọn)
                  </label>
                  <Input.TextArea id="customer-note" rows={2} maxLength={500} showCount value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
                </div>

                <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line pt-2">
                  <dt className="text-muted">Tạm tính</dt>
                  <dd className="m-0 text-right">{formatMoney(gross)}</dd>
                  {lineDisc + orderDisc > 0 && (
                    <>
                      <dt className="text-muted">Giảm giá (ước tính)</dt>
                      <dd className="m-0 text-right">-{formatMoney(lineDisc + orderDisc)}</dd>
                    </>
                  )}
                  <dt className="font-semibold">Cần thu (ước tính)</dt>
                  <dd className="m-0 text-right text-base font-semibold" data-testid="pos-estimate">
                    {formatMoney(estimate)}
                  </dd>
                </dl>
                <p className="m-0 text-xs text-muted">Số tiền cuối cùng (thuế, giảm giá) do hệ thống tính khi thanh toán.</p>

                {errorNode}
                {qrOrder && (
                  <Alert
                    type="warning"
                    showIcon
                    data-testid="qr-pending"
                    title={
                      <span>
                        Đơn <span className="font-mono">{qrOrder.orderNo}</span> {qrOrder.paymentIntent?.provider === "MANUAL" ? "đang chờ xác nhận đã thu." : qrOrder.paymentIntent?.provider === "MOMO" ? "đang chờ thanh toán MoMo." : "đang chờ thanh toán QR."}
                      </span>
                    }
                    action={
                      <Button size="small" onClick={() => setQrOpen(true)}>
                        {qrOrder.paymentIntent?.provider === "MANUAL" ? "Mở khung thu tiền" : "Mở mã QR"}
                      </Button>
                    }
                  />
                )}
                <Button type="primary" size="large" loading={submitting} disabled={cart.length === 0 || !!qrOrder} onClick={() => void checkout()}>
                  {payment === "QR" || payment === "MOMO" ? "Tạo mã QR" : "Thanh toán"}
                </Button>
              </div>
            </Card>
          </div>
          </div>
        )
      )}
      {qrOrder &&
        (() => {
          const Modal = qrOrder.paymentIntent?.provider === "MANUAL" ? ManualPaymentModal : QrPaymentModal;
          return (
            <Modal
              key={qrOrder.id}
              order={qrOrder}
              open={qrOpen}
              onClose={() => setQrOpen(false)}
              onPaid={(o) => {
                setQrOrder(null);
                setDone(o);
                resetAfterSale();
                if (exchangeOfReturnId) setSp(new URLSearchParams(), { replace: true });
              }}
              onAbandon={(retry) => {
                // Đơn cũ đã bị hủy: bỏ clientRequestId để lần tạo mới ra đơn mới thay vì trả lại đơn cũ.
                req.current = null;
                setQrOrder(null);
                if (retry) setRetryTick((n) => n + 1);
              }}
            />
          );
        })()}
    </SalesGate>
  );
}
