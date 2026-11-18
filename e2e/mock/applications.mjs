// Mock Developer Portal: /api/applications/** của tenant admin (khóa ApplicationController/<method>).
// Hợp đồng theo docs/api/applications.md của repo BE: Application PUBLIC_SITE | INTEGRATION, scope (chỉ cấp được books:read,
// inventory:read, orders:read), credential (secret chỉ có trong phản hồi tạo), domain allowlist, lịch sử. Mọi phản hồi có
// Cache-Control: no-store (gateway đặt cho đường dẫn /api/applications). Trạng thái trong bộ nhớ, dùng chung giữa các worker:
// test dùng tên Application có hậu tố riêng và không giả định số lượng.
// Hành vi đặc biệt để test điều khiển được:
//  - Tên chứa "khoa-orders": mock coi orders:read chưa mở cấp (422 SCOPE_NOT_GRANTABLE), mô phỏng BE thu hẹp danh sách cấp được.
//  - Đơn vị của tài khoản `nocontract` không có hợp đồng: tạo INTEGRATION trả 409 CONTRACT_REQUIRED.
import { USERS } from "./data.mjs";

const CTL = "ApplicationController";
const KEYS = Object.fromEntries(
  ["list", "get", "create", "update", "delete", "replaceScopes", "createCredential", "revokeCredential", "rotateSiteKey", "listDomains", "addDomain", "removeDomain", "history"].map((m) => [m, `${CTL}/${m}`]),
);
const ALL = Object.values(KEYS);
const CATALOG = ["books:read", "books:write", "inventory:read", "inventory:write", "orders:read", "orders:write", "customers:read", "customers:write"];
const GRANTABLE = ["books:read", "inventory:read", "orders:read"];
const MAX_APPS = 20;
const MAX_DOMAINS = 10;
const MAX_USABLE_CREDENTIALS = 2;

const TENANT = USERS.admin.tenantId;
// appviewer: chỉ xem danh sách và chi tiết (không tạo/sửa/thu hồi). appnone: không có khóa nào của Application.
USERS.appviewer = { id: "appviewer-id", roles: ["DEV"], permissions: [KEYS.list, KEYS.get, KEYS.history, KEYS.listDomains], password: "Appviewer@12345", tenantId: TENANT, tenants: [TENANT] };
USERS.appnone = { id: "appnone-id", roles: ["DEV"], permissions: [], password: "Appnone@12345", tenantId: TENANT, tenants: [TENANT] };
// appdev: đủ khóa nhưng không phải admin (kiểm tra theo khóa, không theo cờ admin).
USERS.appdev = { id: "appdev-id", roles: ["DEV"], permissions: ALL, password: "Appdev@12345", tenantId: TENANT, tenants: [TENANT] };

