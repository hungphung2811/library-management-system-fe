// Mock thông báo theo sự kiện (ADR-0030 gói C): /api/notification-deliveries, /api/notification-settings/channels, /api/notification-templates
// (khóa quyền động do support-service kiểm) và /api/notifications/me/preferences (chỉ cần đăng nhập) theo docs/api/notifications.md của repo BE.
// Trạng thái trong bộ nhớ, dùng chung 2 worker và test chạy song song: mỗi test dùng loại thông báo, lượt gửi hoặc người dùng riêng.
//  - Tenant T_NOTI (có dữ liệu mẫu): `notiadmin` (đủ khóa, không phải admin), `notiview` (chỉ xem: không sửa/gửi lại), `notinone` (không khóa nào).
//  - Tenant T_EMPTY (không có lượt gửi nào): `notiempty` (đủ khóa).
//  - Tùy chọn của tôi theo người dùng: `notipref1`, `notipref2`, `notipref3` (mỗi test một người).
import { USERS } from "./data.mjs";

const T_NOTI = "51111111-1111-4111-8111-111111111111";
const T_EMPTY = "52222222-2222-4222-8222-222222222222";

const K = {
  DEL_SEARCH: "NotificationDeliveryController/search",
  DEL_RETRY: "NotificationDeliveryController/retry",
  CH_GET: "NotificationSettingsController/getChannels",
  CH_UPDATE: "NotificationSettingsController/updateChannels",
  TPL_LIST: "NotificationTemplateController/list",
  TPL_GET: "NotificationTemplateController/get",
  TPL_SAVE: "NotificationTemplateController/save",
  TPL_PREVIEW: "NotificationTemplateController/preview",
};
const mk = (id, perms, tenantId = T_NOTI) => ({
  id: `${id}-id`, roles: ["STAFF"], modules: ["LENDING", "SALES"], password: `${id[0].toUpperCase()}${id.slice(1)}@12345`, permissions: perms, tenantId, tenants: [tenantId],
});
USERS.notiadmin = mk("notiadmin", Object.values(K));
USERS.notiview = mk("notiview", [K.DEL_SEARCH, K.CH_GET, K.TPL_LIST, K.TPL_GET]);
USERS.notinone = mk("notinone", []);
USERS.notiempty = mk("notiempty", Object.values(K), T_EMPTY);
for (const n of [1, 2, 3]) USERS[`notipref${n}`] = mk(`notipref${n}`, []);

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const err = (send, status, code, message, details = []) => (send(status, { code, message, details, timestamp: now() }), true);

