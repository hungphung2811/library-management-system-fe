// Mock cụm nhập Excel (ADR-0024): /api/{identity|catalog|sales}/imports/{type}[/{importId}[/rows|confirm|error-file|credentials]]
// theo docs/api/{identity,catalog,sales}-import.md của BE. Trạng thái trong bộ nhớ.
// Hành vi theo TÊN TỆP upload (để test điều khiển được):
//   "sai-mau" -> 422 IMPORT_TEMPLATE_MISMATCH (details cột thiếu) | "qua-lon" -> 413 | "rong" -> 422 IMPORT_EMPTY
//   "gioi-han" -> 429 IMPORT_SESSION_LIMIT | "chi-hop-le" -> mọi dòng VALID | "gian-doan" -> lần ghi đầu bị INTERRUPTED, confirm lại mới xong
//   mặc định -> mỗi sheet 3 dòng VALID, 1 INVALID (thiếu cột bắt buộc đầu tiên), 1 DUPLICATE.
// Ghi chú: việc ghi chỉ giả lập tiến độ (không đổi dữ liệu của các mock khác).
import { USERS } from "./data.mjs";

const SPEC = {
  users: { module: "identity", ctl: "UserImportController", credentials: true, sheets: [["NguoiDung", [["username", "Tên đăng nhập", true], ["fullName", "Họ tên", true], ["email", "Email", true]]]] },
  titles: {
    module: "catalog", ctl: "TitleImportController",
    sheets: [
      ["DauSach", [["isbn", "ISBN", false], ["name", "Tên sách", true], ["author", "Tác giả (hiển thị)", true], ["coverPrice", "Giá bìa (VND)", true]]],
      ["BanSao", [["isbn", "ISBN đầu sách", true], ["barcode", "Mã vạch", true]]],
    ],
  },
  authors: { module: "catalog", ctl: "AuthorImportController", sheets: [["TacGia", [["name", "Tên tác giả", true], ["nationality", "Quốc tịch", false]]]] },
  publishers: { module: "catalog", ctl: "PublisherImportController", sheets: [["NhaXuatBan", [["name", "Tên nhà xuất bản", true], ["country", "Quốc gia", false]]]] },
  categories: { module: "catalog", ctl: "CategoryImportController", sheets: [["TheLoai", [["name", "Tên thể loại", true], ["parentName", "Thể loại cha", false]]]] },
  "shelf-locations": { module: "catalog", ctl: "ShelfLocationImportController", sheets: [["ViTriKe", [["code", "Mã vị trí kệ", true], ["floor", "Tầng", false]]]] },
  series: { module: "catalog", ctl: "SeriesImportController", sheets: [["BoSach", [["name", "Tên bộ sách", true]]]] },
  "stock-items": { module: "sales", ctl: "StockItemImportController", sheets: [["MatHang", [["isbn", "ISBN đầu sách", true], ["sellingPrice", "Giá bán (VND)", false], ["openingQuantity", "Tồn đầu kỳ", false]]]] },
  suppliers: { module: "sales", ctl: "SupplierImportController", sheets: [["NhaCungCap", [["name", "Tên nhà cung cấp", true], ["phone", "Điện thoại", false]]]] },
};

// Tài khoản nhập Excel không phải admin: impyes có khóa nhập tác giả, impnone chỉ xem danh sách tác giả.
const TENANT = USERS.admin.tenantId;
USERS.impyes = {
  id: "impyes-id", roles: ["LIBRARIAN"], password: "Impyes@12345", tenantId: TENANT, tenants: [TENANT],
  permissions: ["AuthorController/search", "AuthorImportController/upload", "AuthorImportController/confirm"],
};
USERS.impnone = {
  id: "impnone-id", roles: ["LIBRARIAN"], password: "Impnone@12345", tenantId: TENANT, tenants: [TENANT],
  permissions: ["AuthorController/search"],
};

/** @type {Map<string, any>} */
const SESSIONS = new Map();
const XLSX = (label) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(`mock-xlsx:${label}`)]);
const uuid = () => crypto.randomUUID();

function buildRows(spec, file) {
  const rows = [];
  for (const [sheet, cols] of spec.sheets) {
    const firstRequired = cols.find((c) => c[2]) ?? cols[0];
    const mk = (n, status, issues = [], tag = "") => {
      const values = Object.fromEntries(cols.map(([k]) => [k, `${k}-${sheet}-${n}${tag}`]));
      if (status === "INVALID") values[firstRequired[0]] = "";
      rows.push({ sheet, rowNumber: n, status, values, issues });
    };
    const allValid = file.includes("chi-hop-le");
    mk(2, "VALID");
    mk(3, "VALID");
    if (allValid) continue;
    mk(4, "VALID");
    mk(5, "INVALID", [{ column: firstRequired[0], severity: "ERROR", code: "REQUIRED", message: `${firstRequired[1]} là bắt buộc` }]);
    mk(6, "DUPLICATE", [{ column: firstRequired[0], severity: "ERROR", code: "ALREADY_EXISTS", message: "Đã có trong hệ thống, dòng này sẽ bị bỏ qua" }]);
  }
  return rows;
}

const totalsOf = (rows) => ({
  total: rows.length,
  valid: rows.filter((r) => r.status === "VALID").length,
  invalid: rows.filter((r) => r.status === "INVALID").length,
  duplicate: rows.filter((r) => r.status === "DUPLICATE").length,
  warning: 0,
});

const view = (s) => ({
  importId: s.id,
  type: s.type,
  status: s.status,
  fileName: s.file,
  createdAt: s.createdAt,
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  sheets: s.spec.sheets.map(([name, cols]) => {
    const t = totalsOf(s.rows.filter((r) => r.sheet === name));
    return { sheet: name, columns: cols.map(([key, label, required]) => ({ key, label, required })), ...t };
  }),
  totals: totalsOf(s.rows),
  progress: s.progress,
  result: s.result,
  errorCode: s.errorCode ?? null,
});

