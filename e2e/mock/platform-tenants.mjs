// Mock của quản trị đơn vị nền tảng: /api/platform/organizations*, /api/platform/tenants* (kể cả admins, members, modules)
// và GET /api/users?tenantId= dành cho platform admin (lọc xuyên đơn vị, ADR-0008).
// Hợp đồng theo identity-service (PlatformTenantController, PlatformOrganizationController, PlatformTenantModuleController)
// và docs/api/platform-tenant-modules.md. Trạng thái trong bộ nhớ, dùng chung giữa các worker: test tạo dữ liệu riêng
// (mã/tên có hậu tố duy nhất) và không giả định tổng số bản ghi.
import { USERS } from "./data.mjs";

const MODULES = ["LENDING", "SALES"];
const err = (send, status, code, message, details) => send(status, { code, message, ...(details ? { details } : {}) });
const uuid = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let seq = 1000;
const now = () => new Date().toISOString();

const ORGS = new Map();
const TENANTS = new Map();
const PEOPLE = new Map(); // userId -> { id, username, fullName, email, status }

const addOrg = (name) => {
  const o = { id: uuid(++seq), name, createdAt: now() };
  ORGS.set(o.id, o);
  return o;
};
const addPerson = (username, fullName) => {
  const p = { id: uuid(++seq), username, fullName, email: `${username}@example.vn`, status: "ACTIVE" };
  PEOPLE.set(p.id, p);
  return p;
};
const addTenant = ({ code, name, organizationId = null, status = "ACTIVE", modules = ["LENDING"], admins = [], members = [] }) => {
  const t = { id: uuid(++seq), code, name, organizationId, status, modules: new Set(modules), moduleMeta: new Map(), admins: [...admins], members: new Set([...members, ...admins]) };
  TENANTS.set(t.id, t);
  return t;
};

// Seed cố định (test đọc theo tên) + 24 đơn vị để kiểm phân trang.
export const ORG_SEED = addOrg("Trường Seed");
const ORG_OTHER = addOrg("Hệ thống Khác");
const seedAdmin = addPerson("seedadmin", "Quản trị Seed");
export const TENANT_SEED = addTenant({
  code: "seed-lib", name: "Thư viện Seed", organizationId: ORG_SEED.id, modules: ["LENDING", "SALES"], admins: [seedAdmin.id],
});
addTenant({ code: "seed-off", name: "Thư viện Ngưng", organizationId: ORG_OTHER.id, status: "SUSPENDED" }).suspensionCause = "CONTRACT_EXPIRED";
for (let i = 1; i <= 24; i++) {
  addTenant({ code: `bulk-${String(i).padStart(2, "0")}`, name: `Đơn vị hàng loạt ${String(i).padStart(2, "0")}`, organizationId: i % 2 ? ORG_OTHER.id : null });
}

