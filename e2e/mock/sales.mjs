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
  STOCK_DETAILS: "StockItemController/getDetails",
  STOCK_DETAILS_UPDATE: "StockItemController/updateDetails",
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
  ORDER_NOTES: "SalesOrderController/getNotes",
  ORDER_NOTES_UPDATE: "SalesOrderController/updateNotes",
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
  // Thanh toán QR (cổng giả lập)
  PI_GET: "PaymentIntentController/get",
  PI_CANCEL: "PaymentIntentController/cancel",
  PI_SIMULATE: "PaymentIntentController/simulatePaid",
  PI_CONFIRM: "PaymentIntentController/confirm",
};
const BOOK_SEARCH = "TitleController/search";
const BOOK_VIEW = "TitleController/get";
const TENANT_A = TENANTS[0].id;

const SALES_ALL = Object.values(K);
USERS.seller = {
  id: "seller-id", roles: ["CASHIER"], modules: ["LENDING", "SALES"], password: "Seller@12345",
  permissions: [K.POS, K.STOCK_VIEW, K.ORDER_RECEIPT, BOOK_SEARCH, K.PI_GET, K.PI_CANCEL, K.PI_CONFIRM, K.PI_SIMULATE], tenantId: TENANT_A, tenants: [TENANT_A],
};
// Thu ngân thao tác đơn online và trả hàng trong hạn, nhưng KHÔNG có hủy đơn, áp giảm giá, trả quá hạn, hoàn tiền, nhật ký, xem liên hệ đầy đủ.
USERS.cashier = {
  id: "cashier-id", roles: ["CASHIER"], modules: ["LENDING", "SALES"], password: "Cashier@12345",
  permissions: [
    K.POS, K.STOCK_VIEW, K.ORDER_RECEIPT, BOOK_SEARCH, K.ORDER_SEARCH, K.ORDER_VIEW, K.ORDER_CONFIRM, K.ORDER_PAID, K.ORDER_READY,
    K.ORDER_SHIPPING, K.ORDER_COMPLETE, K.RETURN_CREATE, K.RETURN_GET, K.RETURN_LIST, K.PI_GET, K.PI_CANCEL, K.PI_CONFIRM, K.PI_SIMULATE,
  ],
  tenantId: TENANT_A, tenants: [TENANT_A],
};
// stocklite: chỉ xem tồn kho (không có khóa getDetails: không thấy giá nhập/ghi chú). stockview: xem chi tiết và ghi chú đơn nhưng không sửa.
USERS.stocklite = {
  id: "stocklite-id", roles: ["STOCK_VIEWER"], modules: ["LENDING", "SALES"], password: "Stocklite@12345",
  permissions: [K.STOCK_SEARCH, K.STOCK_VIEW], tenantId: TENANT_A, tenants: [TENANT_A],
};
USERS.stockview = {
  id: "stockview-id", roles: ["STOCK_VIEWER"], modules: ["LENDING", "SALES"], password: "Stockview@12345",
  permissions: [K.STOCK_SEARCH, K.STOCK_VIEW, K.STOCK_DETAILS, K.ORDER_SEARCH, K.ORDER_VIEW, K.ORDER_NOTES], tenantId: TENANT_A, tenants: [TENANT_A],
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
const addStock = (b, onHand) => STOCK.set(b.id, { onHand, reserved: 0, sellingPrice: null, lowStockThreshold: null, sku: null, supplier: null, costPrice: null, binLocation: null, reorderQuantity: null, lastRestockedAt: null, note: null, ledger: [entry(b.id, "RECEIPT", onHand, "Tồn đầu")] });
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
    sku: s.sku, supplier: s.supplier, binLocation: s.binLocation, reorderQuantity: s.reorderQuantity, lastRestockedAt: s.lastRestockedAt,
  };
};
const detailsView = (id) => {
  const s = STOCK.get(id);
  return { titleId: id, sku: s.sku, supplier: s.supplier, costPrice: s.costPrice, binLocation: s.binLocation, reorderQuantity: s.reorderQuantity, lastRestockedAt: s.lastRestockedAt, note: s.note };
};
/** Kiểm 7 field theo quy tắc BE: trả { bad: [...] } (400), { dup: true } (409 SKU_EXISTS) hoặc { sku } đã chuẩn hóa (cắt trắng, viết HOA). */
const checkDetails = (b, selfId) => {
  const bad = [];
  if (b.sku != null && String(b.sku).trim().length > 40) bad.push("sku: tối đa 40 ký tự");
  if (b.supplier != null && String(b.supplier).length > 255) bad.push("supplier: tối đa 255 ký tự");
  if (b.costPrice != null && !(b.costPrice >= 0)) bad.push("costPrice: không được âm");
  if (b.binLocation != null && String(b.binLocation).length > 64) bad.push("binLocation: tối đa 64 ký tự");
  if (b.reorderQuantity != null && !(b.reorderQuantity >= 0)) bad.push("reorderQuantity: không được âm");
  if (b.note != null && String(b.note).length > 500) bad.push("note: tối đa 500 ký tự");
  if (bad.length) return { bad };
  const sku = b.sku?.trim() ? b.sku.trim().toUpperCase() : null;
  if (sku && [...STOCK.entries()].some(([id, x]) => id !== selfId && x.sku === sku)) return { dup: true };
  return { sku };
};