/** type -> { category, params, subject, body } */
const TYPES = {
  ORDER_PLACED: ["ORDER", ["order_no", "grand_total"], "Đã nhận đơn {{order_no}}", "Xin chào {{recipient_name}}, {{tenant_name}} đã nhận đơn {{order_no}} trị giá {{grand_total}}."],
  ORDER_PAID: ["ORDER", ["order_no", "grand_total"], "Đơn {{order_no}} đã thanh toán", "Xin chào {{recipient_name}}, đơn {{order_no}} ({{grand_total}}) đã được thanh toán."],
  ORDER_READY_FOR_PICKUP: ["ORDER", ["order_no"], "Đơn {{order_no}} sẵn sàng nhận", "Đơn {{order_no}} đã sẵn sàng để bạn nhận tại cửa hàng."],
  ORDER_SHIPPING: ["ORDER", ["order_no"], "Đơn {{order_no}} đang giao", "Đơn {{order_no}} đang trên đường giao đến bạn."],
  ORDER_COMPLETED: ["ORDER", ["order_no"], "Đơn {{order_no}} hoàn tất", "Cảm ơn bạn đã mua hàng. Đơn {{order_no}} đã hoàn tất."],
  ORDER_CANCELLED: ["ORDER", ["order_no", "cancel_reason"], "Đơn {{order_no}} đã hủy", "Đơn {{order_no}} đã bị hủy. Lý do: {{cancel_reason}}."],
  REFUND_COMPLETED: ["REFUND", ["order_no", "amount"], "Đã hoàn tiền đơn {{order_no}}", "Chúng tôi đã hoàn {{amount}} cho đơn {{order_no}}."],
  INVOICE_ISSUED: ["INVOICE", ["invoice_no", "order_no", "grand_total", "issued_at"], "Hóa đơn {{invoice_no}}", "Hóa đơn {{invoice_no}} của đơn {{order_no}} ({{grand_total}}) lập lúc {{issued_at}}."],
  LOAN_DUE_SOON: ["LOAN_REMINDER", ["due_date", "days_before", "item_count"], "Sắp đến hạn trả sách", "Bạn có {{item_count}} cuốn đến hạn trả ngày {{due_date}} (còn {{days_before}} ngày)."],
  LOAN_OVERDUE: ["LOAN_REMINDER", ["due_date", "days_overdue", "reminder_no", "max_reminders", "item_count"], "Sách đã quá hạn", "Bạn có {{item_count}} cuốn quá hạn {{days_overdue}} ngày (hạn {{due_date}})."],
  RESERVATION_READY: ["RESERVATION", ["hold_until"], "Sách đặt trước đã sẵn sàng", "Sách bạn đặt trước được giữ đến {{hold_until}}."],
  FINE_ISSUED: ["FINE", ["amount", "reason"], "Phát sinh tiền phạt", "Bạn bị phạt {{amount}}. Lý do: {{reason}}."],
  CONTRACT_EXPIRING: ["ACCOUNT", ["contract_name", "end_date", "days"], "Hợp đồng sắp hết hạn", "Hợp đồng {{contract_name}} hết hạn ngày {{end_date}} (còn {{days}} ngày)."],
};
const CATEGORIES = ["ORDER", "INVOICE", "LOAN_REMINDER", "RESERVATION", "FINE", "REFUND", "ACCOUNT"];
const MANDATORY = ["REFUND", "ACCOUNT"];

/** `${tenantId}:${type}:${channel}` -> bật/tắt */
const CHANNELS = new Map();
const chKey = (t, type, ch) => `${t}:${type}:${ch}`;
/** `${tenantId}:${type}:${channel}` -> mẫu của tenant (phiên bản mới nhất) */
const TEMPLATES = new Map();
const tplView = (t, type, ch) => {
  const [category, allowedParams, subject, body] = TYPES[type];
  const own = TEMPLATES.get(chKey(t, type, ch));
  return own ?? { type, category, channel: ch, source: "DEFAULT", version: 1, subject, body, allowedParams };
};
const allowed = (type) => [...TYPES[type][1], "recipient_name", "tenant_name"];
/** Kiểm cú pháp và tham số như BE: trả [code, message] hoặc null. */
function checkTemplate(type, subject, body) {
  for (const text of [subject, body]) {
    const opens = (text.match(/\{\{/g) ?? []).length;
    const closes = (text.match(/\}\}/g) ?? []).length;
    if (opens !== closes) return ["TEMPLATE_INVALID", "Cú pháp {{ }} sai"];
    for (const m of text.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) if (!allowed(type).includes(m[1])) return ["TEMPLATE_PARAM_NOT_ALLOWED", `Tham số không được phép: ${m[1]}`];
  }
  return null;
}
const render = (text) => text.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_, p) => (p === "recipient_name" ? "Nguyễn Văn A" : p === "tenant_name" ? "Hiệu sách Mẫu" : `[${p}]`));

