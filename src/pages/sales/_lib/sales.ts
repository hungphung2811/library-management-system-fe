import { ApiCallError, apiFetch } from "@/api";
import type { TitleView } from "@/pages/catalog/_components/types";

/** Kết quả phân trang của /api/sales/**: `page` đánh số từ 0. */
export type Page<T> = { items: T[]; total: number; page: number; size: number };

export type SalesSettings = {
  vatRateBps: number;
  pricesIncludeVat: boolean;
  returnWindowDays: number;
  fixedShippingFee: number;
  lowStockThreshold: number;
  walkInPiiRetentionMonths: number;
  currency: string;
  version: number;
  updatedAt: string | null;
};

export type StockItem = {
  titleId: string;
  titleName: string | null;
  onHand: number;
  reserved: number;
  available: number;
  sellingPrice: number | null;
  /** null khi catalog không trả đầu sách: chưa bán được. */
  effectivePrice: number | null;
  lowStock: boolean;
  active: boolean;
  lowStockThreshold: number | null;
  sku?: string | null;
  supplier?: string | null;
  binLocation?: string | null;
};

export type LedgerEntry = {
  id: string;
  titleId: string;
  type: string;
  deltaOnHand: number;
  deltaReserved: number;
  refType: string | null;
  refId: string | null;
  reason: string | null;
  actorId: string | null;
  occurredAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  active: boolean;
};

export type ReceiptLine = { titleId: string; titleName?: string | null; quantity: number; unitCost: number; lineCost: number };

export type GoodsReceipt = {
  id: string;
  receiptNo: string;
  supplierId: string;
  supplierName?: string | null;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | string;
  lines: ReceiptLine[];
  totalCost: number;
  createdAt: string;
  createdBy: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  version: number;
};

export type OrderContact = { name: string | null; phone: string | null; address: string | null; piiAnonymizedAt: string | null };

export type OrderLine = {
  id: string;
  lineNo: number;
  titleId: string;
  titleName: string;
  isbn: string | null;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  allocatedOrderDiscount: number;
  amount: number;
  vatAmount: number;
  lineTotal: number;
};

export type SalesOrder = {
  id: string;
  orderNo: string;
  channel: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  fulfilment: string | null;
  customerUserId: string | null;
  contact: OrderContact | null;
  vatRateBps: number;
  pricesIncludeVat: boolean;
  currency: string;
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  shippingFee: number;
  grandTotal: number;
  createdAt: string;
  confirmedAt?: string | null;
  paidAt?: string | null;
  completedAt: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  exchangeOfReturnId?: string | null;
  version: number;
  lines: OrderLine[];
  /** Chỉ đơn POS thanh toán QR (status AWAITING_PAYMENT lúc mới tạo). */
  paymentIntent?: PaymentIntent | null;
};

/** Lệnh thanh toán QR của cổng giả lập (sandbox). */
export type PaymentIntent = {
  id: string;
  orderId: string;
  reference: string;
  amount: number;
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | string;
  provider: string;
  /** Chỉ intent SIMULATED (QR); intent MANUAL không có. */
  qrPayload: string | null;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  /** Chỉ sau khi xác nhận tiền mặt. */
  tenderedAmount?: number | null;
  changeDue?: number | null;
  /** Chỉ sau khi xác nhận thẻ/chuyển khoản. */
  transactionRef?: string | null;
};

export type ReturnLine = { id: string; orderLineId: string; titleId: string; quantity: number; disposition: string; refundAmount: number };

export type SalesReturn = {
  id: string;
  returnNo: string;
  orderId: string;
  reason: string;
  late: boolean;
  lateReason: string | null;
  daysOverdue: number;
  refundTotal: number;
  refundId: string | null;
  createdBy: string | null;
  createdAt: string;
  lines: ReturnLine[];
};

export type Refund = {
  id: string;
  orderId: string;
  source: "CANCELLATION" | "RETURN" | string;
  returnId: string | null;
  amount: number;
  status: "PENDING" | "REFUNDED" | string;
  method: string | null;
  reference: string | null;
  createdAt: string;
  refundedBy: string | null;
  refundedAt: string | null;
  version: number;
};