const SUPPLIERS = [{ id: uuid(), name: "Nhà sách Mẫu", phone: "0281234567", email: null, address: null, note: null, active: true }];
const RECEIPTS = [];
let receiptSeq = 0;
const ORDERS = [];
const ORDER_PII = new Map();
const ORDER_BY_REQ = new Map();
/** Lệnh thanh toán QR: id -> { intent, order, need: Map<titleId, qty> }. Sandbox bật mặc định; thân POS có customerNote "QR_SHORT_TTL" thì hạn 4 giây. */
const INTENTS = new Map();
let intentSeq = 0;
const qrPayloadOf = (ref, amount) => `00020101021238MOCK-VIETQR-${ref}-${amount}6304ABCD`;
/** Đổi PENDING quá hạn thành EXPIRED và nhả hàng giữ (BE báo EXPIRED ngay khi quá hạn). */
const settleIntent = (rec) => {
  if (rec.intent.status === "PENDING" && Date.parse(rec.intent.expiresAt) <= Date.now()) {
    rec.intent.status = "EXPIRED";
    release(rec, "hết hạn thanh toán QR");
  }
  return rec.intent;
};
const release = (rec, reason) => {
  for (const [tid, q] of rec.need) {
    const s = STOCK.get(tid);
    s.reserved -= q;
    s.ledger.push(entry(tid, "RELEASE", 0, reason, { refType: "ORDER", refId: rec.order.id, deltaReserved: -q }));
  }
  Object.assign(rec.order, { status: "CANCELLED", cancelledAt: now(), cancelReason: reason, version: rec.order.version + 1 });
};
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
    const c = checkDetails(body, b.id);
    if (c.bad) return invalid(...c.bad);
    if (c.dup) return err(409, "SKU_EXISTS", "Mã SKU đã tồn tại");
    STOCK.set(b.id, {
      onHand: 0, reserved: 0, sellingPrice: body.sellingPrice ?? null, lowStockThreshold: body.lowStockThreshold ?? null, sku: c.sku,
      supplier: body.supplier?.trim() || null, costPrice: body.costPrice ?? null, binLocation: body.binLocation?.trim() || null,
      reorderQuantity: body.reorderQuantity ?? null, lastRestockedAt: body.lastRestockedAt ?? null, note: body.note?.trim() || null, ledger: [],
    });
    return send(201, stockView(b.id)), true;
  }
  if ((m = p.match(/^\/api\/sales\/stock-items\/([^/]+)(?:\/(price|ledger|details))?$/))) {
    const [, id, sub] = m;
    if (method === "GET" && sub === "ledger") {
      if (!requireKey(K.STOCK_LEDGER)) return true;
      if (!STOCK.has(id)) return err(404, "STOCK_ITEM_NOT_FOUND", "Không có mặt hàng");
      return send(200, page([...STOCK.get(id).ledger].reverse(), sp)), true;
    }
    if (sub === "details") {
      if (!requireKey(method === "GET" ? K.STOCK_DETAILS : K.STOCK_DETAILS_UPDATE)) return true;
      if (!STOCK.has(id)) return err(404, "STOCK_ITEM_NOT_FOUND", "Không có mặt hàng");
      if (method === "GET") return send(200, detailsView(id)), true;
      if (method === "PUT") {
        const c = checkDetails(body, id);
        if (c.bad) return invalid(...c.bad);
        if (c.dup) return err(409, "SKU_EXISTS", "Mã SKU đã tồn tại");
        const s = STOCK.get(id);
        // Thay toàn bộ: vắng là xóa; riêng lastRestockedAt vắng thì giữ.
        Object.assign(s, {
          sku: c.sku, supplier: body.supplier?.trim() || null, costPrice: body.costPrice ?? null, binLocation: body.binLocation?.trim() || null,
          reorderQuantity: body.reorderQuantity ?? null, note: body.note?.trim() || null, lastRestockedAt: body.lastRestockedAt ?? s.lastRestockedAt,
        });
        return send(200, detailsView(id)), true;
      }
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
    if (!["CASH", "BANK_TRANSFER", "CARD", "QR", "MOMO"].includes(body.paymentMethod)) return err(400, "INVALID_REQUEST", "Hình thức thanh toán không hợp lệ");
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
    const isQr = body.paymentMethod === "QR" || body.paymentMethod === "MOMO";
    const isMomo = body.paymentMethod === "MOMO";
    if (isQr && body.exchangeOfReturnId) return err(400, "INVALID_REQUEST", "Đơn QR không đi cùng đổi hàng");
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
      customerNote: body.customerNote?.trim() || null, staffNote: null, expectedDeliveryDate: null,
      _orderDiscount: orderDisc, _taxable: taxable,
    };
    if (isQr && o.grandTotal <= 0) return err(400, "INVALID_REQUEST", "Đơn QR phải có tổng tiền lớn hơn 0");
    // Hai bước cho mọi hình thức: đơn AWAITING_PAYMENT + lệnh thanh toán (QR: SIMULATED; còn lại: MANUAL). Tổng 0đ thì hoàn tất ngay.
    if (o.grandTotal > 0) {
      const ref = `LMS${String(++intentSeq).padStart(4, "0")}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const ttl = body.customerNote === "QR_SHORT_TTL" ? 4000 : 10 * 60 * 1000;
      Object.assign(o, { status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", completedAt: null, paidAt: null });
      const intent = {
        id: uuid(), orderId: id, reference: ref, amount: o.grandTotal, status: "PENDING", provider: isMomo ? "MOMO" : isQr ? "SIMULATED" : "MANUAL", qrPayload: isQr ? qrPayloadOf(ref, o.grandTotal) : null,
        expiresAt: new Date(Date.now() + ttl).toISOString(), paidAt: null, createdAt: now(),
      };
      for (const [tid, q] of need) {
        const s = STOCK.get(tid);
        s.reserved += q;
        s.ledger.push(entry(tid, "RESERVE", 0, null, { refType: "ORDER", refId: id, deltaReserved: q }));
      }
      INTENTS.set(intent.id, { intent, order: o, need });
      if (body.walkIn) ORDER_PII.set(id, { name: body.walkIn.name ?? null, phone: body.walkIn.phone ?? null });
      ORDERS.unshift(o);
      ORDER_BY_REQ.set(body.clientRequestId, o);
      return send(201, { ...orderView(o), paymentIntent: intent }), true;
    }
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

  // ---- Thanh toán QR (cổng giả lập) ----
  if ((m = p.match(/^\/api\/sales\/payments\/intents\/([^/]+)(?:\/(cancel|simulate-paid|confirm))?$/))) {
    const sub = m[2];
    if (sub ? method !== "POST" : method !== "GET") return false;
    if (!requireKey(!sub ? K.PI_GET : sub === "cancel" ? K.PI_CANCEL : sub === "confirm" ? K.PI_CONFIRM : K.PI_SIMULATE)) return true;
    const rec = INTENTS.get(m[1]);
    if (!rec) return err(404, "PAYMENT_INTENT_NOT_FOUND", "Không có lệnh thanh toán");
    const intent = settleIntent(rec);
    if (!sub) return send(200, intent), true;
    if (sub === "cancel") {
      if (intent.status === "CANCELLED") return send(200, intent), true;
      if (intent.status !== "PENDING") return err(409, "PAYMENT_INTENT_STATE_CONFLICT", "Lệnh không còn chờ thanh toán");
      intent.status = "CANCELLED";
      release(rec, "thu ngân hủy thanh toán QR");
      return send(200, intent), true;
    }
    if (sub === "confirm") {
      if (intent.provider !== "MANUAL") return err(409, "PAYMENT_NOT_MANUAL", "Lệnh QR không xác nhận tay");
      if (intent.status === "PAID") return err(409, "PAYMENT_INTENT_STATE_CONFLICT", "Lệnh đã thanh toán");
      if (intent.status !== "PENDING") return err(409, "PAYMENT_INTENT_STATE_CONFLICT", "Lệnh không còn chờ thanh toán");
      if (rec.order.paymentMethod === "CASH") {
        if (typeof body.tenderedAmount !== "number" || body.tenderedAmount < intent.amount) return err(400, "PAYMENT_AMOUNT_MISMATCH", "Tiền khách đưa chưa đủ");
        intent.tenderedAmount = body.tenderedAmount;
        intent.changeDue = body.tenderedAmount - intent.amount;
      } else {
        if (!body.transactionRef?.trim()) return invalid("transactionRef: không được trống");
        intent.transactionRef = body.transactionRef.trim();
      }
      intent.status = "PAID";
      intent.paidAt = now();
      for (const [tid, q] of rec.need) {
        const st = STOCK.get(tid);
        st.reserved -= q;
        st.onHand -= q;
        st.ledger.push(entry(tid, "SALE", -q, null, { refType: "ORDER", refId: rec.order.id, deltaReserved: -q }));
      }
    Object.assign(rec.order, { status: "COMPLETED", paymentStatus: "PAID", paidAt: intent.paidAt, completedAt: intent.paidAt, version: rec.order.version + 1 });
      return send(200, intent), true;
    }
    if (intent.provider !== "SIMULATED") return err(409, "PAYMENT_NOT_SIMULATED", "Lệnh thu tay không giả lập");
    if (process.env.MOCK_PAYMENT_SANDBOX === "off") return err(404, "PAYMENT_SANDBOX_DISABLED", "Cổng giả lập đang tắt");
    if (intent.status === "PAID") return send(200, intent), true;
    if (intent.status !== "PENDING") return err(409, intent.status === "EXPIRED" ? "PAYMENT_INTENT_EXPIRED" : "PAYMENT_INTENT_CANCELLED", "Lệnh không còn chờ thanh toán");
    intent.status = "PAID";
    intent.paidAt = now();
    for (const [tid, q] of rec.need) {
      const s = STOCK.get(tid);
      s.reserved -= q;
      s.onHand -= q;
      s.ledger.push(entry(tid, "SALE", -q, null, { refType: "ORDER", refId: rec.order.id, deltaReserved: -q }));
    }
    Object.assign(rec.order, { status: "COMPLETED", paymentStatus: "PAID", paidAt: intent.paidAt, completedAt: intent.paidAt, version: rec.order.version + 1 });
    return send(200, intent), true;
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
  if ((m = p.match(/^\/api\/sales\/orders\/([^/]+)\/notes$/)) && (method === "GET" || method === "PUT")) {
    if (!requireKey(method === "GET" ? K.ORDER_NOTES : K.ORDER_NOTES_UPDATE)) return true;
    const o = ORDERS.find((x) => x.id === m[1]);
    if (!o) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
    if (method === "PUT") {
      if (body.version != null && body.version !== o.version) return err(409, "ORDER_STATE_CONFLICT", "Đơn vừa được người khác sửa");
      if (body.expectedDeliveryDate && !["PICKUP", "DELIVERY"].includes(o.fulfilment)) return err(400, "INVALID_REQUEST", "Ngày giao dự kiến chỉ áp dụng cho đơn nhận tại cửa hàng hoặc giao tận nơi");
      if (body.staffNote != null && String(body.staffNote).length > 500) return invalid("staffNote: tối đa 500 ký tự");
      o.staffNote = body.staffNote?.trim() || null;
      o.expectedDeliveryDate = body.expectedDeliveryDate || null;
      o.version += 1;
    }
    return send(200, { id: o.id, customerNote: o.customerNote ?? null, staffNote: o.staffNote ?? null, expectedDeliveryDate: o.expectedDeliveryDate ?? null, version: o.version }), true;
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