const view = (t) => ({
  id: t.id, code: t.code, name: t.name, organizationId: t.organizationId, status: t.status,
  memberCount: t.members.size, modules: MODULES.filter((m) => t.modules.has(m)),
  suspensionCause: t.status === "SUSPENDED" ? (t.suspensionCause ?? "MANUAL") : null,
});
const detail = (t) => ({ ...view(t), adminUserIds: t.admins });
const modView = (t) => MODULES.map((m) => ({ module: m, enabled: t.modules.has(m), updatedAt: t.moduleMeta.get(m)?.at ?? null, updatedBy: t.moduleMeta.get(m)?.by ?? null }));
const pageOf = (items, sp) => {
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
  return { items: items.slice(page * size, page * size + size), total: items.length, page, size };
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createAdmin(body, send) {
  const d = [];
  if (body.newAdmin && body.existingUserId) return err(send, 422, "INVALID_TENANT", "Chỉ một trong newAdmin hoặc existingUserId"), null;
  if (!body.newAdmin && !body.existingUserId) return err(send, 422, "INVALID_TENANT", "Thiếu quản trị viên"), null;
  if (body.existingUserId) {
    if (!PEOPLE.has(body.existingUserId)) return err(send, 404, "ACCOUNT_NOT_FOUND", "Không có tài khoản"), null;
    return body.existingUserId;
  }
  const a = body.newAdmin;
  if (!a.username || a.username.length < 3) d.push("newAdmin.username: từ 3 ký tự");
  if (!a.temporaryPassword || a.temporaryPassword.length < 8) d.push("newAdmin.temporaryPassword: từ 8 ký tự");
  if (d.length) return err(send, 400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", d), null;
  if ([...PEOPLE.values()].some((p) => p.username === a.username)) return err(send, 409, "ACCOUNT_EXISTS", "Tên đăng nhập đã tồn tại"), null;
  return addPerson(a.username, a.fullName).id;
}

export function handle({ method, url, body, caller, send }) {
  const p = url.pathname;

  // Người dùng của một đơn vị (chỉ platform admin có tenantId trong query; tenant admin vẫn do admin.mjs xử lý).
  if (method === "GET" && p === "/api/users" && url.searchParams.get("tenantId") && caller && USERS[caller].platformAdmin) {
    const t = TENANTS.get(url.searchParams.get("tenantId"));
    if (!t) return err(send, 404, "TENANT_NOT_FOUND", "Không có đơn vị"), true;
    const items = [...t.members].map((id) => PEOPLE.get(id)).filter(Boolean).map((u) => ({ ...u, tenantId: t.id, departmentId: null }));
    return send(200, pageOf(items, url.searchParams)), true;
  }

  if (!p.startsWith("/api/platform/")) return false;
  if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true;
  if (!USERS[caller].platformAdmin) return err(send, 403, "FORBIDDEN", "Chỉ platform admin"), true;
  let m;

  // ----- tổ chức -----
  if (p === "/api/platform/organizations") {
    if (method === "GET") return send(200, [...ORGS.values()]), true;
    if (method === "POST") {
      const name = String(body.name ?? "").trim();
      if (!name || name.length > 255) return err(send, 400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", ["name: bắt buộc, tối đa 255 ký tự"]), true;
      return send(201, addOrg(name)), true;
    }
  }
  if ((m = p.match(/^\/api\/platform\/organizations\/([^/]+)$/))) {
    const o = ORGS.get(m[1]);
    if (!o) return err(send, 404, "ORGANIZATION_NOT_FOUND", "Không có tổ chức"), true;
    if (method === "GET") return send(200, o), true;
    if (method === "PUT") {
      const name = String(body.name ?? "").trim();
      if (!name || name.length > 255) return err(send, 400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", ["name: bắt buộc, tối đa 255 ký tự"]), true;
      o.name = name;
      return send(200, o), true;
    }
  }

  // ----- đơn vị -----
  if (p === "/api/platform/tenants") {
    if (method === "GET") {
      const sp = url.searchParams;
      const kw = (sp.get("keyword") ?? "").trim().toLowerCase();
      const items = [...TENANTS.values()]
        .filter((t) => !kw || t.code.toLowerCase().includes(kw) || t.name.toLowerCase().includes(kw))
        .filter((t) => !sp.get("status") || t.status === sp.get("status"))
        .filter((t) => !sp.get("organizationId") || t.organizationId === sp.get("organizationId"))
        .map(view);
      return send(200, pageOf(items, sp)), true;
    }
    if (method === "POST") {
      const d = [];
      if (!body.code || body.code.length < 2 || body.code.length > 50) d.push("code: từ 2 đến 50 ký tự");
      if (!body.name || body.name.length > 255) d.push("name: bắt buộc, tối đa 255 ký tự");
      if (d.length) return err(send, 400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", d), true;
      const mods = body.modules ?? ["LENDING"];
      if (!Array.isArray(mods) || mods.length === 0) return err(send, 400, "INVALID_MODULES", "Module không hợp lệ"), true;
      if (mods.some((x) => !MODULES.includes(String(x).toUpperCase()))) return err(send, 400, "UNKNOWN_MODULE", "Module lạ"), true;
      if ([...TENANTS.values()].some((t) => t.code === body.code)) return err(send, 409, "DUPLICATE_TENANT", "Mã đã dùng"), true;
      if (body.organizationId && !ORGS.has(body.organizationId)) return err(send, 404, "ORGANIZATION_NOT_FOUND", "Không có tổ chức"), true;
      const adminId = createAdmin(body, send);
      if (!adminId) return true;
      const t = addTenant({ code: body.code, name: body.name, organizationId: body.organizationId ?? null, modules: mods.map((x) => String(x).toUpperCase()), admins: [adminId] });
      return send(201, view(t)), true;
    }
  }
  if ((m = p.match(/^\/api\/platform\/tenants\/([^/]+)(?:\/(.*))?$/))) {
    const t = TENANTS.get(m[1]);
    if (!t) return err(send, 404, "TENANT_NOT_FOUND", "Không có đơn vị"), true;
    const rest = m[2] ?? "";
    if (rest === "") {
      if (method === "GET") return send(200, detail(t)), true;
      if (method === "PUT") {
        if (!body.name || body.name.length > 255) return err(send, 400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", ["name: bắt buộc"]), true;
        if (body.organizationId && !ORGS.has(body.organizationId)) return err(send, 404, "ORGANIZATION_NOT_FOUND", "Không có tổ chức"), true;
        t.name = body.name;
        t.organizationId = body.organizationId ?? null;
        return send(200, view(t)), true;
      }
    }
    if (method === "POST" && (rest === "suspend" || rest === "activate")) {
      t.status = rest === "suspend" ? "SUSPENDED" : "ACTIVE";
      t.suspensionCause = rest === "suspend" ? "MANUAL" : undefined;
      return send(200, view(t)), true;
    }
    if (method === "POST" && rest === "admins") {
      const id = createAdmin(body, send);
      if (!id) return true;
      if (!t.admins.includes(id)) t.admins.push(id);
      t.members.add(id);
      return send(201, { userId: id }), true;
    }
    let a;
    if (method === "DELETE" && (a = rest.match(/^admins\/([^/]+)$/))) {
      t.admins = t.admins.filter((x) => x !== a[1]);
      return send(204), true;
    }
    if (method === "POST" && rest === "members") {
      if (!body.userId || !UUID.test(body.userId)) return err(send, 400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", ["userId: bắt buộc"]), true;
      if (!PEOPLE.has(body.userId)) return err(send, 404, "ACCOUNT_NOT_FOUND", "Không có tài khoản"), true;
      t.members.add(body.userId);
      return send(204), true;
    }
    if (method === "GET" && rest === "modules") return send(200, modView(t)), true;
    if ((a = rest.match(/^modules\/([^/]+)$/)) && (method === "PUT" || method === "DELETE")) {
      const mod = a[1].toUpperCase();
      if (!MODULES.includes(mod)) return err(send, 400, "UNKNOWN_MODULE", "Module lạ"), true;
      if (method === "DELETE" && t.modules.has(mod) && t.modules.size === 1) {
        return err(send, 409, "TENANT_MODULE_REQUIRED", "Phải còn ít nhất một module"), true;
      }
      if (method === "PUT" && !t.modules.has(mod)) (t.modules.add(mod), t.moduleMeta.set(mod, { at: now(), by: USERS[caller].id }));
      if (method === "DELETE" && t.modules.has(mod)) (t.modules.delete(mod), t.moduleMeta.set(mod, { at: now(), by: USERS[caller].id }));
      return send(200, modView(t).find((x) => x.module === mod)), true;
    }
  }
  return err(send, 404, "NOT_FOUND", "Không có endpoint này trong mock"), true;
}

// Chỉ trong mock: tạo bản ghi riêng cho từng test, tránh đua giữa các worker.
export const tenantById = (id) => TENANTS.get(id);
export const seedFor = { addOrg, addTenant, addPerson };
