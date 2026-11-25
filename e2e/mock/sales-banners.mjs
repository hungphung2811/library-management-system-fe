// Mock banner cửa hàng + chính sách chống lạm dụng đặt hàng (ADR-0019 mục 2.5): /api/sales/banners/** và
// /api/sales/settings/order-abuse-policy theo docs/api/storefront-kham-pha.md và docs/api/sales.md của repo BE.
// Trạng thái trong bộ nhớ, dùng chung 2 worker: test dùng tiêu đề riêng và không giả định số lượng.
// salesmgr có đủ khóa; salesview chỉ có khóa xem (list + get chính sách); salesadmin bỏ qua kiểm khóa.
import { USERS } from "./data.mjs";
import "./sales.mjs"; // đảm bảo USERS.salesmgr đã được gắn trước khi bổ sung khóa

const K = {
  LIST: "SalesBannerController/list",
  GET: "SalesBannerController/get",
  CREATE: "SalesBannerController/create",
  UPDATE: "SalesBannerController/update",
  DELETE: "SalesBannerController/delete",
  ABUSE_GET: "OrderAbusePolicyController/get",
  ABUSE_UPDATE: "OrderAbusePolicyController/update",
};
const SETTINGS_GET = "SalesSettingsController/get";
USERS.salesmgr.permissions.push(...Object.values(K));
USERS.salesview = {
  id: "salesview-id", roles: ["SALES_VIEWER"], modules: ["LENDING", "SALES"], password: "Salesview@12345",
  permissions: [K.LIST, K.GET, K.ABUSE_GET, SETTINGS_GET], tenantId: USERS.salesmgr.tenantId, tenants: [USERS.salesmgr.tenantId],
};

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const LIMIT = 20;

/** @type {Array<Record<string, any>>} */
const BANNERS = [];
const statusOf = (b) => {
  if (!b.active) return "INACTIVE";
  const t = Date.now();
  if (b.startsAt && Date.parse(b.startsAt) > t) return "SCHEDULED";
  if (b.endsAt && Date.parse(b.endsAt) <= t) return "EXPIRED";
  return "LIVE";
};
const view = (b) => ({ ...b, status: statusOf(b) });

let abuse = {
  reservationMinutes: 15, maxPendingOrders: 5, maxOrdersPerDay: 20, maxQuantityPerLine: 50, maxTotalQuantity: 100,
  ordersPerMinutePerUser: 5, ordersPerMinuteTenant: 300, version: 0, updatedAt: null,
};
const ABUSE_RANGE = {
  reservationMinutes: [0, 10080], maxPendingOrders: [1, 1000], maxOrdersPerDay: [1, 10000], maxQuantityPerLine: [1, 10000],
  maxTotalQuantity: [1, 100000], ordersPerMinutePerUser: [1, 600], ordersPerMinuteTenant: [1, 100000],
};

/** Luật nội dung tối giản như domain BE: trả danh sách tên trường sai. */
function validate(b) {
  const bad = [];
  const title = String(b.title ?? "").trim();
  if (!title || title.length > 100) bad.push("title");
  if (b.subtitle != null && String(b.subtitle).length > 200) bad.push("subtitle");
  if (b.linkPath != null && !/^\/(?!\/)[A-Za-z0-9\-._~/?#=&+,%]*$/.test(String(b.linkPath))) bad.push("linkPath");
  if (b.sortOrder != null && !(b.sortOrder >= 0 && b.sortOrder <= 999)) bad.push("sortOrder");
  if (b.startsAt && b.endsAt && !(Date.parse(b.startsAt) < Date.parse(b.endsAt))) bad.push("endsAt");
  return bad;
}
const fields = (b) => ({
  title: String(b.title ?? "").trim(), subtitle: b.subtitle?.trim?.() || null, linkPath: b.linkPath || null,
  sortOrder: b.sortOrder ?? 0, active: b.active ?? true, startsAt: b.startsAt ?? null, endsAt: b.endsAt ?? null,
});

export function handle({ method, url, body, send, requireKey }) {
  const p = url.pathname;
  const err = (status, code, message, details = []) => (send(status, { code, message, details, timestamp: now() }), true);
  let m;

  if (p === "/api/sales/settings/order-abuse-policy") {
    if (method === "GET") {
      if (!requireKey(K.ABUSE_GET)) return true;
      return send(200, abuse), true;
    }
    if (method === "PUT") {
      if (!requireKey(K.ABUSE_UPDATE)) return true;
      if (body.version !== abuse.version) return err(409, "SETTINGS_VERSION_CONFLICT", "Chính sách vừa được người khác sửa");
      const bad = Object.entries(ABUSE_RANGE).filter(([k, [lo, hi]]) => !(Number.isInteger(body[k]) && body[k] >= lo && body[k] <= hi)).map(([k]) => k);
      if (bad.length) return err(400, "INVALID_SETTINGS", "Chính sách không hợp lệ", bad);
      const next = {};
      for (const k of Object.keys(ABUSE_RANGE)) next[k] = body[k];
      abuse = { ...next, version: abuse.version + 1, updatedAt: now() };
      return send(200, abuse), true;
    }
    return false;
  }

  if (!p.startsWith("/api/sales/banners")) return false;

  if (p === "/api/sales/banners" && method === "GET") {
    if (!requireKey(K.LIST)) return true;
    return send(200, [...BANNERS].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)).map(view)), true;
  }
  if (p === "/api/sales/banners" && method === "POST") {
    if (!requireKey(K.CREATE)) return true;
    const bad = validate(body);
    if (bad.length) return err(400, "INVALID_BANNER", "Banner không hợp lệ", bad);
    if (BANNERS.length >= LIMIT) return err(409, "BANNER_LIMIT_EXCEEDED", "Đã có 20 banner");
    const b = { id: uuid(), ...fields(body), version: 0, createdAt: now(), updatedAt: now() };
    BANNERS.push(b);
    return send(201, view(b)), true;
  }
  if ((m = p.match(/^\/api\/sales\/banners\/([^/]+)$/))) {
    const key = { GET: K.GET, PUT: K.UPDATE, DELETE: K.DELETE }[method];
    if (!key) return false;
    if (!requireKey(key)) return true;
    const i = BANNERS.findIndex((x) => x.id === m[1]);
    if (i < 0) return err(404, "BANNER_NOT_FOUND", "Không có banner");
    const b = BANNERS[i];
    if (method === "GET") return send(200, view(b)), true;
    if (method === "DELETE") return BANNERS.splice(i, 1), send(204), true;
    if (body.version !== b.version) return err(409, "BANNER_VERSION_CONFLICT", "Banner vừa được người khác sửa");
    const bad = validate(body);
    if (bad.length) return err(400, "INVALID_BANNER", "Banner không hợp lệ", bad);
    Object.assign(b, fields(body), { version: b.version + 1, updatedAt: now() });
    return send(200, view(b)), true;
  }
  return false;
}
