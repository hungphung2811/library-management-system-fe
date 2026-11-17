// Mock của module bán hàng (SALES): /api/sales/** theo docs/api/sales.md (hợp đồng pha 1) của repo BE.
// Trạng thái nằm trong bộ nhớ, dùng chung cho 2 worker: test dùng dữ liệu riêng (nhà cung cấp, mã đơn) và không giả định số lượng.
// Tài khoản bán hàng được gắn vào USERS của data.mjs ngay khi import (claim `modules` do mock-gateway.mjs đưa vào token).
import { BOOKS, USERS, TENANTS } from "./data.mjs";
import { createPhase2 } from "./sales-online.mjs";

const K = {
  SETTINGS_GET: "SalesSettingsController/get",
  SETTINGS_UPDATE: "SalesSettingsController/update",
  STOCK_REGISTER: "StockItemController/register",
  STOCK_SEARCH: "StockItemController/search",
  STOCK_VIEW: "StockItemController/get",
  STOCK_PRICE: "StockItemController/updatePrice",
  STOCK_LEDGER: "StockItemController/ledger",
  STOCK_ADJUST: "StockAdjustmentController/adjust",
  STOCK_STOCKTAKE: "StockAdjustmentController/stocktake",
  SUPPLIER_SEARCH: "SupplierController/search",
  SUPPLIER_CREATE: "SupplierController/create",
  SUPPLIER_UPDATE: "SupplierController/update",
  RECEIPT_CREATE: "GoodsReceiptController/create",
  RECEIPT_SEARCH: "GoodsReceiptController/search",
  RECEIPT_VIEW: "GoodsReceiptController/get",
  RECEIPT_CONFIRM: "GoodsReceiptController/confirm",
  RECEIPT_CANCEL: "GoodsReceiptController/cancel",
  POS: "PosOrderController/create",
  POS_DISCOUNT: "PosOrderController/createWithDiscount",
  ORDER_SEARCH: "SalesOrderController/search",
  ORDER_VIEW: "SalesOrderController/get",
  ORDER_CONTACT: "SalesOrderController/getContact",
  ORDER_RECEIPT: "SalesOrderController/receipt",
  // Pha 2 (xem sales-online.mjs)
  ORDER_CONFIRM: "SalesOrderController/confirm",
  ORDER_DISCOUNT: "SalesOrderController/applyDiscount",
  ORDER_PAID: "SalesOrderController/markPaid",
  ORDER_READY: "SalesOrderController/markReadyForPickup",
  ORDER_SHIPPING: "SalesOrderController/markShipping",
  ORDER_COMPLETE: "SalesOrderController/complete",
  ORDER_CANCEL: "SalesOrderController/cancel",
  RETURN_CREATE: "SalesReturnController/create",
  RETURN_LATE: "SalesReturnController/createLate",
  RETURN_GET: "SalesReturnController/get",
  RETURN_LIST: "SalesReturnController/listByOrder",
  REFUND_SEARCH: "RefundController/search",
  REFUND_MARK: "RefundController/markRefunded",
  AUDIT_SEARCH: "SalesAuditController/search",
};
const BOOK_SEARCH = "TitleController/search";
const BOOK_VIEW = "TitleController/get";
const TENANT_A = TENANTS[0].id;

const SALES_ALL = Object.values(K);
USERS.seller = {
  id: "seller-id", roles: ["CASHIER"], modules: ["LENDING", "SALES"], password: "Seller@12345",
  permissions: [K.POS, K.STOCK_VIEW, K.ORDER_RECEIPT, BOOK_SEARCH], tenantId: TENANT_A, tenants: [TENANT_A],
};
// Thu ngân thao tác đơn online và trả hàng trong hạn, nhưng KHÔNG có hủy đơn, áp giảm giá, trả quá hạn, hoàn tiền, nhật ký, xem liên hệ đầy đủ.
USERS.cashier = {
  id: "cashier-id", roles: ["CASHIER"], modules: ["LENDING", "SALES"], password: "Cashier@12345",
  permissions: [
    K.POS, K.STOCK_VIEW, K.ORDER_RECEIPT, BOOK_SEARCH, K.ORDER_SEARCH, K.ORDER_VIEW, K.ORDER_CONFIRM, K.ORDER_PAID, K.ORDER_READY,
    K.ORDER_SHIPPING, K.ORDER_COMPLETE, K.RETURN_CREATE, K.RETURN_GET, K.RETURN_LIST,
  ],
  tenantId: TENANT_A, tenants: [TENANT_A],
};
USERS.salesmgr = {
  id: "salesmgr-id", roles: ["SALES_MANAGER"], modules: ["LENDING", "SALES"], password: "Salesmgr@12345",
  permissions: [...SALES_ALL.filter((k) => k !== K.ORDER_CONTACT), BOOK_SEARCH, BOOK_VIEW], tenantId: TENANT_A, tenants: [TENANT_A],
};
USERS.salesadmin = {
  id: "salesadmin-id", roles: ["SUPER_ADMIN"], admin: true, modules: ["LENDING", "SALES"], password: "Salesadmin@12345",
  permissions: [], tenantId: TENANT_A, tenants: [TENANT_A],
};

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

