// Mock liên hệ của khách gửi cửa hàng (ADR-0015): /api/sales/contact-requests/** theo docs/api/sales.md của repo BE.
// Khách gửi qua customer-api (ngoài FE nhân viên) nên mock có endpoint dựng sẵn: POST /api/sales/_mock/contacts (không kiểm khóa).
// Trạng thái trong bộ nhớ, dùng chung 2 worker: mỗi test dựng yêu cầu riêng.
import { USERS } from "./data.mjs";
import "./sales.mjs"; // đảm bảo USERS.salesmgr/cashier đã được gắn trước khi bổ sung khóa

const K = {
  SEARCH: "SalesContactController/search",
  GET: "SalesContactController/get",
  FULL: "SalesContactController/getContact",
  STATUS: "SalesContactController/updateStatus",
  ANONYMIZE: "SalesContactController/anonymize",
};
// Quản lý bán hàng: 4 khóa, KHÔNG có getContact (xem đầy đủ). Thu ngân: không có khóa nào. Admin (salesadmin) bỏ qua kiểm khóa.
USERS.salesmgr.permissions.push(K.SEARCH, K.GET, K.STATUS, K.ANONYMIZE);

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const NEXT = { NEW: ["IN_PROGRESS", "CLOSED"], IN_PROGRESS: ["CLOSED"], CLOSED: [] };
const TOPICS = ["ORDER", "PRODUCT", "PAYMENT", "OTHER"];

/** @type {Array<Record<string, any>>} */
const CONTACTS = [];

const maskName = (n) => (n ? n.split(/\s+/).map((w) => `${w[0]}***`).join(" ") : null);
const maskEmail = (e) => (e ? `${e[0]}***@${e.split("@")[1]}` : null);
const maskPhone = (p) => (p ? `${"*".repeat(Math.max(0, p.length - 3))}${p.slice(-3)}` : null);

const summary = (c) => ({
  id: c.id, topic: c.topic, status: c.status, createdAt: c.createdAt, closedAt: c.closedAt,
  contact: c.anonymizedAt ? { name: null, email: null, phone: null } : { name: maskName(c.fullName), email: maskEmail(c.email), phone: maskPhone(c.phone) },
  piiAnonymizedAt: c.anonymizedAt, version: c.version,
});
const detail = (c) => ({ ...summary(c), message: c.anonymizedAt ? null : c.message, customerUserId: c.anonymizedAt ? null : c.customerUserId });

const page = (items, sp) => {
  const p = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
  return { items: items.slice(p * size, p * size + size), total: items.length, page: p, size };
};

export function handle({ method, url, body, send, requireKey }) {
  const p = url.pathname;
  const sp = url.searchParams;
  const err = (status, code, message) => (send(status, { code, message, details: [], timestamp: now() }), true);

  if (p === "/api/sales/_mock/contacts" && method === "POST") {
    const created = new Date(Date.now() - (body.ageHours ?? 0) * 3600_000).toISOString();
    const c = {
      id: uuid(), topic: body.topic ?? "ORDER", status: body.status ?? "NEW", createdAt: created,
      closedAt: body.status === "CLOSED" ? created : null,
      fullName: body.fullName ?? "Nguyễn Văn Khách", email: body.email ?? "khach.hang@example.vn", phone: body.phone ?? "0912345678",
      message: body.message ?? "Đơn của tôi chưa được giao.", customerUserId: uuid(), anonymizedAt: null, version: 0,
    };
    CONTACTS.unshift(c);
    return send(201, detail(c)), true;
  }

  if (!p.startsWith("/api/sales/contact-requests")) return false;

  if (p === "/api/sales/contact-requests" && method === "GET") {
    if (!requireKey(K.SEARCH)) return true;
    const from = sp.get("from");
    const to = sp.get("to");
    let items = CONTACTS.filter(
      (c) =>
        (!sp.get("status") || c.status === sp.get("status")) &&
        (!sp.get("topic") || c.topic === sp.get("topic")) &&
        (!from || c.createdAt >= from) &&
        (!to || c.createdAt < to),
    );
    if (sp.get("topic") && !TOPICS.includes(sp.get("topic"))) items = [];
    return send(200, page(items.map(summary), sp)), true;
  }

  const m = p.match(/^\/api\/sales\/contact-requests\/([^/]+)(?:\/(contact|status|anonymization))?$/);
  if (!m) return err(404, "NOT_FOUND", "Không có endpoint này trong mock");
  const [, id, sub] = m;
  const key = !sub ? K.GET : sub === "contact" ? K.FULL : sub === "status" ? K.STATUS : K.ANONYMIZE;
  const method0 = !sub ? "GET" : sub === "contact" ? "GET" : sub === "status" ? "PUT" : "POST";
  if (method !== method0) return err(405, "METHOD_NOT_ALLOWED", "Sai phương thức");
  if (!requireKey(key)) return true;
  const c = CONTACTS.find((x) => x.id === id);
  if (!c) return err(404, "SHOP_CONTACT_NOT_FOUND", "Không có yêu cầu liên hệ");

  if (!sub) return send(200, detail(c)), true;
  if (sub === "contact") {
    return send(200, c.anonymizedAt ? { fullName: null, email: null, phone: null, piiAnonymizedAt: c.anonymizedAt } : { fullName: c.fullName, email: c.email, phone: c.phone, piiAnonymizedAt: null }), true;
  }
  if (sub === "status") {
    if (body.version == null || !body.status) return err(400, "VALIDATION_FAILED", "Thiếu status hoặc version");
    if (body.version !== c.version || !NEXT[c.status].includes(body.status)) return err(409, "SHOP_CONTACT_STATE_CONFLICT", "Xung đột trạng thái");
    c.status = body.status;
    c.version += 1;
    if (c.status === "CLOSED") c.closedAt = now();
    return send(200, detail(c)), true;
  }
  // anonymization: gọi lại là no-op 200
  if (!c.anonymizedAt) {
    c.anonymizedAt = now();
    c.fullName = c.email = c.phone = c.message = c.customerUserId = null;
    c.version += 1;
  }
  return send(200, detail(c)), true;
}