export type AuditEntry = {
  id: string;
  action: string;
  aggregateType: string;
  aggregateId: string | null;
  actorId: string | null;
  occurredAt: string;
  data: Record<string, unknown> | null;
};

export type PrintReceipt = {
  orderId: string;
  orderNo: string;
  issuedAt: string;
  currency: string;
  vatRateBps: number;
  pricesIncludeVat: boolean;
  lines: {
    lineNo: number;
    titleName: string;
    isbn: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    amount: number;
    vatAmount: number;
    lineTotal: number;
  }[];
  subtotal: number;
  lineDiscountTotal: number;
  orderDiscountTotal: number;
  discountTotal: number;
  taxableAmount: number;
  vatTotal: number;
  shippingFee: number;
  grandTotal: number;
  paymentMethod: string | null;
};

export type Discount = { type: "AMOUNT" | "PERCENT"; value: number };

/** Hình thức thu tay ở quầy và khi đánh dấu đã thu/hoàn: không có COD, không có QR (QR đi qua cổng thanh toán). */
export const PAYMENT_METHODS: Record<string, string> = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản", CARD: "Thẻ" };
/** Hình thức chọn ở POS: thêm QR (cổng giả lập, cần khóa PaymentIntentController/*). */
export const POS_PAYMENT_METHODS: Record<string, string> = { ...PAYMENT_METHODS, QR: "QR", MOMO: "MoMo (sandbox)" };
/** Mọi hình thức để hiển thị (đơn online có thêm COD, đơn POS có thêm QR). */
export const ALL_PAYMENT_METHODS: Record<string, string> = { ...POS_PAYMENT_METHODS, COD: "Thu khi giao (COD)" };
export const FULFILMENTS: Record<string, string> = { COUNTER: "Tại quầy", PICKUP: "Nhận tại cửa hàng", DELIVERY: "Giao tận nơi" };
export const DISPOSITIONS: Record<string, string> = { RESTOCK: "Nhập lại tồn", WRITE_OFF: "Hao hụt (xuất hủy)" };
export const REFUND_STATUS: Record<string, string> = { PENDING: "Chờ hoàn", REFUNDED: "Đã hoàn" };
export const REFUND_SOURCE: Record<string, string> = { CANCELLATION: "Hủy đơn đã thu", RETURN: "Phiếu trả hàng" };
export const AUDIT_ACTIONS: Record<string, string> = {
  ORDER_CREATED: "Tạo đơn",
  ORDER_CONFIRMED: "Xác nhận đơn",
  ORDER_DISCOUNT_APPLIED: "Áp giảm giá",
  ORDER_PAID: "Đánh dấu đã thu",
  ORDER_READY_FOR_PICKUP: "Sẵn sàng nhận",
  ORDER_SHIPPING: "Đang giao",
  ORDER_COMPLETED: "Hoàn tất đơn",
  ORDER_CANCELLED: "Hủy đơn",
  RETURN_CREATED: "Tạo phiếu trả",
  RETURN_LATE_APPROVED: "Cho phép trả quá hạn",
  REFUND_CREATED: "Tạo khoản hoàn",
  REFUND_COMPLETED: "Đánh dấu đã hoàn",
  WALK_IN_PII_ANONYMIZED: "Ẩn danh khách vãng lai",
  GOODS_RECEIPT_CREATED: "Tạo phiếu nhập",
  GOODS_RECEIPT_CONFIRMED: "Xác nhận phiếu nhập",
  GOODS_RECEIPT_CANCELLED: "Hủy phiếu nhập",
  STOCK_ITEM_REGISTERED: "Đăng ký mặt hàng",
  STOCK_ADJUSTED: "Điều chỉnh tồn",
  STOCKTAKE_RECORDED: "Kiểm kho",
  PRICE_CHANGED: "Đổi giá bán",
  SETTINGS_CHANGED: "Đổi cấu hình",
  SUPPLIER_CREATED: "Tạo nhà cung cấp",
  SUPPLIER_UPDATED: "Sửa nhà cung cấp",
};