let settings = {
  vatRateBps: 1000, pricesIncludeVat: false, returnWindowDays: 7, fixedShippingFee: 30000, lowStockThreshold: 5,
  walkInPiiRetentionMonths: 24, currency: "VND", version: 0, updatedAt: null,
};

/** titleId -> { onHand, reserved, sellingPrice, lowStockThreshold, ledger[] } */
const STOCK = new Map();
const entry = (titleId, type, delta, reason, ref = {}) => ({
  id: uuid(), titleId, type, deltaOnHand: delta, deltaReserved: ref.deltaReserved ?? 0, refType: ref.refType ?? null, refId: ref.refId ?? null, reason: reason ?? null, actorId: "mock", occurredAt: now(),
});
const addStock = (b, onHand) => STOCK.set(b.id, { onHand, reserved: 0, sellingPrice: null, lowStockThreshold: null, ledger: [entry(b.id, "RECEIPT", onHand, "Tồn đầu")] });
addStock(BOOKS[0], 10);
addStock(BOOKS[1], 2);

const book = (id) => BOOKS.find((b) => b.id === id);
const stockView = (titleId) => {
  const s = STOCK.get(titleId);
  const b = book(titleId);
  const available = s.onHand - s.reserved;
  const th = s.lowStockThreshold ?? settings.lowStockThreshold;
  return {
    titleId, titleName: b?.name ?? null, onHand: s.onHand, reserved: s.reserved, available, sellingPrice: s.sellingPrice,
    effectivePrice: s.sellingPrice ?? (b ? Math.round(b.coverPrice) : null), lowStock: available <= th, active: true, lowStockThreshold: s.lowStockThreshold,
  };
};

const SUPPLIERS = [{ id: uuid(), name: "Nhà sách Mẫu", phone: "0281234567", email: null, address: null, note: null, active: true }];
const RECEIPTS = [];
let receiptSeq = 0;
const ORDERS = [];
const ORDER_PII = new Map();
const ORDER_BY_REQ = new Map();
const RECEIPT_BY_REQ = new Map();
let orderSeq = 0;

const page = (items, sp) => {
  const p = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
  return { items: items.slice(p * size, p * size + size), total: items.length, page: p, size };
};

const maskName = (n) => (n ? n.split(/\s+/).map((w) => `${w[0]}***`).join(" ") : null);
const maskPhone = (p) => (p ? `${"*".repeat(Math.max(0, p.length - 3))}${p.slice(-3)}` : null);
// Địa chỉ che: chỉ giữ hai đoạn cuối (quận/huyện, tỉnh/thành); ít hơn ba đoạn thì "***".
const maskAddress = (a) => {
  if (!a) return null;
  const parts = a.split(",").map((x) => x.trim());
  return parts.length < 3 ? "***" : `***, ${parts.slice(-2).join(", ")}`;
};
const orderView = (o) => {
  const pii = ORDER_PII.get(o.id);
  return { ...o, contact: { name: maskName(pii?.name), phone: maskPhone(pii?.phone), address: maskAddress(pii?.address), piiAnonymizedAt: null } };
};
const RETURNS = [];
const AUDIT = [];
const audit = (caller, action, aggregateType, aggregateId, data = {}) =>
  AUDIT.unshift({ id: uuid(), action, aggregateType, aggregateId, actorId: caller ? (USERS[caller]?.id ?? null) : null, occurredAt: now(), data });

