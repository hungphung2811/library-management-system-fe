// Mock chốt ca thu ngân (ADR-0030 gói B): /api/sales/shifts/**, /api/sales/shift-settings theo docs/api/sales-shifts.md của repo BE.
// Trạng thái trong bộ nhớ, dùng chung 2 worker và test chạy song song, nên mỗi kịch bản dùng người dùng riêng:
//  - Tenant T_SHIFT (ngưỡng chênh lệch 5.000đ, cờ chặn bán TẮT): `shiftmgr` (quản lý) và `shiftc1..shiftc8` (thu ngân, mỗi test một người
//    vì mỗi thu ngân chỉ có một ca mở). Cờ chặn bán và ngưỡng ở tenant này KHÔNG test nào được đổi.
//  - Tenant T_FLAG (một test duy nhất đổi cấu hình): `shiftflagm` (quản lý) và `shiftflagc` (thu ngân).
// Tenant mặc định (seller, cashier, salesadmin...) không có khóa ca nên POS cũ không thấy gì mới và không bị chặn.
// Chỉ-mock (không kiểm khóa): POST /api/sales/__mock/shifts/{id}/payments {method, amount, refund?, afterClose?} ghi khoản thu/hoàn vào ca;
//   POST /api/sales/__mock/shifts/{id}/pending {count} đặt số lệnh thu tay còn chờ (chặn đóng ca).
import { USERS } from "./data.mjs";

const T_SHIFT = "41111111-1111-4111-8111-111111111111";
const T_FLAG = "42222222-2222-4222-8222-222222222222";

const M = "CashierShiftController";
const A = "CashierShiftAdminController";
const K = {
  OPEN: `${M}/open`,
  CURRENT: `${M}/current`,
  MINE: `${M}/mine`,
  GET_MINE: `${M}/getMine`,
  CLOSE: `${M}/close`,
  SEARCH: `${A}/search`,
  GET: `${A}/get`,
  CLOSE_ON_BEHALF: `${A}/closeOnBehalf`,
  REOPEN: `${A}/reopen`,
  APPROVE: `${A}/approveVariance`,
  SET_GET: "CashierShiftSettingsController/get",
  SET_UPDATE: "CashierShiftSettingsController/update",
};
const CASHIER_KEYS = [K.OPEN, K.CURRENT, K.MINE, K.GET_MINE, K.CLOSE];
const POS_KEYS = [
  "PosOrderController/create", "StockItemController/get", "SalesOrderController/receipt", "TitleController/search",
  "PaymentIntentController/get", "PaymentIntentController/cancel", "PaymentIntentController/confirm", "PaymentIntentController/simulatePaid",
];
const mk = (id, perms, tenantId) => ({
  id: `${id}-id`, roles: ["CASHIER"], modules: ["LENDING", "SALES"], password: `${id[0].toUpperCase()}${id.slice(1)}@12345`, permissions: perms, tenantId, tenants: [tenantId],
});
USERS.shiftmgr = mk("shiftmgr", [...Object.values(K), ...POS_KEYS, "SalesOrderController/search", "SalesOrderController/get"], T_SHIFT);
for (let i = 1; i <= 8; i++) USERS[`shiftc${i}`] = mk(`shiftc${i}`, [...CASHIER_KEYS, ...POS_KEYS], T_SHIFT);
USERS.shiftflagm = mk("shiftflagm", [...Object.values(K), ...POS_KEYS], T_FLAG);
USERS.shiftflagc = mk("shiftflagc", [...CASHIER_KEYS, ...POS_KEYS], T_FLAG);
// Chỉ có khóa "của tôi" xem ca đang mở và danh sách ca của mình, không có khóa mở/đóng.
USERS.shiftview = mk("shiftview", [K.CURRENT, K.MINE, K.GET_MINE], T_SHIFT);

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const METHODS = ["CASH", "CARD", "BANK_TRANSFER", "QR", "MOMO", "SEPAY"];

/** tenantId -> cấu hình ca */
const SETTINGS = new Map([
  [T_SHIFT, { requireOpenShiftForPos: false, varianceThreshold: 5000, version: 1, updatedAt: now() }],
  [T_FLAG, { requireOpenShiftForPos: false, varianceThreshold: 0, version: 0, updatedAt: null }],
]);
const settingsOf = (t) => SETTINGS.get(t) ?? { requireOpenShiftForPos: false, varianceThreshold: 0, version: 0, updatedAt: null };

