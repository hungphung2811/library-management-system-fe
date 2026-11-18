// Mock của zone admin: /api/users* (ghi), /api/auth/credentials, /api/roles*, /api/permissions*, /api/access/*,
// /api/departments*, /api/audit-logs*. GET /api/users, /api/users/{id}, .../reader-profile do e2e/mock/common.mjs trả
// (đọc từ DIRECTORY/READER_PROFILES của data.mjs); module này ghi thẳng vào hai mảng đó để GET sau thấy dữ liệu mới.
// Trạng thái nằm trong bộ nhớ, dùng chung cho 2 worker: test dùng tên/mã riêng, không giả định số lượng bản ghi.
import { DIRECTORY, READER_PROFILES } from "./data.mjs";

/** Khóa quyền admin (khớp packages/api/src/permissions.ts). data.mjs chưa có các khóa này; user mock không phải admin chỉ có LIST_ROLES (staff) hoặc USER_SEARCH + READER_VIEW (librarian). */
const K = {
  LIST_ROLES: "AccessControlController/listRoles",
  ROLE_VIEW: "AccessControlController/getRole",
  ROLE_CREATE: "AccessControlController/createRole",
  ROLE_GRANT: "AccessControlController/grantPermission",
  ROLE_REVOKE: "AccessControlController/revokePermission",
  PERMISSION_LIST: "AccessControlController/listPermissions",
  PERMISSION_CREATE: "AccessControlController/createPermission",
  ACCESS_VIEW: "AccessControlController/getUserAccess",
  ACCESS_ASSIGN: "AccessControlController/assignRole",
  ACCESS_REVOKE: "AccessControlController/revokeRole",
  USER_CREATE: "UserController/create",
  USER_UPDATE: "UserController/update",
  USER_STATUS: "UserController/changeStatus",
  USER_RESET: "UserController/resetPassword",
  ROLE_UPDATE: "AccessControlController/updateRole",
  ROLE_DELETE: "AccessControlController/deleteRole",
  CREDENTIAL_CREATE: "AuthController/register",
  READER_ISSUE: "ReaderProfileController/issue",
  READER_UPDATE: "ReaderProfileController/update",
  READER_RENEW: "ReaderProfileController/renew",
  READER_STATUS: "ReaderProfileController/changeStatus",
  DEPT_LIST: "DepartmentController/list",
  DEPT_TREE: "DepartmentController/tree",
  DEPT_CREATE: "DepartmentController/create",
  DEPT_UPDATE: "DepartmentController/update",
  DEPT_STATUS: "DepartmentController/changeStatus",
  AUDIT_SEARCH: "AuditLogController/search",
};

// Tên vai trò cố ý không chứa "MEMBER"/"SUPER_ADMIN" ngoài hai vai trò gốc (test cũ tìm ô theo tên con).
const ROLES = [
  { id: "1", name: "SUPER_ADMIN", description: "Quản trị toàn hệ thống", isAdmin: true, permissions: [] },
  { id: "2", name: "MEMBER", description: "Thành viên thư viện", isAdmin: false, permissions: [] },
  { id: "3", name: "CATALOGER", description: "Biên mục sách", isAdmin: false, permissions: ["TitleController/search"] },
];

const PERMISSIONS = [
  { code: "TitleController/search", description: "Tìm sách", source: "AUTO", service: "catalog", httpMethod: "GET", pathPattern: "/api/books" },
  { code: "TitleController/create", description: "Thêm sách", source: "AUTO", service: "catalog", httpMethod: "POST", pathPattern: "/api/books" },
  { code: "BookCopyController/add", description: "Thêm bản sao", source: "AUTO", service: "catalog", httpMethod: "POST", pathPattern: "/api/book-copies" },
  { code: "BorrowingController/borrow", description: "Lập phiếu mượn", source: "AUTO", service: "circulation", httpMethod: "POST", pathPattern: "/api/borrowings" },
  { code: "ReservationController/reserve", description: "Đặt trước", source: "AUTO", service: "circulation", httpMethod: "POST", pathPattern: "/api/reservations" },
  { code: "ReportController/exportAll", description: "Xuất báo cáo", source: "AUTO", service: "report", httpMethod: "GET", pathPattern: "/api/reports" },
  { code: "AccessControlController/listRoles", description: "Xem danh sách vai trò", source: "AUTO", service: "identity", httpMethod: "GET", pathPattern: "/api/roles" },
].map((p) => ({ ...p, firstSeenAt: "2026-11-01T08:00:00" }));