export const ORDER_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: "Chờ thanh toán",
  PENDING_CONFIRMATION: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  READY_FOR_PICKUP: "Sẵn sàng nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
export const ORDER_STATUS_COLOR: Record<string, string> = {
  AWAITING_PAYMENT: "orange",
  PENDING_CONFIRMATION: "gold",
  CONFIRMED: "blue",
  READY_FOR_PICKUP: "blue",
  SHIPPING: "geekblue",
  COMPLETED: "success",
  CANCELLED: "default",
};
export const PAYMENT_STATUS: Record<string, string> = {
  UNPAID: "Chưa thu",
  PAID: "Đã thu",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
  REFUNDED: "Đã hoàn tiền",
};
export const CHANNELS: Record<string, string> = { POS: "Tại quầy", ONLINE: "Trực tuyến" };
export const RECEIPT_STATUS: Record<string, string> = { DRAFT: "Nháp", CONFIRMED: "Đã nhập kho", CANCELLED: "Đã hủy" };
export const LEDGER_TYPES: Record<string, string> = {
  RECEIPT: "Nhập kho",
  SALE: "Bán hàng",
  RESERVE: "Giữ hàng",
  RELEASE: "Nhả hàng giữ",
  FULFIL: "Giao hàng",
  RETURN: "Trả hàng",
  WRITE_OFF: "Xuất hủy",
  ADJUSTMENT: "Điều chỉnh",
  STOCKTAKE: "Kiểm kho",
  CANCEL_RESTOCK: "Hủy đơn, nhập lại",
};

export const label = (map: Record<string, string>, v: string | null | undefined) => (v ? (map[v] ?? v) : "—");

/** `details` của lỗi BE là danh sách "khóa=giá trị": gom thành các nhóm (mỗi lần gặp lại khóa đầu tiên là nhóm mới). */
export function parseKv(details: string[] | undefined): Record<string, string>[] {
  const groups: Record<string, string>[] = [];
  let cur: Record<string, string> = {};
  for (const d of details ?? []) {
    const i = d.indexOf("=");
    if (i < 1) continue;
    const k = d.slice(0, i);
    if (k in cur) {
      groups.push(cur);
      cur = {};
    }
    cur[k] = d.slice(i + 1);
  }
  if (Object.keys(cur).length) groups.push(cur);
  return groups;
}

/** Phần trăm từ điểm cơ bản (1000 = 10%), không dùng số thực: "10", "7,5". */
export function bpsToPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const frac = Math.abs(bps % 100);
  return frac === 0 ? String(whole) : `${whole},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** Ước tính giảm giá phía FE (số nguyên đồng, làm tròn xuống); số tiền thật do BE tính. */
export function estimateDiscount(base: number, d: Discount | undefined): number {
  if (!d || d.value <= 0 || base <= 0) return 0;
  const v = d.type === "PERCENT" ? Math.floor((base * Math.min(d.value, 10000)) / 10000) : d.value;
  return Math.min(v, base);
}

export const newRequestId = () => crypto.randomUUID();

/** Tìm đầu sách theo từ khóa (tên, tác giả, ISBN) qua /api/books. */
export function searchBooks(keyword: string): Promise<TitleView[]> {
  return apiFetch<TitleView[]>(`/api/books?keyword=${encodeURIComponent(keyword)}`).then((r) => (Array.isArray(r) ? r : []));
}

export const bookLabel = (b: TitleView) => (b.isbn ? `${b.name} (${b.isbn})` : b.name);

export const notFoundError = (message: string) => new ApiCallError(404, undefined, message);

/** Chuẩn hóa ISBN để so khớp: bỏ gạch nối và khoảng trắng. */
export const normIsbn = (s: string | null | undefined) => (s ?? "").replace(/[\s-]/g, "").toLowerCase();

export const pageParams = (sp: URLSearchParams, size: number, extra: Record<string, string | undefined> = {}) => {
  const q = new URLSearchParams();
  q.set("page", String(Math.max(0, (Number(sp.get("page")) || 1) - 1)));
  q.set("size", String(size));
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return q.toString();
};