export function handle({ method, url, body, send, requireKey, caller }) {
  const p = url.pathname;
  if (!p.startsWith("/api/sales/")) return false;
  const sp = url.searchParams;
  let m;
  const err = (status, code, message, details = []) => (send(status, { code, message, details, timestamp: now() }), true);
  const invalid = (...details) => err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", details);

  // ---- Cấu hình ----
  if (p === "/api/sales/settings") {
    if (method === "GET") return requireKey(K.SETTINGS_GET) && (send(200, settings), true) || true;
    if (method === "PUT") {
      if (!requireKey(K.SETTINGS_UPDATE)) return true;
      if (body.version !== settings.version) return err(409, "SETTINGS_VERSION_CONFLICT", "Cấu hình vừa được người khác sửa");
      const b = body;
      if (!(b.vatRateBps >= 0 && b.vatRateBps <= 10000)) return err(400, "INVALID_SETTINGS", "VAT không hợp lệ");
      settings = { ...settings, ...b, version: settings.version + 1, updatedAt: now() };
      return send(200, settings), true;
    }
  }

  // ---- Tồn kho ----
  if (p === "/api/sales/stock-items" && method === "GET") {
    if (!requireKey(K.STOCK_SEARCH)) return true;
    let items = [...STOCK.keys()].map(stockView);
    if (sp.get("lowStockOnly") === "true") items = items.filter((i) => i.lowStock);
    return send(200, page(items, sp)), true;
  }
  if (p === "/api/sales/stock-items" && method === "POST") {
    if (!requireKey(K.STOCK_REGISTER)) return true;
    const b = book(body.titleId);
    if (!b) return err(409, "TITLE_NOT_AVAILABLE", "Không có đầu sách");
    if (STOCK.has(b.id)) return err(409, "STOCK_ITEM_EXISTS", "Đã đăng ký");
    STOCK.set(b.id, { onHand: 0, reserved: 0, sellingPrice: body.sellingPrice ?? null, lowStockThreshold: body.lowStockThreshold ?? null, ledger: [] });
    return send(201, stockView(b.id)), true;
  }
  if ((m = p.match(/^\/api\/sales\/stock-items\/([^/]+)(?:\/(price|ledger))?$/))) {
    const [, id, sub] = m;
    if (method === "GET" && sub === "ledger") {
      if (!requireKey(K.STOCK_LEDGER)) return true;
      if (!STOCK.has(id)) return err(404, "STOCK_ITEM_NOT_FOUND", "Không có mặt hàng");
      return send(200, page([...STOCK.get(id).ledger].reverse(), sp)), true;
    }
    if (method === "GET" && !sub) {
      if (!requireKey(K.STOCK_VIEW)) return true;
      return STOCK.has(id) ? (send(200, stockView(id)), true) : err(404, "STOCK_ITEM_NOT_FOUND", "Không có mặt hàng");
    }
    if (method === "PUT" && sub === "price") {
      if (!requireKey(K.STOCK_PRICE)) return true;
      if (!STOCK.has(id)) return err(404, "STOCK_ITEM_NOT_FOUND", "Không có mặt hàng");
      STOCK.get(id).sellingPrice = body.sellingPrice ?? null;
      return send(200, stockView(id)), true;
    }
  }
  if (p === "/api/sales/stock-adjustments" && method === "POST") {
    if (!requireKey(K.STOCK_ADJUST)) return true;
    const s = STOCK.get(body.titleId);
    if (!s) return err(409, "STOCK_ITEM_NOT_REGISTERED", "Chưa đăng ký");
    if (!body.delta) return err(400, "INVALID_QUANTITY", "Số lượng khác 0");
    if (!String(body.reason ?? "").trim()) return invalid("reason: không được để trống");
    if (s.onHand - s.reserved + body.delta < 0) return err(409, "INSUFFICIENT_STOCK", "Không đủ tồn", [`available=${s.onHand - s.reserved}`, `titleId=${body.titleId}`]);
    s.onHand += body.delta;
    s.ledger.push(entry(body.titleId, "ADJUSTMENT", body.delta, body.reason, { refType: "ADJUSTMENT" }));
    return send(200, stockView(body.titleId)), true;
  }
  if (p === "/api/sales/stocktakes" && method === "POST") {
    if (!requireKey(K.STOCK_STOCKTAKE)) return true;
    const s = STOCK.get(body.titleId);
    if (!s) return err(404, "STOCK_ITEM_NOT_FOUND", "Không có mặt hàng");
    if (!String(body.reason ?? "").trim()) return invalid("reason: không được để trống");
    if (!(body.countedOnHand >= s.reserved)) return err(400, "INVALID_QUANTITY", "Số đếm nhỏ hơn số đang giữ");
    const delta = body.countedOnHand - s.onHand;
    s.onHand = body.countedOnHand;
    s.ledger.push(entry(body.titleId, "STOCKTAKE", delta, body.reason, { refType: "STOCKTAKE" }));
    return send(200, stockView(body.titleId)), true;
  }

  // ---- Nhà cung cấp ----
  if (p === "/api/sales/suppliers" && method === "GET") {
    if (!requireKey(K.SUPPLIER_SEARCH)) return true;
    const kw = (sp.get("keyword") ?? "").toLowerCase();
    return send(200, page(SUPPLIERS.filter((x) => !kw || x.name.toLowerCase().includes(kw)), sp)), true;
  }
  if (p === "/api/sales/suppliers" && method === "POST") {
    if (!requireKey(K.SUPPLIER_CREATE)) return true;
    const name = String(body.name ?? "").trim();
    if (!name) return invalid("name: không được để trống");
    if (SUPPLIERS.some((x) => x.name.toLowerCase() === name.toLowerCase())) return err(409, "SUPPLIER_EXISTS", "Trùng tên");
    const s = { id: uuid(), name, phone: body.phone ?? null, email: body.email ?? null, address: body.address ?? null, note: body.note ?? null, active: true };
    SUPPLIERS.unshift(s);
    return send(201, s), true;
  }
  if ((m = p.match(/^\/api\/sales\/suppliers\/([^/]+)$/)) && method === "PUT") {
    if (!requireKey(K.SUPPLIER_UPDATE)) return true;
    const s = SUPPLIERS.find((x) => x.id === m[1]);
    if (!s) return err(404, "SUPPLIER_NOT_FOUND", "Không có nhà cung cấp");
    const name = String(body.name ?? "").trim();
    if (!name) return invalid("name: không được để trống");
    if (SUPPLIERS.some((x) => x.id !== s.id && x.name.toLowerCase() === name.toLowerCase())) return err(409, "SUPPLIER_EXISTS", "Trùng tên");
    Object.assign(s, { name, phone: body.phone ?? null, email: body.email ?? null, address: body.address ?? null, note: body.note ?? null, active: body.active ?? s.active });
    return send(200, s), true;
  }

  // ---- Phiếu nhập ----
  if (p === "/api/sales/goods-receipts" && method === "POST") {
    if (!requireKey(K.RECEIPT_CREATE)) return true;
    if (RECEIPT_BY_REQ.has(body.clientRequestId)) return send(201, RECEIPT_BY_REQ.get(body.clientRequestId)), true;
    if (!SUPPLIERS.some((x) => x.id === body.supplierId)) return err(404, "SUPPLIER_NOT_FOUND", "Không có nhà cung cấp");
    if (!Array.isArray(body.lines) || body.lines.length === 0) return invalid("lines: không được rỗng");
    for (const l of body.lines) if (!STOCK.has(l.titleId)) return err(409, "STOCK_ITEM_NOT_REGISTERED", "Chưa đăng ký");
    const lines = body.lines.map((l) => ({ titleId: l.titleId, quantity: l.quantity, unitCost: l.unitCost, lineCost: l.quantity * l.unitCost }));
    const r = {
      id: uuid(), receiptNo: `PN-${String(++receiptSeq).padStart(6, "0")}`, supplierId: body.supplierId, status: "DRAFT", lines,
      totalCost: lines.reduce((a, l) => a + l.lineCost, 0), createdAt: now(), createdBy: "mock", confirmedAt: null, confirmedBy: null, version: 0,
    };
    RECEIPTS.unshift(r);
    RECEIPT_BY_REQ.set(body.clientRequestId, r);
    return send(201, r), true;
  }
  if (p === "/api/sales/goods-receipts" && method === "GET") {
    if (!requireKey(K.RECEIPT_SEARCH)) return true;
    const st = sp.get("status");
    const sup = sp.get("supplierId");
    return send(200, page(RECEIPTS.filter((r) => (!st || r.status === st) && (!sup || r.supplierId === sup)), sp)), true;
  }
  if ((m = p.match(/^\/api\/sales\/goods-receipts\/([^/]+)(?:\/(confirmation|cancellation))?$/))) {
    const r = RECEIPTS.find((x) => x.id === m[1]);
    const key = m[2] === "confirmation" ? K.RECEIPT_CONFIRM : m[2] === "cancellation" ? K.RECEIPT_CANCEL : K.RECEIPT_VIEW;
    if ((m[2] ? method === "POST" : method === "GET") === false) return false;
    if (!requireKey(key)) return true;
    if (!r) return err(404, "RECEIPT_NOT_FOUND", "Không có phiếu nhập");
    if (!m[2]) return send(200, r), true;
    if (r.status !== "DRAFT") return err(409, "RECEIPT_STATE_CONFLICT", "Phiếu không còn là nháp");
    if (m[2] === "confirmation") {
      for (const l of r.lines) {
        const s = STOCK.get(l.titleId);
        s.onHand += l.quantity;
        s.ledger.push(entry(l.titleId, "RECEIPT", l.quantity, null, { refType: "GOODS_RECEIPT", refId: r.id }));
      }
      Object.assign(r, { status: "CONFIRMED", confirmedAt: now(), confirmedBy: "mock", version: r.version + 1 });
    } else Object.assign(r, { status: "CANCELLED", version: r.version + 1 });
    return send(200, r), true;
  }

  // ---- Bán tại quầy ----
  if (p === "/api/sales/pos-orders" || p === "/api/sales/pos-orders/discounted") {
    if (method !== "POST") return false;
    const discounted = p.endsWith("/discounted");
    if (!requireKey(discounted ? K.POS_DISCOUNT : K.POS)) return true;
    if (ORDER_BY_REQ.has(body.clientRequestId)) return send(201, orderView(ORDER_BY_REQ.get(body.clientRequestId))), true;
    if (!Array.isArray(body.lines) || body.lines.length === 0) return invalid("lines: không được rỗng");
    if (!["CASH", "BANK_TRANSFER", "CARD"].includes(body.paymentMethod)) return err(400, "INVALID_REQUEST", "Hình thức thanh toán không hợp lệ");
    if (!discounted && (body.orderDiscount || body.lines.some((l) => l.discount))) return err(400, "DISCOUNT_NOT_ALLOWED", "Không được giảm giá");
    const disc = (d, base) => (!d ? 0 : d.type === "PERCENT" ? Math.floor((base * d.value) / 10000) : d.value);
    const need = new Map();
    for (const l of body.lines) need.set(l.titleId, (need.get(l.titleId) ?? 0) + l.quantity);
    const short = [];
    for (const [id, q] of need) {
      const s = STOCK.get(id);
      if (!s) return err(409, "STOCK_ITEM_NOT_REGISTERED", "Chưa đăng ký");
      if (s.onHand - s.reserved < q) short.push(`available=${s.onHand - s.reserved}`, `titleId=${id}`);
    }
    if (short.length) return err(409, "INSUFFICIENT_STOCK", "Không đủ tồn", short);
    if (body.exchangeOfReturnId) {
      const rt = RETURNS.find((x) => x.id === body.exchangeOfReturnId);
      if (!rt) return err(404, "RETURN_NOT_FOUND", "Không có phiếu trả");
      if (ORDERS.some((x) => x.exchangeOfReturnId === rt.id)) return err(409, "ORDER_STATE_CONFLICT", "Phiếu trả đã đổi hàng");
    }
    let subtotal = 0;
    let lineDisc = 0;
    let over = false;
    const lines = body.lines.map((l, i) => {
      const unitPrice = stockView(l.titleId).effectivePrice;
      const gross = unitPrice * l.quantity;
      const d = disc(l.discount, gross);
      if (d > gross) over = true;
      subtotal += gross;
      lineDisc += d;
      return { id: uuid(), lineNo: i + 1, titleId: l.titleId, titleName: book(l.titleId)?.name ?? "", isbn: book(l.titleId)?.isbn ?? null, quantity: l.quantity, unitPrice, lineDiscount: d, allocatedOrderDiscount: 0, amount: gross - d, vatAmount: 0, lineTotal: gross - d };
    });
    if (over) return err(400, "DISCOUNT_EXCEEDS_AMOUNT", "Giảm giá vượt giá trị dòng");
    const orderDisc = disc(body.orderDiscount, subtotal - lineDisc);
    if (orderDisc > subtotal - lineDisc) return err(400, "DISCOUNT_EXCEEDS_AMOUNT", "Giảm giá vượt giá trị đơn");
    const discountTotal = lineDisc + orderDisc;
    const taxable = subtotal - discountTotal;
    const vatTotal = Math.floor((taxable * settings.vatRateBps) / 10000);
    const id = uuid();
    const o = {
      id, orderNo: `DH-${String(++orderSeq).padStart(6, "0")}`, channel: "POS", status: "COMPLETED", paymentStatus: "PAID", paymentMethod: body.paymentMethod,
      fulfilment: "COUNTER", customerUserId: body.customerUserId ?? null, vatRateBps: settings.vatRateBps, pricesIncludeVat: settings.pricesIncludeVat, currency: "VND",
      subtotal, discountTotal, vatTotal, shippingFee: 0, grandTotal: taxable + vatTotal, createdAt: now(), completedAt: now(), version: 0, lines,
      confirmedAt: null, paidAt: now(), cancelledAt: null, cancelReason: null, exchangeOfReturnId: body.exchangeOfReturnId ?? null,
      _orderDiscount: orderDisc, _taxable: taxable,
    };
    for (const [tid, q] of need) {
      const s = STOCK.get(tid);
      s.onHand -= q;
      s.ledger.push(entry(tid, "SALE", -q, null, { refType: "ORDER", refId: id }));
    }
    if (body.walkIn) ORDER_PII.set(id, { name: body.walkIn.name ?? null, phone: body.walkIn.phone ?? null });
    ORDERS.unshift(o);
    ORDER_BY_REQ.set(body.clientRequestId, o);
    return send(201, orderView(o)), true;
  }

  // ---- Đơn hàng ----
  if (p === "/api/sales/orders" && method === "GET") {
    if (!requireKey(K.ORDER_SEARCH)) return true;
    const f = (k) => sp.get(k);
    const items = ORDERS.filter(
      (o) =>
        (!f("status") || o.status === f("status")) &&
        (!f("paymentStatus") || o.paymentStatus === f("paymentStatus")) &&
        (!f("channel") || o.channel === f("channel")) &&
        (!f("keyword") || o.orderNo.toLowerCase().includes(f("keyword").toLowerCase())) &&
        (!f("from") || o.createdAt >= f("from")) &&
        (!f("to") || o.createdAt < f("to")),
    );
    return send(200, page(items.map(orderView), sp)), true;
  }
  if ((m = p.match(/^\/api\/sales\/orders\/([^/]+)(?:\/(contact|receipt))?$/)) && method === "GET") {
    const o = ORDERS.find((x) => x.id === m[1]);
    const key = m[2] === "contact" ? K.ORDER_CONTACT : m[2] === "receipt" ? K.ORDER_RECEIPT : K.ORDER_VIEW;
    if (!requireKey(key)) return true;
    if (!o) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
    if (m[2] === "contact") {
      const pii = ORDER_PII.get(o.id);
      return send(200, { name: pii?.name ?? null, phone: pii?.phone ?? null, address: o.channel === "ONLINE" ? (pii?.address ?? null) : null, piiAnonymizedAt: null }), true;
    }
    if (m[2] === "receipt") {
      return send(200, {
        orderId: o.id, orderNo: o.orderNo, issuedAt: o.completedAt, currency: "VND", vatRateBps: o.vatRateBps, pricesIncludeVat: o.pricesIncludeVat,
        lines: o.lines.map((l) => ({ lineNo: l.lineNo, titleName: l.titleName, isbn: l.isbn, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.lineDiscount, amount: l.amount, vatAmount: l.vatAmount, lineTotal: l.lineTotal })),
        subtotal: o.subtotal, lineDiscountTotal: o.discountTotal - o._orderDiscount, orderDiscountTotal: o._orderDiscount, discountTotal: o.discountTotal,
        taxableAmount: o._taxable, vatTotal: o.vatTotal, shippingFee: 0, grandTotal: o.grandTotal, paymentMethod: o.paymentMethod,
      }), true;
    }
    return send(200, orderView(o)), true;
  }
  // ---- Pha 2: thao tác đơn online, trả hàng, hoàn tiền, nhật ký ----
  return phase2({ method, url, body, send, requireKey, caller, err });
}

const phase2 = createPhase2({
  K, STOCK, ORDERS, ORDER_PII, RETURNS, AUDIT, audit, entry, book, stockView, page, uuid, now, getSettings: () => settings, orderView, USERS,
});