/** userId -> Set<roleId> */
const USER_ROLES = new Map();
/** Lịch sử đặt lại mật khẩu (chỉ độ dài, không lưu mật khẩu) để test kiểm tra đã gọi. */
const RESETS = [];
/** userId -> username đã được tạo credential */
const CREDENTIALS = new Map();

const DEPARTMENTS = [
  { id: "dept-1", code: "KHOA-CNTT", name: "Khoa Công nghệ thông tin", parentId: null, status: "ACTIVE" },
  { id: "dept-2", code: "BM-HTTT", name: "Bộ môn Hệ thống thông tin", parentId: "dept-1", status: "ACTIVE" },
  { id: "dept-3", code: "KHOA-NN", name: "Khoa Ngoại ngữ", parentId: null, status: "INACTIVE" },
];
let deptSeq = 100;

const AUDIT = Array.from({ length: 45 }, (_, i) => {
  const n = 45 - i; // mới nhất trước
  const aggregateId = `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    id: `log-${n}`,
    eventId: `e0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    eventType: n % 3 === 0 ? "BorrowingCreated" : n % 3 === 1 ? "BookCopyAdded" : "UserCreated",
    aggregateId,
    occurredAt: `2026-11-${String(1 + (n % 28)).padStart(2, "0")}T09:${String(n % 60).padStart(2, "0")}:00`,
    recordedAt: `2026-11-${String(1 + (n % 28)).padStart(2, "0")}T09:${String(n % 60).padStart(2, "0")}:01`,
    payload: JSON.stringify({ seq: n, note: `sự kiện số ${n}` }),
  };
});

const id = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const cardValid = (r) => r.status === "ACTIVE" && r.cardExpiryDate >= today();

const USER_PERSONAL = ["phone", "dateOfBirth", "gender", "address", "avatarUrl", "jobTitle", "employeeCode"];
const READER_PERSONAL = ["phone", "dateOfBirth", "gender", "address", "faculty", "className", "memberCode", "cardIssuedDate"];
/** Ngữ nghĩa gộp của BE: trường vắng/null/rỗng thì giữ giá trị cũ. */
const mergePersonal = (target, body, keys) => {
  for (const k of keys) if (body[k] !== undefined && body[k] !== null && String(body[k]).trim() !== "") target[k] = body[k];
};
/** Kiểm tra giống BE (rút gọn) cho trường cá nhân; trả danh sách lỗi. */
function personalErrors(body) {
  const d = [];
  if (body.phone != null && (String(body.phone).length > 20 || !/^[0-9+\-\s]*$/.test(String(body.phone)))) d.push("phone: Số điện thoại không hợp lệ");
  if (body.dateOfBirth != null && (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) || body.dateOfBirth > today() || body.dateOfBirth < "1900-01-01")) d.push("dateOfBirth: Ngày sinh không hợp lệ");
  if (body.gender != null && !["MALE", "FEMALE", "OTHER"].includes(body.gender)) d.push("gender: MALE, FEMALE hoặc OTHER");
  if (body.avatarUrl != null && body.avatarUrl !== "" && !/^https?:\/\//i.test(body.avatarUrl)) d.push("avatarUrl: Phải bắt đầu bằng http:// hoặc https://");
  return d;
}

const roleView = (r) => ({ ...r, permissions: [...r.permissions] });

function tree(includeInactive) {
  const build = (parent) =>
    DEPARTMENTS.filter((d) => d.parentId === parent && (includeInactive || d.status === "ACTIVE")).map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      status: d.status,
      children: build(d.id),
    }));
  return build(null);
}