/** @type {any[]} */
const SHIFTS = [];
const seqOf = new Map();
const nextNo = (t) => {
  const n = (seqOf.get(t) ?? 0) + 1;
  seqOf.set(t, n);
  return `CA-${String(n).padStart(6, "0")}`;
};

const phaseOf = (s) => (s.status === "OPEN" ? (s.reopenCount > 0 ? "REOPENED" : "OPEN") : s.varianceStatus === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "CLOSED");
const view = (s) => ({
  id: s.id, shiftNo: s.shiftNo, cashierUserId: s.cashierUserId, registerLabel: s.registerLabel, status: s.status, phase: phaseOf(s), openedAt: s.openedAt, openingFloat: s.openingFloat,
  closedAt: s.closedAt, closedBy: s.closedBy, countedCash: s.countedCash, expectedCash: s.expectedCash, variance: s.variance, varianceReason: s.varianceReason,
  varianceStatus: s.varianceStatus, approvedBy: s.approvedBy, approvedAt: s.approvedAt, approvalNote: s.approvalNote, reopenCount: s.reopenCount, version: s.version,
});
/** Tiền mặt dự kiến: đầu ca + thu tiền mặt - hoàn tiền mặt, chỉ phần phát sinh trước thời điểm chốt (không tính `afterClose`). */
const expectedOf = (s) => s.openingFloat + s.payments.filter((p) => p.method === "CASH" && !p.afterClose).reduce((a, p) => a + (p.refund ? -p.amount : p.amount), 0);
const report = (s) => {
  const methods = METHODS.map((method) => {
    const rows = s.payments.filter((p) => p.method === method);
    const sum = (f) => rows.filter(f).reduce((a, p) => a + p.amount, 0);
    const cnt = (f) => rows.filter(f).length;
    const collected = sum((p) => !p.refund);
    const refunded = sum((p) => p.refund);
    return {
      method, paymentCount: cnt((p) => !p.refund), collected, refundCount: cnt((p) => p.refund), refunded, net: collected - refunded,
      paymentCountAfterClose: cnt((p) => !p.refund && p.afterClose), collectedAfterClose: sum((p) => !p.refund && p.afterClose),
      refundCountAfterClose: cnt((p) => p.refund && p.afterClose), refundedAfterClose: sum((p) => p.refund && p.afterClose),
    };
  });
  const collectedTotal = methods.reduce((a, r) => a + r.collected, 0);
  const refundedTotal = methods.reduce((a, r) => a + r.refunded, 0);
  const orders = s.payments.filter((p) => !p.refund);
  return { orderCount: orders.length, grandTotal: collectedTotal, discountTotal: 0, methods, collectedTotal, refundedTotal, netTotal: collectedTotal - refundedTotal };
};
const detail = (s) => ({
  shift: view(s), report: report(s), ...(s.status === "OPEN" ? { provisionalExpectedCash: expectedOf(s) } : {}),
  history: s.history.map((h) => ({ ...h })),
});
const hist = (s, type, actorId, snapshot = {}) => s.history.push({ id: uuid(), type, actorId, occurredAt: now(), snapshot });

const page = (items, sp) => {
  const p = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
  return { items: items.slice(p * size, p * size + size), total: items.length, page: p, size };
};

