// Mock hóa đơn VAT nội bộ (ADR-0030 gói A): /api/sales/invoices/**, /api/sales/orders/{id}/invoice(-request), /api/sales/invoice-settings
// theo docs/api/sales-invoices.md của repo BE. Trạng thái trong bộ nhớ, dùng chung 2 worker và test chạy song song:
// mỗi test dựng đơn riêng (POS + xác nhận thu tiền mặt) và không giả định số lượng hóa đơn.
// Cấu hình người bán theo tenant: tenant của `invmgr`/`invcashier` đã đủ; tenant của `invsetmgr` chưa cấu hình (dành cho test màn cấu hình).
// Chỉ-mock: POST /api/sales/__mock/invoices/{id}/adjustment dựng hóa đơn điều chỉnh (BE sinh khi trả hàng), không kiểm khóa.
import { USERS } from "./data.mjs";
import { findOrderForMock } from "./sales.mjs";

const T_MAIN = "31111111-1111-4111-8111-111111111111";
const T_SET = "32222222-2222-4222-8222-222222222222";
const T_NOSET = "33333333-3333-4333-8333-333333333333";

const C = "InvoiceController";
const K = {
  SEARCH: `${C}/search`,
  GET: `${C}/get`,
  PRINT: `${C}/print`,
  ISSUE: `${C}/issue`,
  CANCEL: `${C}/cancel`,
  REPLACE: `${C}/replace`,
  REQ_GET: "InvoiceRequestController/get",
  REQ_SAVE: "InvoiceRequestController/save",
  SET_GET: "InvoiceSettingsController/get",
  SET_UPDATE: "InvoiceSettingsController/update",
};
const ORDER_VIEW = "SalesOrderController/get";
const ORDER_SEARCH = "SalesOrderController/search";
const BASE = ["PosOrderController/create", ORDER_SEARCH, ORDER_VIEW];

const mk = (id, perms, tenantId = T_MAIN) => ({
  id: `${id}-id`, roles: ["SALES_STAFF"], modules: ["LENDING", "SALES"], password: `${id[0].toUpperCase()}${id.slice(1)}@12345`,
  permissions: perms, tenantId, tenants: [tenantId],
});
// Quản lý cửa hàng: mọi khóa hóa đơn. Thu ngân: xuất, xem, in, yêu cầu; KHÔNG hủy/thay thế/cấu hình.
USERS.invmgr = mk("invmgr", [...BASE, ...Object.values(K)]);
USERS.invcashier = mk("invcashier", [...BASE, K.SEARCH, K.GET, K.PRINT, K.ISSUE, K.REQ_GET, K.REQ_SAVE]);
// Chỉ xem đơn: không có khóa hóa đơn nào.
USERS.invnone = mk("invnone", [ORDER_SEARCH, ORDER_VIEW]);
// Chỉ có khóa xuất hóa đơn (không có khóa search/get/print): không có danh sách hóa đơn của đơn.
USERS.invissuer = mk("invissuer", [ORDER_SEARCH, ORDER_VIEW, K.ISSUE, K.REQ_SAVE]);
// Tenant KHÔNG BAO GIỜ được cấu hình người bán: xuất hóa đơn báo INVOICE_SETTINGS_INCOMPLETE.
USERS.invnoset = mk("invnoset", [ORDER_SEARCH, ORDER_VIEW, K.ISSUE, K.REQ_SAVE, K.SEARCH], T_NOSET);
// Cấu hình hóa đơn của một tenant riêng chưa cấu hình.
USERS.invsetmgr = mk("invsetmgr", [K.SET_GET, K.SET_UPDATE], T_SET);
USERS.invsetview = mk("invsetview", [K.SET_GET], T_SET);

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const NOTICE = "Hóa đơn nội bộ, không thay thế hóa đơn điện tử";
const NO_BUYER = "Người mua không lấy hóa đơn";
const BUYER_TAX = /^(\d{10}|\d{10}-\d{3}|\d{12})$/;
const SELLER_TAX = /^(\d{10}|\d{10}-\d{3})$/;

