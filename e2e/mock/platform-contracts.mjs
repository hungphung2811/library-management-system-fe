// Mock hợp đồng thuê dịch vụ (ADR-0012): /api/platform/tenants/{id}/contracts, /api/platform/contracts/**,
// và phía tenant admin chỉ đọc /api/contracts, /api/contracts/current (khóa TenantContractController/list|current).
// Hợp đồng theo docs/api/platform-contracts.md và tenant-contracts.md của repo BE. Trạng thái trong bộ nhớ, dùng chung giữa các worker:
// test tạo đơn vị riêng (platform-tenants.mjs) nên không đụng hợp đồng của nhau. Ngày tính theo giờ Việt Nam.
import { TENANTS as BASE_TENANTS, USERS } from "./data.mjs";
import { tenantById } from "./platform-tenants.mjs";

const KEY_LIST = "TenantContractController/list";
const KEY_CURRENT = "TenantContractController/current";
const GRACE_DAYS = 7;
const MODULES = ["LENDING", "SALES"];
const err = (send, status, code, message) => send(status, { code, message });
let seq = 5000;
const uuid = () => `c0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const nowIso = () => new Date().toISOString();

const ymd = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
const today = () => ymd(new Date());
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const CONTRACTS = new Map(); // id -> contract
const PAYMENTS = new Map(); // contractId -> payment[]
const HISTORY = new Map(); // contractId -> entry[]

const log = (c, type, data) => {
  const list = HISTORY.get(c.id) ?? [];
  list.unshift({ id: uuid(), type, contractId: c.id, actorType: "USER", actorId: "platform-id", occurredAt: nowIso(), data: data ?? null });
  HISTORY.set(c.id, list);
};

function addContract(tenantId, o) {
  const c = {
    id: uuid(), tenantId, name: o.name, status: o.status ?? "DRAFT", legacy: false, modules: o.modules,
    startDate: o.startDate, endDate: o.endDate, totalAmount: o.totalAmount, billingCycle: o.billingCycle ?? null,
    internalNote: o.internalNote ?? null, modulesAppliedAt: null, retainedModule: null, cancelReason: null,
    createdAt: nowIso(), updatedAt: nowIso(), version: 1,
  };
  CONTRACTS.set(c.id, c);
  PAYMENTS.set(c.id, []);
  log(c, "CREATED");
  return c;
}

const paid = (c) => (PAYMENTS.get(c.id) ?? []).reduce((n, p) => n + p.amount, 0);
function phaseOf(c) {
  if (c.status !== "ACTIVE") return null;
  const t = today();
  if (t < c.startDate) return "UPCOMING";
  if (c.endDate && t > c.endDate) return "IN_GRACE";
  return "IN_EFFECT";
}
const graceEnds = (c) => (c.endDate ? addDays(c.endDate, GRACE_DAYS) : null);
const view = (c) => ({
  ...c,
  phase: phaseOf(c),
  inGrace: phaseOf(c) === "IN_GRACE",
  graceEndsDate: graceEnds(c),
  paidAmount: paid(c),
  outstandingAmount: c.totalAmount - paid(c),
});
const detail = (c) => ({ ...view(c), payments: [...(PAYMENTS.get(c.id) ?? [])].reverse() });
const tenantView = (c) => {
  const v = view(c);
  return {
    id: v.id, name: v.name, status: v.status, phase: v.phase, inGrace: v.inGrace, graceEndsDate: v.graceEndsDate,
    modules: v.modules, startDate: v.startDate, endDate: v.endDate,
    totalAmount: v.totalAmount, paidAmount: v.paidAmount, outstandingAmount: v.outstandingAmount, billingCycle: v.billingCycle,
  };
};
const forTenant = (tenantId) => [...CONTRACTS.values()].filter((c) => c.tenantId === tenantId).reverse();

// Seed phía tenant admin (đơn vị `main` của `admin`): hợp đồng còn 10 ngày (để thấy banner) và một hợp đồng đã hết hạn.
const TENANT_MAIN = BASE_TENANTS[0].id;
const TENANT_NONE = "33333333-3333-4333-8333-333333333333"; // đơn vị chưa có hợp đồng
addContract(TENANT_MAIN, { name: "Gói 2025", status: "EXPIRED", modules: ["LENDING"], startDate: addDays(today(), -730), endDate: addDays(today(), -366), totalAmount: 6_000_000 });
const cur = addContract(TENANT_MAIN, {
  name: "Gói chuẩn 2026", status: "ACTIVE", modules: ["LENDING", "SALES"], startDate: addDays(today(), -355), endDate: addDays(today(), 10),
  totalAmount: 12_000_000, internalNote: "Ghi chú nội bộ không được lộ", billingCycle: { unit: "MONTH", value: 12 },
});
PAYMENTS.get(cur.id).push({ id: uuid(), paidOn: addDays(today(), -300), amount: 8_000_000, reference: "CK-001", note: "Đợt 1", reversesPaymentId: null, reversedByPaymentId: null, recordedBy: "platform-id", recordedAt: nowIso() });

// Tài khoản quản trị của đơn vị chưa có hợp đồng.
USERS.nocontract = { id: "nocontract-id", roles: ["SUPER_ADMIN"], permissions: [], admin: true, password: "Nocontract@12345", tenantId: TENANT_NONE, tenants: [TENANT_NONE] };

const validate = (b, { needModules }) => {
  if (needModules) {
    if (!Array.isArray(b.modules) || b.modules.length === 0) return ["INVALID_MODULES", "Module rỗng"];
    if (b.modules.some((m) => !MODULES.includes(m))) return ["UNKNOWN_MODULE", "Module lạ"];
  }
  return null;
};
const invalid = (b, { renewNoStart } = {}) => {
  if (!b.name || !String(b.name).trim()) return true;
  if (!b.endDate) return true;
  if (b.startDate && b.endDate < b.startDate) return true;
  if (typeof b.totalAmount !== "number" || !Number.isInteger(b.totalAmount) || b.totalAmount < 0) return true;
  if (!renewNoStart && !b.startDate) return true;
  return false;
};
const overlaps = (c, start, end, exceptId) =>
  forTenant(c.tenantId).some((o) => o.id !== exceptId && o.status === "ACTIVE" && !o.legacy && (!o.endDate || o.endDate >= start) && o.startDate <= end);

function applyModules(c) {
  const t = tenantById(c.tenantId);
  c.modulesAppliedAt = nowIso();
  if (t) {
    for (const m of c.modules) t.modules.add(m);
    if (t.status === "SUSPENDED" && t.suspensionCause === "CONTRACT_EXPIRED") {
      t.status = "ACTIVE";
      t.suspensionCause = undefined;
    }
  }
  log(c, "MODULES_APPLIED", { tenantReactivated: false });
}

export function handle({ method, url, body, caller, send, requireKey }) {
  const p = url.pathname;
  let m;

  // ----- tenant admin, chỉ đọc -----
  if (method === "GET" && (p === "/api/contracts" || p === "/api/contracts/current")) {
    if (!requireKey(p === "/api/contracts" ? KEY_LIST : KEY_CURRENT)) return true;
    const tenantId = USERS[caller].tenantId;
    if (!tenantId) return err(send, 403, "TENANT_REQUIRED", "Thiếu tenant"), true;
    const mine = forTenant(tenantId).filter((c) => c.status !== "DRAFT");
    if (p === "/api/contracts") return send(200, mine.map(tenantView)), true;
    const now = mine.find((c) => ["IN_EFFECT", "IN_GRACE"].includes(phaseOf(c)));
    return now ? send(200, tenantView(now)) : err(send, 404, "CONTRACT_NOT_FOUND", "Chưa có hợp đồng hiệu lực"), true;
  }

  if (!p.startsWith("/api/platform/") || !(p.includes("/contracts"))) return false;
  if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true;
  if (!USERS[caller].platformAdmin) return err(send, 403, "FORBIDDEN", "Chỉ platform admin"), true;

  if (method === "GET" && p === "/api/platform/contracts/expiring") {
    const within = Number(url.searchParams.get("withinDays") ?? 30);
    if (!Number.isInteger(within) || within < 1 || within > 365) return err(send, 400, "INVALID_CONTRACT", "withinDays 1..365"), true;
    const items = [...CONTRACTS.values()]
      .filter((c) => c.status === "ACTIVE" && !c.legacy && c.endDate)
      .map((c) => ({ c, left: daysBetween(today(), c.endDate) }))
      .filter(({ c, left }) => phaseOf(c) === "IN_GRACE" || (left >= 0 && left <= within))
      .sort((a, b) => a.left - b.left)
      .map(({ c, left }) => {
        const t = tenantById(c.tenantId) ?? BASE_TENANTS.find((x) => x.id === c.tenantId);
        return {
          contractId: c.id, tenantId: c.tenantId, tenantCode: t?.code ?? "", tenantName: t?.name ?? "", name: c.name, endDate: c.endDate,
          daysLeft: left, inGrace: phaseOf(c) === "IN_GRACE", graceEndsDate: graceEnds(c), outstandingAmount: c.totalAmount - paid(c),
        };
      });
    return send(200, items), true;
  }

  if ((m = p.match(/^\/api\/platform\/tenants\/([^/]+)\/contracts$/))) {
    const t = tenantById(m[1]);
    if (!t) return err(send, 404, "TENANT_NOT_FOUND", "Không có đơn vị"), true;
    if (method === "GET") {
      return send(200, { contracts: forTenant(t.id).map(view), enabledModules: MODULES.filter((x) => t.modules.has(x)), modulesOutsideContract: [] }), true;
    }
    if (method === "POST") {
      const bad = validate(body, { needModules: true });
      if (bad) return err(send, 400, bad[0], bad[1]), true;
      if (invalid(body)) return err(send, 400, "INVALID_CONTRACT", "Hợp đồng chưa hợp lệ"), true;
      return send(201, view(addContract(t.id, body))), true;
    }
  }

  if ((m = p.match(/^\/api\/platform\/contracts\/([^/]+)(?:\/(.*))?$/))) {
    const c = CONTRACTS.get(m[1]);
    if (!c) return err(send, 404, "CONTRACT_NOT_FOUND", "Không có hợp đồng"), true;
    const rest = m[2] ?? "";
    const bump = () => ((c.version += 1), (c.updatedAt = nowIso()));

    if (rest === "" && method === "GET") return send(200, detail(c)), true;
    if (rest === "history" && method === "GET") return send(200, HISTORY.get(c.id) ?? []), true;
    if (rest === "" && method === "PUT") {
      if (body.version !== c.version) return err(send, 409, "CONTRACT_VERSION_CONFLICT", "Phiên bản cũ"), true;
      if (c.status === "EXPIRED" || c.status === "CANCELLED") return err(send, 409, "CONTRACT_NOT_EDITABLE", "Không sửa được"), true;
      if (c.status === "ACTIVE") {
        const same = body.name === c.name && body.startDate === c.startDate && body.endDate === c.endDate && body.totalAmount === c.totalAmount
          && JSON.stringify(body.modules) === JSON.stringify(c.modules);
        if (!same) return err(send, 409, "CONTRACT_NOT_EDITABLE", "Hợp đồng hiệu lực chỉ sửa ghi chú"), true;
        c.internalNote = body.internalNote ?? null;
      } else {
        const bad = validate(body, { needModules: true });
        if (bad) return err(send, 400, bad[0], bad[1]), true;
        if (invalid(body)) return err(send, 400, "INVALID_CONTRACT", "Hợp đồng chưa hợp lệ"), true;
        Object.assign(c, { name: body.name, modules: body.modules, startDate: body.startDate, endDate: body.endDate, totalAmount: body.totalAmount, billingCycle: body.billingCycle ?? null, internalNote: body.internalNote ?? null });
      }
      bump();
      log(c, "UPDATED");
      return send(200, view(c)), true;
    }
    if (rest === "activate" && method === "POST") {
      if (c.status !== "DRAFT") return err(send, 409, "CONTRACT_NOT_EDITABLE", "Chỉ kích hoạt hợp đồng nháp"), true;
      if (overlaps(c, c.startDate, c.endDate, c.id)) return err(send, 409, "CONTRACT_OVERLAP", "Chồng hợp đồng khác"), true;
      c.status = "ACTIVE";
      bump();
      log(c, "ACTIVATED");
      if (c.startDate <= today()) applyModules(c);
      return send(200, view(c)), true;
    }
    if (rest === "extend" && method === "POST") {
      if (body.version !== c.version) return err(send, 409, "CONTRACT_VERSION_CONFLICT", "Phiên bản cũ"), true;
      if (c.status !== "ACTIVE" || c.legacy) return err(send, 409, "CONTRACT_NOT_EDITABLE", "Không kéo dài được"), true;
      if (!body.endDate || body.endDate <= c.endDate) return err(send, 400, "INVALID_CONTRACT", "Ngày mới phải sau ngày hiện tại"), true;
      if (overlaps(c, c.startDate, body.endDate, c.id)) return err(send, 409, "CONTRACT_OVERLAP", "Chồng hợp đồng khác"), true;
      c.endDate = body.endDate;
      bump();
      log(c, "EXTENDED", { endDate: body.endDate });
      return send(200, view(c)), true;
    }
    if (rest === "cancel" && method === "POST") {
      if (!body.reason || !String(body.reason).trim()) return err(send, 400, "INVALID_CONTRACT", "Thiếu lý do"), true;
      if (c.status !== "DRAFT" && c.status !== "ACTIVE") return err(send, 409, "CONTRACT_NOT_EDITABLE", "Không hủy được"), true;
      c.status = "CANCELLED";
      c.cancelReason = String(body.reason).trim();
      bump();
      log(c, "CANCELLED", { reason: c.cancelReason });
      return send(200, view(c)), true;
    }
    if (rest === "renew" && method === "POST") {
      if (c.status !== "ACTIVE" && c.status !== "EXPIRED") return err(send, 409, "CONTRACT_NOT_EDITABLE", "Không gia hạn được"), true;
      const startDate = body.startDate ?? (c.endDate ? addDays(c.endDate, 1) : null);
      const merged = { ...body, startDate, name: body.name ?? c.name };
      if (invalid(merged)) return err(send, 400, "INVALID_CONTRACT", "Hợp đồng chưa hợp lệ"), true;
      return send(201, view(addContract(c.tenantId, { ...merged, modules: c.modules }))), true;
    }
    if (rest === "payments" && method === "POST") {
      if (c.status === "DRAFT") return err(send, 409, "PAYMENT_NOT_ALLOWED", "Hợp đồng nháp"), true;
      if (!body.paidOn || typeof body.amount !== "number" || !(body.amount > 0)) return err(send, 400, "INVALID_PAYMENT", "Thanh toán sai"), true;
      const pay = { id: uuid(), paidOn: body.paidOn, amount: body.amount, reference: body.reference ?? null, note: body.note ?? null, reversesPaymentId: null, reversedByPaymentId: null, recordedBy: "platform-id", recordedAt: nowIso() };
      PAYMENTS.get(c.id).push(pay);
      log(c, "PAYMENT_RECORDED", { amount: pay.amount });
      return send(201, pay), true;
    }
    let r;
    if ((r = rest.match(/^payments\/([^/]+)\/reverse$/)) && method === "POST") {
      const list = PAYMENTS.get(c.id);
      const orig = list.find((x) => x.id === r[1]);
      if (!orig) return err(send, 404, "PAYMENT_NOT_FOUND", "Không có thanh toán"), true;
      if (orig.reversesPaymentId) return err(send, 409, "PAYMENT_NOT_REVERSIBLE", "Không đảo dòng đảo"), true;
      if (orig.reversedByPaymentId) return err(send, 409, "PAYMENT_ALREADY_REVERSED", "Đã đảo"), true;
      const rev = { id: uuid(), paidOn: today(), amount: -orig.amount, reference: orig.reference, note: body.note ?? null, reversesPaymentId: orig.id, reversedByPaymentId: null, recordedBy: "platform-id", recordedAt: nowIso() };
      orig.reversedByPaymentId = rev.id;
      list.push(rev);
      log(c, "PAYMENT_REVERSED", { amount: rev.amount });
      return send(201, rev), true;
    }
  }
  return false;
}

export { TENANT_MAIN, TENANT_NONE };