// ---- Lượt gửi mẫu ----
/** @type {any[]} */
const DELIVERIES = [];
export const DEAD_A = "d0000000-0000-4000-8000-00000000000a";
export const DEAD_B = "d0000000-0000-4000-8000-00000000000b";
const delivery = (o) => ({
  id: uuid(), eventId: uuid(), eventType: o.type, type: "ORDER_PAID", category: "ORDER", channel: "EMAIL", status: "SENT", skipReason: null, recipientUserId: uuid(), recipientAddressMasked: "n***@gmail.com",
  attempts: 1, nextAttemptAt: null, lastErrorCode: null, lastErrorAt: null, sentAt: now(), templateSource: "DEFAULT", templateVersion: 1, lastRetryBy: null, lastRetryAt: null, createdAt: now(), tenantId: T_NOTI, ...o,
});
{
  const base = Date.now();
  let i = 0;
  const at = () => new Date(base - 60_000 * ++i).toISOString();
  DELIVERIES.push(
    delivery({ id: DEAD_A, status: "DEAD", type: "INVOICE_ISSUED", category: "INVOICE", attempts: 6, lastErrorCode: "SMTP_5XX", lastErrorAt: at(), sentAt: null, recipientAddressMasked: "k***@hotmail.com", createdAt: at() }),
    delivery({ id: DEAD_B, status: "DEAD", type: "ORDER_CANCELLED", attempts: 6, lastErrorCode: "SMTP_CONNECT", lastErrorAt: at(), sentAt: null, recipientAddressMasked: "t***@yahoo.com", createdAt: at() }),
    delivery({ status: "SKIPPED", type: "ORDER_COMPLETED", skipReason: "OPTED_OUT", sentAt: null, attempts: 0, createdAt: at() }),
    delivery({ status: "RETRY", type: "FINE_ISSUED", category: "FINE", attempts: 2, lastErrorCode: "TIMEOUT", lastErrorAt: at(), nextAttemptAt: now(), sentAt: null, createdAt: at() }),
  );
  for (let n = 0; n < 24; n++) DELIVERIES.push(delivery({ createdAt: at() }));
}
const delView = ({ tenantId: _t, ...rest }) => rest;

const page = (items, sp) => {
  const p = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
  return { items: items.slice(p * size, p * size + size), total: items.length, page: p, size };
};

/** userId -> { category -> enabled } */
const PREFS = new Map();
const prefsView = (uid) => CATEGORIES.map((category) => ({ category, channel: "EMAIL", enabled: MANDATORY.includes(category) ? true : (PREFS.get(uid)?.[category] ?? true), mandatory: MANDATORY.includes(category) }));