export function handle({ method, url, caller, send, requireKey, raw, sendFile }) {
  const m = url.pathname.match(/^\/api\/(identity|catalog|sales)\/imports\/([a-z-]+)(?:\/([0-9a-f-]{36}|template))?(?:\/(rows|confirm|error-file|credentials))?$/);
  if (!m) return false;
  const [, mod, type, id, action] = m;
  const spec = SPEC[type];
  if (!spec || spec.module !== mod) return send(404, { code: "IMPORT_TYPE_NOT_FOUND", message: "Loại nhập không tồn tại" }), true;
  if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;

  // Tải mẫu: chỉ cần đăng nhập.
  if (method === "GET" && id === "template" && !action) return sendFile(200, XLSX(`template-${type}`), `mau-${type}.xlsx`), true;

  // Tải lên.
  if (method === "POST" && !id) {
    if (!requireKey(`${spec.ctl}/upload`)) return true;
    const file = /filename="([^"]*)"/.exec(raw)?.[1] ?? "";
    if (!file) return send(400, { code: "IMPORT_FILE_REQUIRED", message: "Thiếu tệp" }), true;
    if (file.includes("qua-lon")) return send(413, { code: "IMPORT_FILE_TOO_LARGE", message: "Tệp vượt 5 MB" }), true;
    if (file.includes("sai-mau")) return send(422, { code: "IMPORT_TEMPLATE_MISMATCH", message: "Sai mẫu", details: [`Thiếu cột bắt buộc: ${spec.sheets[0][1][0][1]}`] }), true;
    if (file.includes("rong")) return send(422, { code: "IMPORT_EMPTY", message: "Không có dòng dữ liệu" }), true;
    if (file.includes("gioi-han")) return send(429, { code: "IMPORT_SESSION_LIMIT", message: "Đã có 3 phiên đang mở" }), true;
    const s = { id: uuid(), type, spec, owner: caller, file, status: "VALIDATED", rows: buildRows(spec, file), progress: null, result: null, polls: 0, createdAt: new Date().toISOString(), credentialsTaken: false };
    SESSIONS.set(s.id, s);
    return send(201, view(s)), true;
  }

  // Còn lại cần phiên của chính người gọi (khác: 404 như BE).
  const s = id ? SESSIONS.get(id) : undefined;
  if (!s || s.owner !== caller || s.type !== type) return send(404, { code: "IMPORT_NOT_FOUND", message: "Phiên nhập không tồn tại hoặc đã hết hạn" }), true;

  if (method === "GET" && !action) {
    if (s.status === "COMMITTING") {
      s.polls += 1;
      const valid = totalsOf(s.rows).valid;
      if (s.polls === 1) s.progress = { processed: Math.floor(valid / 2), total: valid };
      else if (s.file.includes("gian-doan") && !s.interrupted) {
        s.interrupted = true;
        s.status = "INTERRUPTED";
        s.result = { created: Math.floor(valid / 2), skippedDuplicate: 0, failed: 0 };
      } else {
        const t = totalsOf(s.rows);
        s.status = "COMMITTED";
        s.progress = { processed: valid, total: valid };
        s.result = { created: t.valid, skippedDuplicate: t.duplicate, failed: 0 };
      }
    }
    return send(200, view(s)), true;
  }
  if (method === "GET" && action === "rows") {
    const sp = url.searchParams;
    const status = sp.get("status");
    const sheet = sp.get("sheet");
    const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
    const size = Math.min(200, Math.max(1, Number(sp.get("size") ?? 50) || 50));
    const list = s.rows.filter((r) => (!status || r.status === status) && (!sheet || r.sheet === sheet));
    return send(200, { items: list.slice(page * size, page * size + size), page, size, totalItems: list.length, totalPages: Math.ceil(list.length / size) }), true;
  }
  if (method === "POST" && action === "confirm") {
    if (!requireKey(`${spec.ctl}/confirm`)) return true;
    if (s.status === "COMMITTED") return send(200, view(s)), true;
    if (s.status === "COMMITTING") return send(202, view(s)), true;
    if (totalsOf(s.rows).valid === 0) return send(409, { code: "IMPORT_NOTHING_TO_COMMIT", message: "Không có dòng hợp lệ" }), true;
    s.status = "COMMITTING";
    s.polls = 0;
    const valid = totalsOf(s.rows).valid;
    s.progress = { processed: 0, total: valid };
    return send(202, view(s)), true;
  }
  if (method === "DELETE" && !action) {
    if (s.status === "COMMITTING") return send(409, { code: "IMPORT_INVALID_STATE", message: "Đang ghi, chưa hủy được" }), true;
    SESSIONS.delete(s.id);
    return send(204), true;
  }
  if (method === "GET" && action === "error-file") return sendFile(200, XLSX(`errors-${type}`), `loi-${type}.xlsx`), true;
  if (method === "GET" && action === "credentials" && spec.credentials) {
    if (!requireKey(`${spec.ctl}/credentials`)) return true;
    if (s.status !== "COMMITTED") return send(409, { code: "IMPORT_INVALID_STATE", message: "Chưa ghi xong" }), true;
    if (s.credentialsTaken) return send(410, { code: "IMPORT_CREDENTIALS_GONE", message: "File mật khẩu tạm đã được tải" }), true;
    s.credentialsTaken = true;
    return sendFile(200, XLSX("credentials"), "mat-khau-tam-users.xlsx"), true;
  }
  return false;
}