let seq = 9000;
const uuid = () => `a0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const nowIso = () => new Date().toISOString();
const err = (send, status, code, message, details) => send(status, { code, message, ...(details ? { details } : {}) });
const rand = (n) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");

/** @type {Map<string, any[]>} tenantId -> Application (đã gồm credentials, domains, history) */
const APPS = new Map();
const list = (tenantId) => APPS.get(tenantId) ?? APPS.set(tenantId, []).get(tenantId);

const history = (app, action, detail, credentialId = null, actor = "admin-id") =>
  app.history.unshift({ id: uuid(), credentialId, action, detail, actorId: actor, occurredAt: nowIso() });

const mkApp = (tenantId, { name, kind, rateLimitPerMinute = null }) => {
  const id = uuid();
  const t = nowIso();
  const app = {
    id, name, kind, status: "ACTIVE", rateLimitPerMinute, scopes: [], credentials: [], domains: [], history: [],
    siteKey: kind === "PUBLIC_SITE" ? `lms_pk_${rand(24)}` : null, createdAt: t, createdBy: "admin-id", updatedAt: t, updatedBy: "admin-id",
  };
  history(app, "CREATED", `kind=${kind}`);
  list(tenantId).push(app);
  return app;
};

const usable = (c) => c.status === "ACTIVE" && (!c.expiresAt || new Date(c.expiresAt) > new Date());
const credView = ({ secretHash: _h, ...c }) => ({ ...c, usable: usable(c) });
const summary = (a) => ({
  id: a.id, name: a.name, kind: a.kind, status: a.status, siteKey: a.siteKey, rateLimitPerMinute: a.rateLimitPerMinute, scopes: a.scopes,
  usableCredentials: a.credentials.filter(usable).length, createdAt: a.createdAt, updatedAt: a.updatedAt,
});
const detail = (a) => ({
  id: a.id, clientId: a.id, name: a.name, kind: a.kind, status: a.status, siteKey: a.siteKey, rateLimitPerMinute: a.rateLimitPerMinute,
  scopes: a.scopes, credentials: a.credentials.map(credView), createdAt: a.createdAt, createdBy: a.createdBy, updatedAt: a.updatedAt, updatedBy: a.updatedBy,
});
const addCredential = (app, days = 365) => {
  const secret = `lms_sk_${rand(43)}`;
  const c = {
    id: uuid(), secretHint: secret.slice(-4), status: "ACTIVE", createdAt: nowIso(), createdBy: "admin-id",
    expiresAt: new Date(Date.now() + days * 86400000).toISOString(), lastUsedAt: null, revokedAt: null, revokeReason: null, secretHash: "sha256:" + rand(8),
  };
  app.credentials.push(c);
  history(app, "CREDENTIAL_CREATED", `hint=${c.secretHint}`, c.id);
  return { c, secret };
};

// Seed cho tenant admin chính: dữ liệu cố định để test danh sách.
export const SEED_SITE_NAME = "Website thư viện (seed)";
export const SEED_INTEGRATION_NAME = "ERP kế toán (seed)";
{
  const site = mkApp(TENANT, { name: SEED_SITE_NAME, kind: "PUBLIC_SITE" });
  site.domains.push({ id: uuid(), origin: "https://thuvien.example.vn", enabled: true, createdAt: nowIso(), createdBy: "admin-id", updatedAt: nowIso(), updatedBy: "admin-id" });
  const erp = mkApp(TENANT, { name: SEED_INTEGRATION_NAME, kind: "INTEGRATION", rateLimitPerMinute: 600 });
  erp.scopes = ["books:read"];
  addCredential(erp);
}

/** Origin dùng chung toàn hệ thống (UNIQUE) cho kiểm trùng. */
const ownerOfOrigin = (origin) => {
  for (const [tid, apps] of APPS) for (const a of apps) if (a.domains.some((d) => d.origin === origin)) return { tid, a };
  return null;
};
function normalize(raw) {
  const v = String(raw ?? "").trim();
  if (!v || v.length > 300 || /\s/.test(v)) return { reason: "SYNTAX" };
  if (v.includes("*")) return { reason: "WILDCARD" };
  const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(v);
  if (!m || !["http", "https"].includes(m[1].toLowerCase())) return { reason: "SCHEME" };
  const scheme = m[1].toLowerCase();
  const rest = m[2].replace(/\/$/, "");
  if (/[/?#@]/.test(rest)) return { reason: "PATH" };
  const [host, port] = rest.split(":");
  if (!host) return { reason: "HOST" };
  if (scheme === "http" && !["localhost", "127.0.0.1"].includes(host.toLowerCase())) return { reason: "HTTP_NOT_ALLOWED" };
  return { origin: `${scheme}://${host.toLowerCase()}${port ? `:${port}` : ""}` };
}