/** tenantId -> cấu hình */
const SETTINGS = new Map([
  [T_MAIN, { sellerLegalName: "Hiệu sách Mẫu", sellerTaxCode: "0123456789", sellerAddress: "1 Lê Lợi, Hà Nội", sellerPhone: null, sellerEmail: null, templateCode: "1", series: "C26TAA", autoIssueOnCompletion: false, version: 1, updatedAt: now() }],
]);
const defaults = () => ({ sellerLegalName: null, sellerTaxCode: null, sellerAddress: null, sellerPhone: null, sellerEmail: null, templateCode: null, series: null, autoIssueOnCompletion: false, version: 0, updatedAt: null });
const settingsOf = (t) => SETTINGS.get(t) ?? defaults();
const complete = (s) => !!(s.sellerLegalName && s.sellerTaxCode && s.sellerAddress && s.templateCode && s.series);
const settingsView = (t) => ({ ...settingsOf(t), complete: complete(settingsOf(t)) });

/** @type {any[]} */
const INVOICES = [];
/** orderId -> yêu cầu xuất hóa đơn */
const REQUESTS = new Map();
const COUNTERS = new Map();
const nextNo = (tenantId, tpl, series) => {
  const k = `${tenantId}:${tpl}:${series}`;
  const n = (COUNTERS.get(k) ?? 0) + 1;
  COUNTERS.set(k, n);
  return n;
};

const buyerOf = (req) =>
  req ? { name: req.buyerName, company: req.buyerCompany, taxCode: req.buyerTaxCode, address: req.buyerAddress, email: req.buyerEmail } : { name: NO_BUYER, company: null, taxCode: null, address: null, email: null };

const linesOf = (o) =>
  o.lines.map((l, i) => ({
    lineNo: i + 1, itemName: l.titleName, isbn: l.isbn ?? null, unit: "cuốn", quantity: l.quantity, unitPrice: l.unitPrice,
    discount: (l.lineDiscount ?? 0) + (l.allocatedOrderDiscount ?? 0), amountBeforeVat: l.lineTotal - l.vatAmount, vatRateBps: o.vatRateBps, vatAmount: l.vatAmount, lineTotal: l.lineTotal,
  }));

function issue(tenantId, o, buyer, extra = {}) {
  const s = settingsOf(tenantId);
  const no = nextNo(tenantId, s.templateCode, s.series);
  const inv = {
    id: uuid(), tenantId, kind: "ORIGINAL", status: "ISSUED", orderId: o.id, orderNo: o.orderNo, returnId: null, originalInvoiceId: null, originalInvoiceNumber: null,
    templateCode: s.templateCode, series: s.series, fiscalYear: new Date().getFullYear(), invoiceNo: no, invoiceNumber: String(no).padStart(8, "0"),
    issuedAt: now(), issuedBy: "mock", cancelledAt: null, cancelledBy: null, cancelReason: null,
    seller: { legalName: s.sellerLegalName, taxCode: s.sellerTaxCode, address: s.sellerAddress, phone: s.sellerPhone, email: s.sellerEmail },
    buyer, currency: "VND", pricesIncludeVat: o.pricesIncludeVat, paymentMethod: o.paymentMethod, totalBeforeVat: o.grandTotal - o.vatTotal, vatTotal: o.vatTotal, grandTotal: o.grandTotal,
    amountInWords: "Một số tiền (mock)", issuer: "INTERNAL", externalLookupCode: null, createdAt: now(), version: 0, lines: linesOf(o), clientRequestId: null, ...extra,
  };
  INVOICES.unshift(inv);
  return inv;
}