export function handle({ method, url, body, caller, send, requireKey }) {
  const p = url.pathname;
  if (!p.startsWith("/api/sales/")) return false;
  const sp = url.searchParams;
  const me = caller ? USERS[caller] : undefined;
  const tenantId = me?.tenantId;
  let m;
  const err = (status, code, message, details = []) => (send(status, { code, message, details, timestamp: now() }), true);
  const openOf = (userId) => SHIFTS.find((s) => s.tenantId === tenantId && s.cashierUserId === userId && s.status === "OPEN");
  const invalid = (...d) => err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", d);

  // ---- Chỉ-mock ----
  if ((m = p.match(/^\/api\/sales\/__mock\/shifts\/([^/]+)\/(payments|pending)$/)) && method === "POST") {
    const s = SHIFTS.find((x) => x.id === m[1]);
    if (!s) return err(404, "SHIFT_NOT_FOUND", "Không có ca");
    if (m[2] === "payments") s.payments.push({ method: body.method ?? "CASH", amount: body.amount ?? 0, refund: !!body.refund, afterClose: !!body.afterClose });
    else s.pending = body.count ?? 0;
    return send(204), true;
  }

  // ---- Chặn bán khi cờ bật mà chưa mở ca (tạo đơn POS) ----
  if (p === "/api/sales/pos-orders" || p === "/api/sales/pos-orders/discounted") {
    if (method === "POST" && me && settingsOf(tenantId).requireOpenShiftForPos && !openOf(me.id)) {
      if (!requireKey(p.endsWith("/discounted") ? "PosOrderController/createWithDiscount" : "PosOrderController/create")) return true;
      return err(409, "SHIFT_NOT_OPEN", "Chưa mở ca");
    }
    return false;
  }

  // ---- Cấu hình ca ----
  if (p === "/api/sales/shift-settings") {
    if (method === "GET") {
      if (!requireKey(K.SET_GET)) return true;
      return send(200, settingsOf(tenantId)), true;
    }
    if (method === "PUT") {
      if (!requireKey(K.SET_UPDATE)) return true;
      const cur = settingsOf(tenantId);
      if (typeof body.requireOpenShiftForPos !== "boolean" || typeof body.varianceThreshold !== "number") return invalid("varianceThreshold: bắt buộc");
      if (body.varianceThreshold < 0 || body.varianceThreshold > 1_000_000_000) return err(400, "INVALID_SETTINGS", "Ngưỡng ngoài khoảng");
      if (body.version !== cur.version) return err(409, "SETTINGS_VERSION_CONFLICT", "Cấu hình đã đổi");
      const next = { requireOpenShiftForPos: body.requireOpenShiftForPos, varianceThreshold: body.varianceThreshold, version: cur.version + 1, updatedAt: now() };
      SETTINGS.set(tenantId, next);
      return send(200, next), true;
    }
    return false;
  }

  if (!p.startsWith("/api/sales/shifts")) return false;

  // ---- Mở ca ----
  if (p === "/api/sales/shifts" && method === "POST") {
    if (!requireKey(K.OPEN)) return true;
    if (typeof body.openingFloat !== "number" || body.openingFloat < 0) return invalid("openingFloat: phải >= 0");
    if (!body.clientRequestId) return invalid("clientRequestId: bắt buộc");
    const again = SHIFTS.find((s) => s.tenantId === tenantId && s.clientRequestId === body.clientRequestId);
    if (again) return again.cashierUserId === me.id ? (send(201, view(again)), true) : err(400, "INVALID_REQUEST", "clientRequestId của người khác");
    if (openOf(me.id)) return err(409, "SHIFT_ALREADY_OPEN", "Đang có ca mở");
    const s = {
      id: uuid(), tenantId, shiftNo: nextNo(tenantId), cashierUserId: me.id, registerLabel: body.registerLabel?.trim() || null, status: "OPEN", openedAt: now(), openingFloat: body.openingFloat,
      closedAt: null, closedBy: null, countedCash: null, expectedCash: null, variance: null, varianceReason: null, varianceStatus: "NONE", approvedBy: null, approvedAt: null, approvalNote: null,
      reopenCount: 0, version: 0, payments: [], history: [], pending: 0, clientRequestId: body.clientRequestId,
    };
    hist(s, "OPENED", me.id, { openingFloat: s.openingFloat });
    SHIFTS.unshift(s);
    return send(201, view(s)), true;
  }

  const close = (s, actorId) => {
    const counted = body.countedCash;
    if (typeof counted !== "number" || counted < 0) return invalid("countedCash: phải >= 0");
    if (s.pending > 0) return err(409, "SHIFT_HAS_PENDING_PAYMENTS", "Còn lệnh thu tay chờ", [`pendingPayments=${s.pending}`]);
    const expected = expectedOf(s);
    const variance = counted - expected;
    const over = Math.abs(variance) > settingsOf(tenantId).varianceThreshold;
    const reason = String(body.varianceReason ?? "").trim();
    if (over && !reason) return err(400, "SHIFT_VARIANCE_REASON_REQUIRED", "Thiếu lý do chênh lệch");
    Object.assign(s, {
      status: "CLOSED", closedAt: now(), closedBy: actorId, countedCash: counted, expectedCash: expected, variance, varianceReason: reason || null,
      varianceStatus: over ? "PENDING_APPROVAL" : "NONE", version: s.version + 1,
    });
    hist(s, "CLOSED", actorId, { countedCash: counted, expectedCash: expected, variance });
    return send(200, view(s)), true;
  };

  // ---- Ca của tôi ----
  if (p === "/api/sales/shifts/me/current" && method === "GET") {
    if (!requireKey(K.CURRENT)) return true;
    const s = openOf(me.id);
    return s ? (send(200, detail(s)), true) : err(404, "SHIFT_NOT_FOUND", "Chưa có ca mở");
  }
  if (p === "/api/sales/shifts/me/current/closing" && method === "POST") {
    if (!requireKey(K.CLOSE)) return true;
    const s = openOf(me.id);
    return s ? close(s, me.id) : err(404, "SHIFT_NOT_FOUND", "Chưa có ca mở");
  }
  if (p === "/api/sales/shifts/me" && method === "GET") {
    if (!requireKey(K.MINE)) return true;
    const items = SHIFTS.filter((s) => s.tenantId === tenantId && s.cashierUserId === me.id && (!sp.get("status") || s.status === sp.get("status")));
    return send(200, page(items.map(view), sp)), true;
  }
  if ((m = p.match(/^\/api\/sales\/shifts\/me\/([^/]+)$/)) && method === "GET") {
    if (!requireKey(K.GET_MINE)) return true;
    const s = SHIFTS.find((x) => x.id === m[1] && x.tenantId === tenantId && x.cashierUserId === me.id);
    return s ? (send(200, detail(s)), true) : err(404, "SHIFT_NOT_FOUND", "Không có ca");
  }

  // ---- Quản lý ----
  if (p === "/api/sales/shifts" && method === "GET") {
    if (!requireKey(K.SEARCH)) return true;
    const items = SHIFTS.filter(
      (s) =>
        s.tenantId === tenantId &&
        (!sp.get("cashierUserId") || s.cashierUserId === sp.get("cashierUserId")) &&
        (!sp.get("status") || s.status === sp.get("status")) &&
        (!sp.get("varianceStatus") || s.varianceStatus === sp.get("varianceStatus")) &&
        (!sp.get("from") || s.openedAt >= sp.get("from")) &&
        (!sp.get("to") || s.openedAt < sp.get("to")),
    );
    return send(200, page(items.map(view), sp)), true;
  }
  if ((m = p.match(/^\/api\/sales\/shifts\/([^/]+)(?:\/(closing|reopening|variance-approval))?$/))) {
    const sub = m[2];
    if (sub ? method !== "POST" : method !== "GET") return false;
    const key = !sub ? K.GET : sub === "closing" ? K.CLOSE_ON_BEHALF : sub === "reopening" ? K.REOPEN : K.APPROVE;
    if (!requireKey(key)) return true;
    const s = SHIFTS.find((x) => x.id === m[1] && x.tenantId === tenantId);
    if (!s) return err(404, "SHIFT_NOT_FOUND", "Không có ca");
    if (!sub) return send(200, detail(s)), true;
    if (sub === "closing") return s.status !== "OPEN" ? err(409, "SHIFT_STATE_CONFLICT", "Ca đã đóng") : close(s, me.id);
    if (sub === "reopening") {
      const reason = String(body.reason ?? "").trim();
      if (!reason) return err(400, "REOPEN_REASON_REQUIRED", "Thiếu lý do mở lại");
      if (s.status !== "CLOSED") return err(409, "SHIFT_STATE_CONFLICT", "Ca đang mở");
      if (openOf(s.cashierUserId)) return err(409, "SHIFT_ALREADY_OPEN", "Thu ngân đang có ca mở khác");
      Object.assign(s, { status: "OPEN", closedAt: null, closedBy: null, countedCash: null, expectedCash: null, variance: null, varianceReason: null, varianceStatus: "NONE", approvedBy: null, approvedAt: null, approvalNote: null, reopenCount: s.reopenCount + 1, version: s.version + 1 });
      hist(s, "REOPENED", me.id, { reason });
      return send(200, view(s)), true;
    }
    if (s.varianceStatus !== "PENDING_APPROVAL") return err(409, "SHIFT_STATE_CONFLICT", "Ca không chờ duyệt");
    Object.assign(s, { varianceStatus: "APPROVED", approvedBy: me.id, approvedAt: now(), approvalNote: body.note?.trim() || null, version: s.version + 1 });
    hist(s, "VARIANCE_APPROVED", me.id, {});
    return send(200, view(s)), true;
  }
  return false;
}