export function handle({ method, url, body, caller, send, requireKey }) {
  const p = url.pathname;
  if (p !== "/api/applications" && !p.startsWith("/api/applications/")) return false;
  const m = p.match(/^\/api\/applications(?:\/([^/]+)(?:\/(scopes|credentials|site-key\/rotation|domains|history)(?:\/([^/]+)(?:\/(revocation))?)?)?)?$/);
  if (!m) return err(send, 404, "NOT_FOUND", "Không có endpoint này"), true;
  const [, id, sub, subId, subAction] = m;

  // Gọi chưa đăng nhập: 401; token không có tenant: 403 TENANT_REQUIRED (như BE).
  if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true;
  const tenantId = USERS[caller].tenantId;
  if (!tenantId) return err(send, 403, "TENANT_REQUIRED", "Thiếu tenant"), true;
  const apps = list(tenantId);
  const notFound = () => (err(send, 404, "APPLICATION_NOT_FOUND", "Không tìm thấy ứng dụng"), true);

  if (!id) {
    if (method === "GET") return requireKey(KEYS.list) && send(200, apps.map(summary)), true;
    if (method === "POST") {
      if (!requireKey(KEYS.create)) return true;
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 100) return err(send, 400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["name: Tên 1-100 ký tự"]), true;
      if (!["PUBLIC_SITE", "INTEGRATION"].includes(body?.kind)) return err(send, 400, "INVALID_APPLICATION", "Loại ứng dụng không hợp lệ"), true;
      const rate = body.rateLimitPerMinute;
      if (rate != null && !(Number.isInteger(rate) && rate >= 1 && rate <= 1_000_000)) return err(send, 400, "INVALID_APPLICATION", "Giới hạn tốc độ không hợp lệ"), true;
      if (body.kind === "INTEGRATION" && USERS.nocontract && tenantId === USERS.nocontract.tenantId) return err(send, 409, "CONTRACT_REQUIRED", "Cần hợp đồng đang hiệu lực"), true;
      if (apps.some((a) => a.name.toLowerCase() === name.toLowerCase())) return err(send, 409, "APPLICATION_NAME_DUPLICATED", "Tên đã tồn tại"), true;
      if (apps.length >= MAX_APPS) return err(send, 409, "APPLICATION_LIMIT_EXCEEDED", "Quá số ứng dụng tối đa"), true;
      const app = mkApp(tenantId, { name, kind: body.kind, rateLimitPerMinute: rate ?? null });
      return send(201, detail(app)), true;
    }
    return false;
  }

  const app = apps.find((a) => a.id === id);

  if (!sub) {
    if (method === "GET") return requireKey(KEYS.get) && (app ? send(200, detail(app)) : notFound()), true;
    if (method === "PUT") {
      if (!requireKey(KEYS.update)) return true;
      if (!app) return notFound();
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 100) return err(send, 400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", ["name: Tên 1-100 ký tự"]), true;
      if (app.status !== "ACTIVE") return err(send, 409, "APPLICATION_NOT_ACTIVE", "Ứng dụng không hoạt động"), true;
      if (apps.some((a) => a !== app && a.name.toLowerCase() === name.toLowerCase())) return err(send, 409, "APPLICATION_NAME_DUPLICATED", "Tên đã tồn tại"), true;
      Object.assign(app, { name, rateLimitPerMinute: body.rateLimitPerMinute ?? null, updatedAt: nowIso() });
      history(app, "UPDATED", null);
      return send(200, detail(app)), true;
    }
    if (method === "DELETE") {
      if (!requireKey(KEYS.delete)) return true;
      if (!app) return notFound();
      for (const c of app.credentials) if (c.status === "ACTIVE") Object.assign(c, { status: "REVOKED", revokedAt: nowIso(), revokeReason: "APPLICATION_DELETED" });
      APPS.set(tenantId, apps.filter((a) => a !== app));
      return send(204), true;
    }
    return false;
  }

  if (sub === "scopes" && method === "PUT") {
    if (!requireKey(KEYS.replaceScopes)) return true;
    if (!app) return notFound();
    const scopes = body?.scopes;
    if (!Array.isArray(scopes)) return err(send, 400, "VALIDATION_FAILED", "Thiếu scopes"), true;
    if (scopes.some((s) => !CATALOG.includes(s))) return err(send, 400, "INVALID_SCOPE", "Scope ngoài danh mục"), true;
    if (app.kind !== "INTEGRATION") return err(send, 409, "KIND_MISMATCH", "Chỉ ứng dụng INTEGRATION có scope"), true;
    if (app.status !== "ACTIVE") return err(send, 409, "APPLICATION_NOT_ACTIVE", "Ứng dụng không hoạt động"), true;
    const grantable = app.name.includes("khoa-orders") ? GRANTABLE.filter((s) => s !== "orders:read") : GRANTABLE;
    if (scopes.some((s) => !grantable.includes(s))) return err(send, 422, "SCOPE_NOT_GRANTABLE", "Scope chưa mở cấp"), true;
    app.scopes = [...new Set(scopes)];
    app.updatedAt = nowIso();
    history(app, "SCOPES_CHANGED", app.scopes.join(" "));
    return send(200, detail(app)), true;
  }

  if (sub === "credentials" && !subId && method === "POST") {
    if (!requireKey(KEYS.createCredential)) return true;
    if (!app) return notFound();
    if (app.kind !== "INTEGRATION") return err(send, 409, "KIND_MISMATCH", "Chỉ ứng dụng INTEGRATION có credential"), true;
    if (app.status !== "ACTIVE") return err(send, 409, "APPLICATION_NOT_ACTIVE", "Ứng dụng không hoạt động"), true;
    if (app.credentials.filter(usable).length >= MAX_USABLE_CREDENTIALS) return err(send, 409, "CREDENTIAL_LIMIT_EXCEEDED", "Quá 2 credential dùng được"), true;
    const days = body?.expiresInDays;
    if (days != null && !(Number.isInteger(days) && days >= 1 && days <= 730)) return err(send, 400, "VALIDATION_FAILED", "Hạn dùng không hợp lệ"), true;
    const { c, secret } = addCredential(app, days ?? 365);
    app.updatedAt = nowIso();
    // Secret chỉ có ở phản hồi này; không có API nào đọc lại.
    return send(201, { credentialId: c.id, clientId: app.id, clientSecret: secret, secretHint: c.secretHint, createdAt: c.createdAt, expiresAt: c.expiresAt }), true;
  }

  if (sub === "credentials" && subId && subAction === "revocation" && method === "POST") {
    if (!requireKey(KEYS.revokeCredential)) return true;
    if (!app) return notFound();
    const c = app.credentials.find((x) => x.id === subId);
    if (!c) return err(send, 404, "CREDENTIAL_NOT_FOUND", "Không có credential"), true;
    if (c.status !== "ACTIVE") return err(send, 409, "CREDENTIAL_NOT_ACTIVE", "Credential không còn hoạt động"), true;
    const reason = body?.reason ?? "MANUAL";
    if (!["MANUAL", "ROTATED", "COMPROMISED"].includes(reason)) return err(send, 400, "VALIDATION_FAILED", "Lý do không hợp lệ"), true;
    Object.assign(c, { status: "REVOKED", revokedAt: nowIso(), revokeReason: reason });
    history(app, "CREDENTIAL_REVOKED", `reason=${reason}`, c.id);
    return send(200, credView(c)), true;
  }

  if (sub === "site-key/rotation" && method === "POST") {
    if (!requireKey(KEYS.rotateSiteKey)) return true;
    if (!app) return notFound();
    if (app.kind !== "PUBLIC_SITE") return err(send, 409, "KIND_MISMATCH", "Chỉ website công khai có site key"), true;
    if (app.status !== "ACTIVE") return err(send, 409, "APPLICATION_NOT_ACTIVE", "Ứng dụng không hoạt động"), true;
    app.siteKey = `lms_pk_${rand(24)}`;
    app.updatedAt = nowIso();
    history(app, "SITE_KEY_ROTATED", null);
    return send(200, detail(app)), true;
  }

  if (sub === "domains") {
    if (method === "GET" && !subId) {
      if (!requireKey(KEYS.listDomains)) return true;
      if (!app) return notFound();
      if (app.kind !== "PUBLIC_SITE") return err(send, 409, "KIND_MISMATCH", "Chỉ website công khai có domain"), true;
      return send(200, { maxOriginsPerTenant: MAX_DOMAINS, domains: app.domains }), true;
    }
    if (method === "POST" && !subId) {
      if (!requireKey(KEYS.addDomain)) return true;
      if (!app) return notFound();
      if (app.kind !== "PUBLIC_SITE") return err(send, 409, "KIND_MISMATCH", "Chỉ website công khai có domain"), true;
      if (app.status !== "ACTIVE") return err(send, 409, "APPLICATION_NOT_ACTIVE", "Ứng dụng không hoạt động"), true;
      const r = normalize(body?.origin);
      if (r.reason) return err(send, 400, "ORIGIN_INVALID", "Origin không hợp lệ", [r.reason]), true;
      // Trùng toàn hệ thống: không lộ tenant chủ (không có details tenantId).
      if (ownerOfOrigin(r.origin)) return err(send, 409, "ORIGIN_DUPLICATED", "Origin đã tồn tại"), true;
      if (apps.reduce((n, a) => n + a.domains.length, 0) >= MAX_DOMAINS) return err(send, 409, "ORIGIN_LIMIT_EXCEEDED", "Quá số origin tối đa"), true;
      const d = { id: uuid(), origin: r.origin, enabled: true, createdAt: nowIso(), createdBy: "admin-id", updatedAt: nowIso(), updatedBy: "admin-id" };
      app.domains.push(d);
      history(app, "DOMAIN_ADDED", `origin=${r.origin}`);
      return send(201, d), true;
    }
    if (method === "DELETE" && subId) {
      if (!requireKey(KEYS.removeDomain)) return true;
      if (!app) return notFound();
      const d = app.domains.find((x) => x.id === subId);
      if (!d) return err(send, 404, "APPLICATION_DOMAIN_NOT_FOUND", "Không có domain"), true;
      app.domains = app.domains.filter((x) => x !== d);
      history(app, "DOMAIN_REMOVED", `origin=${d.origin}`);
      return send(204), true;
    }
  }

  if (sub === "history" && method === "GET") {
    if (!requireKey(KEYS.history)) return true;
    if (!app) return notFound();
    return send(200, app.history.slice(0, 200)), true;
  }

  return false;
}