export function handle({ method, url, body, caller, send, requireKey }) {
  const p = url.pathname;
  const sp = url.searchParams;
  const me = caller ? USERS[caller] : undefined;
  const tenantId = me?.tenantId;
  let m;

  // ---- Tùy chọn của tôi (chỉ cần đăng nhập) ----
  if (p === "/api/notifications/me/preferences") {
    if (!me) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    if (method === "GET") return send(200, prefsView(me.id)), true;
    if (method === "PUT") {
      const items = body.items;
      if (!Array.isArray(items)) return err(send, 400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["items: bắt buộc"]);
      if (items.some((i) => MANDATORY.includes(i.category) && i.enabled === false)) return err(send, 400, "PREFERENCE_MANDATORY", "Nhóm bắt buộc không tắt được");
      const cur = { ...(PREFS.get(me.id) ?? {}) };
      for (const i of items) if (CATEGORIES.includes(i.category)) cur[i.category] = !!i.enabled;
      PREFS.set(me.id, cur);
      return send(200, prefsView(me.id)), true;
    }
    return false;
  }

  // ---- Cấu hình kênh ----
  if (p === "/api/notification-settings/channels") {
    if (method === "GET") {
      if (!requireKey(K.CH_GET)) return true;
      return send(200, Object.keys(TYPES).map((type) => ({ type, category: TYPES[type][0], channel: "EMAIL", enabled: CHANNELS.get(chKey(tenantId, type, "EMAIL")) ?? true }))), true;
    }
    if (method === "PUT") {
      if (!requireKey(K.CH_UPDATE)) return true;
      for (const i of body.items ?? []) {
        if (!TYPES[i.type] || i.channel !== "EMAIL" || typeof i.enabled !== "boolean") return err(send, 400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["items: giá trị lạ"]);
      }
      for (const i of body.items ?? []) CHANNELS.set(chKey(tenantId, i.type, i.channel), i.enabled);
      return send(200, Object.keys(TYPES).map((type) => ({ type, category: TYPES[type][0], channel: "EMAIL", enabled: CHANNELS.get(chKey(tenantId, type, "EMAIL")) ?? true }))), true;
    }
    return false;
  }

  // ---- Mẫu nội dung ----
  if (p === "/api/notification-templates" && method === "GET") {
    if (!requireKey(K.TPL_LIST)) return true;
    return send(200, Object.keys(TYPES).map((type) => tplView(tenantId, type, "EMAIL"))), true;
  }
  if ((m = p.match(/^\/api\/notification-templates\/([^/]+)\/([^/]+)(?:\/(preview))?$/))) {
    const [, type, channel, sub] = m;
    const key = sub ? K.TPL_PREVIEW : method === "GET" ? K.TPL_GET : K.TPL_SAVE;
    if (sub ? method !== "POST" : method !== "GET" && method !== "PUT") return false;
    if (!requireKey(key)) return true;
    if (!TYPES[type] || channel !== "EMAIL") return err(send, 400, "VALIDATION_FAILED", "Loại hoặc kênh không hợp lệ");
    if (method === "GET") return send(200, tplView(tenantId, type, channel)), true;
    if (sub === "preview") {
      const cur = tplView(tenantId, type, channel);
      const subject = body.subject ?? cur.subject;
      const text = body.body ?? cur.body;
      const bad = checkTemplate(type, subject, text);
      if (bad) return err(send, 400, bad[0], bad[1]);
      return send(200, { subject: render(subject), body: render(text) }), true;
    }
    const subject = String(body.subject ?? "").trim();
    const text = String(body.body ?? "");
    if (!subject || !text.trim() || subject.length > 200 || text.length > 5000) return err(send, 400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["subject/body: bắt buộc, tối đa 200/5000 ký tự"]);
    const bad = checkTemplate(type, subject, text);
    if (bad) return err(send, 400, bad[0], bad[1]);
    const prev = tplView(tenantId, type, channel);
    const next = { ...prev, source: "TENANT", version: prev.version + 1, subject, body: text };
    TEMPLATES.set(chKey(tenantId, type, channel), next);
    return send(200, next), true;
  }

  // ---- Lịch sử gửi ----
  if (p === "/api/notification-deliveries" && method === "GET") {
    if (!requireKey(K.DEL_SEARCH)) return true;
    const items = DELIVERIES.filter(
      (d) =>
        d.tenantId === tenantId &&
        (!sp.get("status") || d.status === sp.get("status")) &&
        (!sp.get("type") || d.type === sp.get("type")) &&
        (!sp.get("channel") || d.channel === sp.get("channel")) &&
        (!sp.get("from") || d.createdAt >= sp.get("from")) &&
        (!sp.get("to") || d.createdAt < sp.get("to")),
    );
    return send(200, page(items.map(delView), sp)), true;
  }
  if ((m = p.match(/^\/api\/notification-deliveries\/([^/]+)\/retry$/)) && method === "POST") {
    if (!requireKey(K.DEL_RETRY)) return true;
    const d = DELIVERIES.find((x) => x.id === m[1] && x.tenantId === tenantId);
    if (!d) return err(send, 404, "DELIVERY_NOT_FOUND", "Không có lượt gửi");
    if (d.status !== "DEAD") return err(send, 409, "DELIVERY_NOT_RETRYABLE", "Chỉ gửi lại lượt DEAD");
    Object.assign(d, { status: "PENDING", nextAttemptAt: now(), lastRetryBy: me.id, lastRetryAt: now() });
    return send(200, delView(d)), true;
  }
  return false;
}