const view = (inv) => {
  const { tenantId: _t, clientRequestId: _c, ...rest } = inv;
  const adjustments = INVOICES.filter((a) => a.kind === "ADJUSTMENT_DECREASE" && a.originalInvoiceId === inv.id && a.status === "ISSUED").map((a) => ({
    id: a.id, invoiceNumber: a.invoiceNumber, grandTotal: a.grandTotal, issuedAt: a.issuedAt, returnId: a.returnId,
  }));
  return { ...rest, adjustments, notice: NOTICE };
};
const summary = (i) => ({
  id: i.id, kind: i.kind, status: i.status, orderId: i.orderId, orderNo: i.orderNo, originalInvoiceId: i.originalInvoiceId, templateCode: i.templateCode, series: i.series,
  fiscalYear: i.fiscalYear, invoiceNo: i.invoiceNo, invoiceNumber: i.invoiceNumber, buyerName: i.buyer.name, buyerCompany: i.buyer.company, buyerTaxCode: i.buyer.taxCode,
  grandTotal: i.grandTotal, issuedAt: i.issuedAt, createdAt: i.createdAt,
});
const effective = (tenantId, orderId) => INVOICES.find((i) => i.tenantId === tenantId && i.orderId === orderId && i.kind !== "ADJUSTMENT_DECREASE" && i.status === "ISSUED");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Bản in HTML như BE: dữ liệu đã thoát HTML, có CSP trong meta. Buyer chứa "XSS_PROBE": chèn thêm script độc hại (chỉ để test FE không chạy được mã trong khung). */
function printHtml(i) {
  const probe = /XSS_PROBE/.test(i.buyer.name ?? "")
    ? "<script>try{window.top.document.body.setAttribute('data-pwned','1')}catch(e){}document.title='PWNED'</script>"
    : "";
  const title = { ORIGINAL: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG", REPLACEMENT: "HÓA ĐƠN THAY THẾ", ADJUSTMENT_DECREASE: "HÓA ĐƠN ĐIỀU CHỈNH GIẢM" }[i.kind];
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Hóa đơn ${esc(i.invoiceNumber)}</title></head><body>
<h1>${title}</h1>${i.status === "CANCELLED" ? "<h2>HÓA ĐƠN ĐÃ HỦY</h2>" : ""}
<p>Số hóa đơn: <b>${esc(i.invoiceNumber)}</b> - Mẫu ${esc(i.templateCode)} - Ký hiệu ${esc(i.series)}</p>
<p>Người bán: ${esc(i.seller.legalName)} (MST ${esc(i.seller.taxCode)})</p>
<p>Người mua: ${esc(i.buyer.company || i.buyer.name)} ${esc(i.buyer.taxCode)}</p>
<p>Tổng thanh toán: ${i.grandTotal}</p><p>${NOTICE}</p>${probe}</body></html>`;
}

function validBuyer(b, err) {
  const name = (b?.name ?? "").trim();
  const company = (b?.company ?? "").trim();
  const tax = (b?.taxCode ?? "").trim();
  if (tax && !BUYER_TAX.test(tax)) return err(400, "INVALID_TAX_CODE", "Mã số thuế sai định dạng");
  if (tax && (!company || !(b?.address ?? "").trim())) return err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["company: bắt buộc khi có mã số thuế", "address: bắt buộc khi có mã số thuế"]);
  if (!name && !company) return err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["buyer: cần tên hoặc đơn vị"]);
  return null;
}

const page = (items, sp) => {
  const p = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
  return { items: items.slice(p * size, p * size + size), total: items.length, page: p, size };
};

export function handle({ method, url, body, caller, send, sendText, requireKey }) {
  const p = url.pathname;
  if (!p.startsWith("/api/sales/")) return false;
  const sp = url.searchParams;
  const tenantId = caller ? USERS[caller]?.tenantId : undefined;
  let m;
  const err = (status, code, message, details = []) => (send(status, { code, message, details, timestamp: now() }), true);

  // ---- Chỉ-mock: dựng hóa đơn điều chỉnh giảm do trả hàng ----
  if ((m = p.match(/^\/api\/sales\/__mock\/invoices\/([^/]+)\/adjustment$/)) && method === "POST") {
    const orig = INVOICES.find((i) => i.id === m[1]);
    if (!orig) return err(404, "INVOICE_NOT_FOUND", "Không có hóa đơn");
    const no = nextNo(orig.tenantId, orig.templateCode, orig.series);
    const adj = { ...orig, id: uuid(), kind: "ADJUSTMENT_DECREASE", originalInvoiceId: orig.id, originalInvoiceNumber: orig.invoiceNumber, returnId: uuid(), invoiceNo: no, invoiceNumber: String(no).padStart(8, "0"), grandTotal: body.amount ?? 10000, vatTotal: 0, totalBeforeVat: body.amount ?? 10000, issuedAt: now(), createdAt: now(), lines: orig.lines.slice(0, 1) };
    INVOICES.unshift(adj);
    return send(201, view(adj)), true;
  }

  // ---- Cấu hình hóa đơn ----
  if (p === "/api/sales/invoice-settings") {
    if (method === "GET") {
      if (!requireKey(K.SET_GET)) return true;
      return send(200, settingsView(tenantId)), true;
    }
    if (method === "PUT") {
      if (!requireKey(K.SET_UPDATE)) return true;
      const cur = settingsOf(tenantId);
      const v = body ?? {};
      const bad = [];
      if (!String(v.sellerLegalName ?? "").trim()) bad.push("sellerLegalName: bắt buộc");
      if (!String(v.sellerAddress ?? "").trim()) bad.push("sellerAddress: bắt buộc");
      if (bad.length) return err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", bad);
      if (!SELLER_TAX.test(String(v.sellerTaxCode ?? "").trim())) return err(400, "INVALID_TAX_CODE", "MST người bán sai định dạng");
      if (!/^[0-9A-Za-z/]{1,6}$/.test(String(v.templateCode ?? "")) || !/^[0-9A-Za-z/]{1,8}$/.test(String(v.series ?? ""))) return err(400, "INVALID_SETTINGS", "Mẫu số hoặc ký hiệu không hợp lệ");
      if (v.version !== cur.version) return err(409, "SETTINGS_VERSION_CONFLICT", "Cấu hình đã đổi");
      SETTINGS.set(tenantId, {
        sellerLegalName: v.sellerLegalName.trim(), sellerTaxCode: v.sellerTaxCode.trim(), sellerAddress: v.sellerAddress.trim(), sellerPhone: v.sellerPhone ?? null,
        sellerEmail: v.sellerEmail ?? null, templateCode: v.templateCode, series: v.series, autoIssueOnCompletion: !!v.autoIssueOnCompletion, version: cur.version + 1, updatedAt: now(),
      });
      return send(200, settingsView(tenantId)), true;
    }
    return false;
  }

  // ---- Yêu cầu xuất hóa đơn của đơn ----
  if ((m = p.match(/^\/api\/sales\/orders\/([^/]+)\/invoice-request$/))) {
    const reqView = (r) => ({ id: r.id, orderId: r.orderId, buyerName: r.buyerName, buyerCompany: r.buyerCompany, buyerTaxCode: r.buyerTaxCode, buyerAddress: r.buyerAddress, buyerEmail: r.buyerEmail, source: r.source, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, version: r.version });
    if (method === "GET") {
      if (!requireKey(K.REQ_GET)) return true;
      if (!findOrderForMock(m[1])) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
      const r = REQUESTS.get(m[1]);
      return r ? (send(200, reqView(r)), true) : err(404, "INVOICE_NOT_FOUND", "Đơn chưa có yêu cầu xuất hóa đơn");
    }
    if (method === "PUT") {
      if (!requireKey(K.REQ_SAVE)) return true;
      const o = findOrderForMock(m[1]);
      if (!o) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
      if (o.status === "CANCELLED") return err(409, "ORDER_NOT_INVOICEABLE", "Đơn đã hủy");
      const cur = REQUESTS.get(m[1]);
      if (cur?.status === "FULFILLED") return err(409, "INVOICE_ALREADY_EXISTS", "Đã có hóa đơn");
      if (validBuyer(body.buyer, err)) return true;
      const b = body.buyer;
      const r = { id: cur?.id ?? uuid(), orderId: m[1], buyerName: b.name?.trim() || null, buyerCompany: b.company?.trim() || null, buyerTaxCode: b.taxCode?.trim() || null, buyerAddress: b.address?.trim() || null, buyerEmail: b.email?.trim() || null, source: cur?.source ?? "POS", status: "OPEN", createdAt: cur?.createdAt ?? now(), updatedAt: now(), version: (cur?.version ?? -1) + 1 };
      REQUESTS.set(m[1], r);
      return send(200, reqView(r)), true;
    }
    return false;
  }

  // ---- Phát hành hóa đơn cho đơn ----
  if ((m = p.match(/^\/api\/sales\/orders\/([^/]+)\/invoice$/)) && method === "POST") {
    if (!requireKey(K.ISSUE)) return true;
    const o = findOrderForMock(m[1]);
    if (!o) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
    if (!body.clientRequestId) return err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["clientRequestId: bắt buộc"]);
    const same = INVOICES.find((i) => i.tenantId === tenantId && i.clientRequestId === body.clientRequestId);
    if (same) return same.orderId === o.id ? (send(201, view(same)), true) : err(409, "CLIENT_REQUEST_CONFLICT", "Mã yêu cầu đã dùng");
    if (!complete(settingsOf(tenantId))) return err(409, "INVOICE_SETTINGS_INCOMPLETE", "Chưa cấu hình người bán");
    if (o.status !== "COMPLETED" || o.paymentStatus !== "PAID") return err(409, "ORDER_NOT_INVOICEABLE", "Đơn chưa hoàn tất và đã thu");
    if (effective(tenantId, o.id)) return err(409, "INVOICE_ALREADY_EXISTS", "Đơn đã có hóa đơn");
    const req = REQUESTS.get(o.id);
    const inv = issue(tenantId, o, buyerOf(req?.status === "OPEN" ? req : null), { clientRequestId: body.clientRequestId });
    if (req?.status === "OPEN") req.status = "FULFILLED";
    return send(201, view(inv)), true;
  }

  // ---- Hóa đơn ----
  if (p === "/api/sales/invoices" && method === "GET") {
    if (!requireKey(K.SEARCH)) return true;
    const kw = (sp.get("keyword") ?? "").trim().toLowerCase();
    const items = INVOICES.filter(
      (i) =>
        i.tenantId === tenantId &&
        (!sp.get("status") || i.status === sp.get("status")) &&
        (!sp.get("kind") || i.kind === sp.get("kind")) &&
        (!sp.get("from") || i.createdAt >= sp.get("from")) &&
        (!sp.get("to") || i.createdAt < sp.get("to")) &&
        (!kw || [i.orderNo, i.invoiceNumber, i.buyer.name, i.buyer.company, i.buyer.taxCode].some((x) => String(x ?? "").toLowerCase().includes(kw))),
    );
    return send(200, page(items.map(summary), sp)), true;
  }
  if ((m = p.match(/^\/api\/sales\/invoices\/([^/]+)(?:\/(print|cancellation|replacement))?$/))) {
    const sub = m[2];
    const need = !sub ? K.GET : sub === "print" ? K.PRINT : sub === "cancellation" ? K.CANCEL : K.REPLACE;
    if ((sub === "print" || !sub ? method !== "GET" : method !== "POST")) return false;
    if (!requireKey(need)) return true;
    const inv = INVOICES.find((i) => i.id === m[1] && i.tenantId === tenantId);
    if (!inv) return err(404, "INVOICE_NOT_FOUND", "Không có hóa đơn");
    if (!sub) return send(200, view(inv)), true;
    if (sub === "print") return sendText(200, printHtml(inv)), true;
    const hasAdj = INVOICES.some((a) => a.kind === "ADJUSTMENT_DECREASE" && a.originalInvoiceId === inv.id && a.status === "ISSUED");
    const reason = String(body.reason ?? "").trim();
    if (sub === "cancellation") {
      if (!reason) return err(400, "CANCEL_REASON_REQUIRED", "Thiếu lý do hủy");
      if (inv.status !== "ISSUED" || inv.kind === "ADJUSTMENT_DECREASE") return err(409, "INVOICE_STATE_CONFLICT", "Không hủy được");
      if (hasAdj) return err(409, "INVOICE_HAS_ADJUSTMENTS", "Đã có điều chỉnh");
      Object.assign(inv, { status: "CANCELLED", cancelledAt: now(), cancelledBy: "mock", cancelReason: reason, version: inv.version + 1 });
      return send(200, view(inv)), true;
    }
    // replacement
    if (!reason) return err(400, "CANCEL_REASON_REQUIRED", "Thiếu lý do");
    if (inv.status !== "ISSUED" || inv.kind === "ADJUSTMENT_DECREASE") return err(409, "INVOICE_STATE_CONFLICT", "Không thay thế được");
    if (hasAdj) return err(409, "INVOICE_HAS_ADJUSTMENTS", "Đã có điều chỉnh");
    if (!body.clientRequestId) return err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["clientRequestId: bắt buộc"]);
    if (!complete(settingsOf(tenantId))) return err(409, "INVOICE_SETTINGS_INCOMPLETE", "Chưa cấu hình người bán");
    if (body.buyer && validBuyer(body.buyer, err)) return true;
    Object.assign(inv, { status: "CANCELLED", cancelledAt: now(), cancelledBy: "mock", cancelReason: reason, version: inv.version + 1 });
    const o = findOrderForMock(inv.orderId);
    const b = body.buyer
      ? { name: body.buyer.name ?? null, company: body.buyer.company ?? null, taxCode: body.buyer.taxCode ?? null, address: body.buyer.address ?? null, email: body.buyer.email ?? null }
      : inv.buyer;
    const rep = issue(tenantId, o, b, { kind: "REPLACEMENT", originalInvoiceId: inv.id, originalInvoiceNumber: inv.invoiceNumber, clientRequestId: body.clientRequestId });
    return send(201, view(rep)), true;
  }
  return false;
}
