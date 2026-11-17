// Mock origin website theo tenant (ADR-0013): /api/platform/tenants/{id}/storefront-origins (platform admin, 4 method)
// và GET /api/storefront-origins (tenant admin chỉ đọc, khóa TenantStorefrontOriginController/list).
// Hợp đồng theo docs/api/platform-storefront-origins.md và tenant-storefront-origins.md của repo BE. Trạng thái trong bộ nhớ,
// dùng chung giữa các worker: test tạo đơn vị riêng (platform-tenants.mjs) và dùng origin có hậu tố duy nhất.
import { TENANTS as BASE_TENANTS, USERS } from "./data.mjs";
import { tenantById } from "./platform-tenants.mjs";

const KEY_LIST = "TenantStorefrontOriginController/list";
const MAX = 10;
const err = (send, status, code, message, details) => send(status, { code, message, ...(details ? { details } : {}) });
let seq = 7000;
const uuid = () => `e0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const nowIso = () => new Date().toISOString();

const ORIGINS = new Map(); // tenantId -> origin[] (theo thứ tự tạo)

const add = (tenantId, origin, enabled = true) => {
  const o = { id: uuid(), origin, enabled, createdAt: nowIso(), createdBy: "platform-id", updatedAt: nowIso(), updatedBy: "platform-id" };
  ORIGINS.set(tenantId, [...(ORIGINS.get(tenantId) ?? []), o]);
  return o;
};
const ownerOf = (origin) => [...ORIGINS].find(([, list]) => list.some((o) => o.origin === origin))?.[0];

// Seed cho tenant admin (main = TENANT_A) chỉ đọc.
export const SEED_ORIGIN_ON = "https://shop.main.example.vn";
export const SEED_ORIGIN_OFF = "https://old.main.example.vn";
add(BASE_TENANTS[0].id, SEED_ORIGIN_ON, true);
add(BASE_TENANTS[0].id, SEED_ORIGIN_OFF, false);
add(BASE_TENANTS[1].id, "https://branch.example.vn", true);

// Kiểm đơn giản mô phỏng BE: trả [origin chuẩn hóa] hoặc mã lý do ORIGIN_INVALID.
function normalize(raw) {
  const v = String(raw ?? "").trim();
  if (!v || v.length > 300 || /\s/.test(v)) return { reason: "SYNTAX" };
  if (v.toLowerCase() === "null") return { reason: "NULL" };
  if (v.includes("*")) return { reason: "WILDCARD" };
  const m = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(v);
  if (!m || !["http", "https"].includes(m[1].toLowerCase())) return { reason: "SCHEME" };
  const scheme = m[1].toLowerCase();
  const rest = m[2].replace(/\/$/, "");
  if (/[/?#@]/.test(rest)) return { reason: "PATH" };
  const [host, port] = rest.split(":");
  if (!host) return { reason: "HOST" };
  if (port !== undefined && !(/^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) return { reason: "PORT" };
  if (scheme === "http" && !["localhost", "127.0.0.1"].includes(host.toLowerCase())) return { reason: "HTTP_NOT_ALLOWED" };
  const dflt = (scheme === "https" && port === "443") || (scheme === "http" && port === "80");
  return { origin: `${scheme}://${host.toLowerCase()}${port && !dflt ? `:${port}` : ""}` };
}

export function handle({ method, url, body, caller, send, requireKey }) {
  const p = url.pathname;
  let m;

  if (method === "GET" && p === "/api/storefront-origins") {
    if (!requireKey(KEY_LIST)) return true;
    const tenantId = USERS[caller].tenantId;
    if (!tenantId) return err(send, 403, "TENANT_REQUIRED", "Thiếu tenant"), true;
    return send(200, { origins: (ORIGINS.get(tenantId) ?? []).map(({ origin, enabled }) => ({ origin, enabled })) }), true;
  }

  if (!(m = p.match(/^\/api\/platform\/tenants\/([^/]+)\/storefront-origins(?:\/([^/]+))?$/))) return false;
  if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true;
  if (!USERS[caller].platformAdmin) return err(send, 403, "FORBIDDEN", "Chỉ platform admin"), true;
  const tenantId = m[1];
  if (!tenantById(tenantId) && !BASE_TENANTS.some((t) => t.id === tenantId)) return err(send, 404, "TENANT_NOT_FOUND", "Không có đơn vị"), true;
  const list = ORIGINS.get(tenantId) ?? [];

  if (!m[2]) {
    if (method === "GET") return send(200, { maxOrigins: MAX, origins: list }), true;
    if (method === "POST") {
      const r = normalize(body?.origin);
      if (r.reason) return err(send, 400, "ORIGIN_INVALID", "Origin không hợp lệ", [r.reason]), true;
      const owner = ownerOf(r.origin);
      if (owner) return err(send, 409, "ORIGIN_DUPLICATED", "Origin đã tồn tại", owner === tenantId ? undefined : [`tenantId=${owner}`]), true;
      if (list.length >= MAX) return err(send, 409, "ORIGIN_LIMIT_EXCEEDED", "Quá số origin tối đa"), true;
      return send(201, add(tenantId, r.origin)), true;
    }
    return false;
  }

  const o = list.find((x) => x.id === m[2]);
  if (!o) return err(send, 404, "STOREFRONT_ORIGIN_NOT_FOUND", "Không có origin"), true;
  if (method === "PUT") {
    if (typeof body?.enabled !== "boolean") return err(send, 400, "VALIDATION_ERROR", "Thiếu enabled"), true;
    if (o.enabled !== body.enabled) Object.assign(o, { enabled: body.enabled, updatedAt: nowIso() });
    return send(200, o), true;
  }
  if (method === "DELETE") {
    ORIGINS.set(tenantId, list.filter((x) => x !== o));
    return send(204), true;
  }
  return false;
}