export function handle({ method, url, body, send, requireKey }) {
  const p = url.pathname;
  let m;
  const notFound = (message) => (send(404, { code: "NOT_FOUND", message }), true);
  const bad = (details, message = "Dữ liệu chưa hợp lệ") => (send(400, { code: "VALIDATION", message, details }), true);
  const conflict = (code, message) => (send(409, { code, message }), true);

  // ---- Người dùng (ghi) ----
  if (method === "POST" && p === "/api/users") {
    if (!requireKey(K.USER_CREATE)) return true;
    const details = [];
    const username = String(body.username ?? "").trim();
    if (username.length < 3 || username.length > 100) details.push("username: Từ 3 đến 100 ký tự");
    if (!String(body.fullName ?? "").trim()) details.push("fullName: Không được để trống");
    if (!/^\S+@\S+\.\S+$/.test(String(body.email ?? ""))) details.push("email: Email không hợp lệ");
    details.push(...personalErrors(body));
    if (details.length) return bad(details);
    if (DIRECTORY.some((u) => u.username === username)) return conflict("USERNAME_TAKEN", "Tên đăng nhập đã tồn tại");
    const u = {
      id: id(),
      username,
      fullName: String(body.fullName).trim(),
      email: body.email,
      departmentId: body.departmentId ?? null,
      status: "ACTIVE",
      phone: null, dateOfBirth: null, gender: null, address: null, avatarUrl: null, jobTitle: null, employeeCode: null,
    };
    mergePersonal(u, body, USER_PERSONAL);
    DIRECTORY.push(u);
    return send(201, u), true;
  }
  if (method === "POST" && p === "/api/auth/credentials") {
    if (!requireKey(K.CREDENTIAL_CREATE)) return true;
    const pw = String(body.password ?? "");
    if (pw.length < 8 || pw.length > 72) return bad(["password: Từ 8 đến 72 ký tự"]);
    if (!DIRECTORY.some((u) => u.id === body.userId)) return notFound("Không tìm thấy người dùng");
    if (CREDENTIALS.has(body.userId)) return conflict("CREDENTIAL_EXISTS", "Người dùng đã có tài khoản đăng nhập");
    CREDENTIALS.set(body.userId, body.username);
    return send(201, { userId: body.userId, username: body.username, mustChangePassword: body.mustChangePassword ?? true }), true;
  }
  if ((m = p.match(/^\/api\/users\/([^/]+)\/status$/)) && method === "PUT") {
    if (!requireKey(K.USER_STATUS)) return true;
    const u = DIRECTORY.find((x) => x.id === m[1]);
    if (!u) return notFound("Không tìm thấy người dùng");
    if (!["ACTIVE", "DISABLED"].includes(body.status)) return bad(["status: ACTIVE hoặc DISABLED"]);
    u.status = body.status;
    return send(200, u), true;
  }
  if ((m = p.match(/^\/api\/users\/([^/]+)$/)) && method === "PUT") {
    if (!requireKey(K.USER_UPDATE)) return true;
    const u = DIRECTORY.find((x) => x.id === m[1]);
    if (!u) return notFound("Không tìm thấy người dùng");
    const details = [];
    if (!String(body.fullName ?? "").trim()) details.push("fullName: Không được để trống");
    if (!/^\S+@\S+\.\S+$/.test(String(body.email ?? ""))) details.push("email: Email không hợp lệ");
    details.push(...personalErrors(body));
    if (details.length) return bad(details);
    mergePersonal(u, body, USER_PERSONAL);
    u.fullName = String(body.fullName).trim();
    u.email = body.email;
    u.departmentId = body.departmentId ?? null;
    return send(200, u), true;
  }

  // ---- Đặt lại mật khẩu (204, không trả mật khẩu) ----
  if ((m = p.match(/^\/api\/users\/([^/]+)\/password-reset$/)) && method === "POST") {
    if (!requireKey(K.USER_RESET)) return true;
    const u = DIRECTORY.find((x) => x.id === m[1]);
    if (!u) return send(404, { code: "USER_NOT_FOUND", message: "Không tìm thấy người dùng" }), true;
    const pw = String(body.temporaryPassword ?? "");
    if (pw.length < 8 || pw.length > 128) return bad(["temporaryPassword: Từ 8 đến 128 ký tự"]);
    if (String(u.username).startsWith("nocred")) return send(422, { code: "INVALID_USER", message: "Người dùng chưa có tài khoản đăng nhập" }), true;
    RESETS.push({ userId: u.id, length: pw.length });
    return send(204), true;
  }

  // ---- Hồ sơ độc giả (ghi; GET do common) ----
  if ((m = p.match(/^\/api\/users\/([^/]+)\/reader-profile$/)) && method === "POST") {
    if (!requireKey(K.READER_ISSUE)) return true;
    const u = DIRECTORY.find((x) => x.id === m[1]);
    if (!u) return notFound("Không tìm thấy người dùng");
    if (READER_PROFILES.some((r) => r.userId === u.id)) return conflict("READER_EXISTS", "Người dùng đã có hồ sơ độc giả");
    const details = [];
    if (!String(body.cardNo ?? "").trim()) details.push("cardNo: Không được để trống");
    if (!["STUDENT", "LECTURER"].includes(body.readerType)) details.push("readerType: STUDENT hoặc LECTURER");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.cardExpiryDate ?? ""))) details.push("cardExpiryDate: yyyy-MM-dd");
    else if (body.cardExpiryDate <= today()) details.push("cardExpiryDate: Phải sau hôm nay");
    details.push(...personalErrors(body));
    if (body.cardIssuedDate && body.cardIssuedDate > body.cardExpiryDate) details.push("cardIssuedDate: Không được sau hạn thẻ");
    if (details.length) return bad(details);
    const r = {
      phone: null, dateOfBirth: null, gender: null, address: null, faculty: null, className: null, memberCode: null, cardIssuedDate: null,
      userId: u.id,
      cardNo: String(body.cardNo).trim(),
      fullName: body.fullName ?? u.fullName,
      email: body.email ?? u.email,
      readerType: body.readerType,
      cardExpiryDate: body.cardExpiryDate,
      status: "ACTIVE",
      cardValid: true,
    };
    mergePersonal(r, body, READER_PERSONAL);
    READER_PROFILES.push(r);
    return send(201, r), true;
  }
  if ((m = p.match(/^\/api\/users\/([^/]+)\/reader-profile$/)) && method === "PUT") {
    if (!requireKey(K.READER_UPDATE)) return true;
    const r = READER_PROFILES.find((x) => x.userId === m[1]);
    if (!r) return notFound("Người dùng chưa có hồ sơ độc giả");
    const details = personalErrors(body);
    const issued = body.cardIssuedDate || r.cardIssuedDate;
    if (issued && issued > r.cardExpiryDate) details.push("cardIssuedDate: Không được sau hạn thẻ");
    if (details.length) return bad(details);
    mergePersonal(r, body, READER_PERSONAL);
    return send(200, r), true;
  }
  if ((m = p.match(/^\/api\/users\/([^/]+)\/reader-profile\/card-expiry$/)) && method === "PUT") {
    if (!requireKey(K.READER_RENEW)) return true;
    const r = READER_PROFILES.find((x) => x.userId === m[1]);
    if (!r) return notFound("Người dùng chưa có hồ sơ độc giả");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.newExpiryDate ?? "")) || body.newExpiryDate <= r.cardExpiryDate) {
      return bad(["newExpiryDate: Phải sau hạn hiện tại"]);
    }
    r.cardExpiryDate = body.newExpiryDate;
    r.cardValid = cardValid(r);
    return send(200, r), true;
  }
  if ((m = p.match(/^\/api\/users\/([^/]+)\/reader-profile\/status$/)) && method === "PUT") {
    if (!requireKey(K.READER_STATUS)) return true;
    const r = READER_PROFILES.find((x) => x.userId === m[1]);
    if (!r) return notFound("Người dùng chưa có hồ sơ độc giả");
    if (!["ACTIVE", "LOCKED"].includes(body.status)) return bad(["status: ACTIVE hoặc LOCKED"]);
    r.status = body.status;
    r.cardValid = cardValid(r);
    return send(200, r), true;
  }

  // ---- Vai trò và quyền ----
  if (p === "/api/roles" && method === "GET") {
    if (!requireKey(K.LIST_ROLES)) return true;
    return send(200, ROLES.map(roleView)), true;
  }
  if (p === "/api/roles" && method === "POST") {
    if (!requireKey(K.ROLE_CREATE)) return true;
    const details = [];
    const name = String(body.name ?? "").trim();
    if (!name) details.push("name: Không được để trống");
    if (!String(body.description ?? "").trim()) details.push("description: Không được để trống");
    if (details.length) return bad(details);
    if (ROLES.some((r) => r.name === name)) return conflict("ROLE_EXISTS", "Vai trò đã tồn tại");
    const r = { id: id(), name, description: String(body.description).trim(), isAdmin: body.isAdmin === true, permissions: [] };
    ROLES.push(r);
    return send(201, roleView(r)), true;
  }
  if ((m = p.match(/^\/api\/roles\/([^/]+)\/permissions\/(.+)$/)) && method === "DELETE") {
    if (!requireKey(K.ROLE_REVOKE)) return true;
    const r = ROLES.find((x) => x.id === m[1]);
    if (!r) return notFound("Không tìm thấy vai trò");
    const code = decodeURIComponent(m[2]);
    if (!r.permissions.includes(code)) return notFound("Vai trò chưa có quyền này");
    r.permissions = r.permissions.filter((c) => c !== code);
    return send(204), true;
  }
  if ((m = p.match(/^\/api\/roles\/([^/]+)\/permissions$/)) && method === "POST") {
    if (!requireKey(K.ROLE_GRANT)) return true;
    const r = ROLES.find((x) => x.id === m[1]);
    if (!r) return notFound("Không tìm thấy vai trò");
    const code = String(body.permissionCode ?? "");
    if (!PERMISSIONS.some((x) => x.code === code)) return notFound("Không tìm thấy quyền");
    if (!r.permissions.includes(code)) r.permissions.push(code);
    return send(200, roleView(r)), true;
  }
  if ((m = p.match(/^\/api\/roles\/([^/]+)$/)) && method === "PUT") {
    if (!requireKey(K.ROLE_UPDATE)) return true;
    const r = ROLES.find((x) => x.id === m[1]);
    if (!r) return notFound("Không tìm thấy vai trò");
    const name = String(body.name ?? "").trim();
    if (!name || !String(body.description ?? "").trim()) return bad(["name: Không được để trống"]);
    if (!/^[A-Z0-9_]+$/.test(name)) return send(422, { code: "INVALID_ACCESS_CONTROL", message: "Tên vai trò sai quy tắc" }), true;
    if (ROLES.some((x) => x.id !== r.id && x.name === name)) return conflict("DUPLICATE", "Tên vai trò đã tồn tại");
    r.name = name;
    r.description = String(body.description).trim();
    return send(200, roleView(r)), true;
  }
  if ((m = p.match(/^\/api\/roles\/([^/]+)$/)) && method === "DELETE") {
    if (!requireKey(K.ROLE_DELETE)) return true;
    const r = ROLES.find((x) => x.id === m[1]);
    if (!r) return notFound("Không tìm thấy vai trò");
    if ([...USER_ROLES.values()].some((s) => s.has(r.id))) return conflict("ROLE_IN_USE", "Vai trò đang được gán");
    if (r.isAdmin && ROLES.filter((x) => x.isAdmin).length <= 1) return conflict("LAST_ADMIN_ROLE", "Vai trò quản trị cuối cùng");
    ROLES.splice(ROLES.indexOf(r), 1);
    return send(204), true;
  }
  if ((m = p.match(/^\/api\/roles\/([^/]+)$/)) && method === "GET") {
    if (!requireKey(K.ROLE_VIEW)) return true;
    const r = ROLES.find((x) => x.id === m[1]);
    return r ? (send(200, roleView(r)), true) : notFound("Không tìm thấy vai trò");
  }
  if (p === "/api/permissions" && method === "GET") {
    if (!requireKey(K.PERMISSION_LIST)) return true;
    return send(200, PERMISSIONS), true;
  }
  if (p === "/api/permissions" && method === "POST") {
    if (!requireKey(K.PERMISSION_CREATE)) return true;
    const code = String(body.code ?? "").trim();
    if (!code) return bad(["code: Không được để trống"]);
    if (PERMISSIONS.some((x) => x.code === code)) return conflict("PERMISSION_EXISTS", "Khóa quyền đã tồn tại");
    const perm = { code, description: body.description ?? "", source: "MANUAL", service: "manual", firstSeenAt: new Date().toISOString() };
    PERMISSIONS.push(perm);
    return send(201, perm), true;
  }

  // ---- Gán vai trò cho người dùng ----
  if ((m = p.match(/^\/api\/access\/users\/([^/]+)\/roles\/([^/]+)$/)) && method === "DELETE") {
    if (!requireKey(K.ACCESS_REVOKE)) return true;
    USER_ROLES.get(m[1])?.delete(m[2]);
    return send(204), true;
  }
  if ((m = p.match(/^\/api\/access\/users\/([^/]+)\/roles$/)) && method === "POST") {
    if (!requireKey(K.ACCESS_ASSIGN)) return true;
    if (!ROLES.some((r) => r.id === body.roleId)) return notFound("Không tìm thấy vai trò");
    const set = USER_ROLES.get(m[1]) ?? new Set();
    set.add(body.roleId);
    USER_ROLES.set(m[1], set);
    return send(204), true;
  }
  if ((m = p.match(/^\/api\/access\/users\/([^/]+)$/)) && method === "GET") {
    if (!requireKey(K.ACCESS_VIEW)) return true;
    const roles = ROLES.filter((r) => USER_ROLES.get(m[1])?.has(r.id));
    return send(200, {
      userId: m[1],
      roles: roles.map((r) => r.name),
      permissions: [...new Set(roles.flatMap((r) => r.permissions))],
      admin: roles.some((r) => r.isAdmin),
    }), true;
  }

  // ---- Phòng ban ----
  if (p === "/api/departments/tree" && method === "GET") {
    if (!requireKey(K.DEPT_TREE)) return true;
    return send(200, tree(url.searchParams.get("includeInactive") === "true")), true;
  }
  if (p === "/api/departments" && method === "GET") {
    if (!requireKey(K.DEPT_LIST)) return true;
    const status = url.searchParams.get("status");
    return send(200, DEPARTMENTS.filter((d) => !status || d.status === status)), true;
  }
  if (p === "/api/departments" && method === "POST") {
    if (!requireKey(K.DEPT_CREATE)) return true;
    const details = [];
    const code = String(body.code ?? "").trim();
    if (!code || code.length > 50) details.push("code: Từ 1 đến 50 ký tự");
    if (!String(body.name ?? "").trim()) details.push("name: Không được để trống");
    if (details.length) return bad(details);
    if (DEPARTMENTS.some((d) => d.code === code)) return conflict("DEPARTMENT_CODE_TAKEN", "Mã phòng ban đã tồn tại");
    const d = { id: `dept-${++deptSeq}`, code, name: String(body.name).trim(), parentId: body.parentId ?? null, status: "ACTIVE" };
    DEPARTMENTS.push(d);
    return send(201, d), true;
  }
  if ((m = p.match(/^\/api\/departments\/([^/]+)\/status$/)) && method === "PUT") {
    if (!requireKey(K.DEPT_STATUS)) return true;
    const d = DEPARTMENTS.find((x) => x.id === m[1]);
    if (!d) return notFound("Không tìm thấy phòng ban");
    if (!["ACTIVE", "INACTIVE"].includes(body.status)) return bad(["status: ACTIVE hoặc INACTIVE"]);
    d.status = body.status;
    return send(200, d), true;
  }
  if ((m = p.match(/^\/api\/departments\/([^/]+)$/)) && method === "PUT") {
    if (!requireKey(K.DEPT_UPDATE)) return true;
    const d = DEPARTMENTS.find((x) => x.id === m[1]);
    if (!d) return notFound("Không tìm thấy phòng ban");
    if (!String(body.name ?? "").trim()) return bad(["name: Không được để trống"]);
    if (body.parentId === d.id) return bad(["parentId: Không thể chọn chính nó làm cha"]);
    d.name = String(body.name).trim();
    d.parentId = body.parentId ?? null;
    return send(200, d), true;
  }

  // ---- Nhật ký ----
  if (p === "/api/audit-logs" && method === "GET") {
    if (!requireKey(K.AUDIT_SEARCH)) return true;
    const agg = url.searchParams.get("aggregateId");
    const type = url.searchParams.get("eventType");
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 20);
    const all = AUDIT.filter((l) => (!agg || l.aggregateId === agg) && (!type || l.eventType === type));
    return send(200, { items: all.slice(page * size, page * size + size), total: all.length, page, size }), true;
  }

  return false;
}
