// Mock của zone catalog: /api/books*, /api/book-copies* (phần còn lại ngoài các GET đọc chéo ở common.mjs).
// fe-dev catalog sở hữu file này. Thêm dữ liệu riêng của catalog vào chính các mảng BOOKS/COPIES của data.mjs
// (thay đổi tại chỗ, không sửa file data.mjs) để GET /api/books/{id} và by-barcode ở common.mjs thấy được.
import { BOOKS, COPIES, KEYS, USERS } from "./data.mjs";

// Tài khoản/khóa riêng của phần nhập kho bản sao (gắn vào USERS dùng chung lúc nạp module, không sửa data.mjs).
if (!USERS.librarian.permissions.includes(KEYS.COPY_UPDATE_ACQUISITION)) USERS.librarian.permissions.push(KEYS.COPY_UPDATE_ACQUISITION);
USERS.copyviewer = {
  id: "copyviewer-id", roles: ["CATALOGER"], permissions: [KEYS.BOOK_SEARCH, KEYS.BOOK_VIEW, KEYS.COPY_LIST],
  password: "Copyviewer@12345", tenantId: USERS.admin.tenantId, tenants: [USERS.admin.tenantId],
};

const SOURCES = ["PURCHASE", "DONATION", "EXCHANGE", "OTHER"];
const GRADES = ["NEW", "GOOD", "FAIR", "WORN"];
const ACQ_KEYS = ["acquiredDate", "acquisitionSource", "purchasePrice", "conditionGrade", "conditionNote", "lastInventoryDate"];
const today = () => new Date().toISOString().slice(0, 10);
/** Kiểm tra 6 field nhập kho như BE; trả { acq (đủ 6 khóa, thiếu = null), status, error }. */
const acquisition = (body) => {
  const acq = {};
  for (const k of ACQ_KEYS) acq[k] = body[k] === "" ? null : (body[k] ?? null);
  const bad = [];
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  for (const k of ["acquiredDate", "lastInventoryDate"]) {
    if (acq[k] != null && !isDate(acq[k])) bad.push(`${k}: ngày không hợp lệ`);
    else if (acq[k] != null && acq[k] > today()) bad.push(`${k}: không được ở tương lai`);
  }
  if (acq.acquisitionSource != null && !SOURCES.includes(acq.acquisitionSource)) bad.push("acquisitionSource: nguồn nhập không hợp lệ");
  if (acq.conditionGrade != null && !GRADES.includes(acq.conditionGrade)) bad.push("conditionGrade: tình trạng không hợp lệ");
  if (acq.purchasePrice != null && !(Number.isInteger(acq.purchasePrice) && acq.purchasePrice >= 0)) bad.push("purchasePrice: giá mua phải từ 0 trở lên");
  if (acq.conditionNote != null && String(acq.conditionNote).length > 300) bad.push("conditionNote: tối đa 300 ký tự");
  if (bad.length) return { error: { status: 400, body: { code: "VALIDATION_FAILED", message: "Dữ liệu không hợp lệ", details: bad } } };
  if (acq.purchasePrice != null && acq.acquisitionSource !== "PURCHASE") {
    return { error: { status: 422, body: { code: "INVALID_COPY", message: "Giá mua chỉ hợp lệ khi nguồn nhập là Mua" } } };
  }
  if (acq.lastInventoryDate && acq.acquiredDate && acq.lastInventoryDate < acq.acquiredDate) {
    return { error: { status: 422, body: { code: "INVALID_COPY", message: "Ngày kiểm kê không được trước ngày nhập" } } };
  }
  return { acq };
};

const uuid = (n) => `d${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
let seq = 1000;
const nextId = () => uuid(++seq);

const FORMATS = ["PAPERBACK", "HARDCOVER", "EBOOK"];
const PUB_KEYS = ["subtitle", "publicationYear", "edition", "language", "pageCount", "format", "translator", "series", "seriesNumber", "coverImageUrl", "tags"];
const strLimits = { subtitle: 255, edition: 50, translator: 255, series: 255, coverImageUrl: 500 };
/** Kiểm tra và chuẩn hóa 11 trường xuất bản (tùy chọn) như BE; trả { pub, details }. */
const publication = (body) => {
  const details = [];
  const pub = {};
  for (const k of PUB_KEYS) pub[k] = body[k] ?? null;
  for (const [k, max] of Object.entries(strLimits)) {
    if (pub[k] != null) { pub[k] = String(pub[k]).trim() || null; if (pub[k] && pub[k].length > max) details.push(`${k}: tối đa ${max} ký tự`); }
  }
  if (pub.publicationYear != null && !(Number.isInteger(pub.publicationYear) && pub.publicationYear >= 1000 && pub.publicationYear <= 2100)) details.push("publicationYear: năm từ 1000 đến 2100");
  if (pub.pageCount != null && !(Number.isInteger(pub.pageCount) && pub.pageCount >= 1 && pub.pageCount <= 20000)) details.push("pageCount: số trang từ 1 đến 20000");
  if (pub.language != null && !/^[a-z]{2,3}$/.test(String(pub.language))) details.push("language: mã ngôn ngữ không hợp lệ");
  if (pub.format != null && !FORMATS.includes(pub.format)) details.push("format: hình thức không hợp lệ");
  if (pub.seriesNumber != null && !pub.series) details.push("seriesNumber: chỉ nhập số tập khi có bộ sách");
  if (pub.coverImageUrl && !/^https?:\/\/\S+$/i.test(pub.coverImageUrl)) details.push("coverImageUrl: phải là địa chỉ http/https");
  if (pub.tags != null && (!Array.isArray(pub.tags) || pub.tags.length > 10 || pub.tags.some((t) => typeof t !== "string" || t.length > 50))) details.push("tags: tối đa 10 thẻ, mỗi thẻ tối đa 50 ký tự");
  if (!Array.isArray(pub.tags)) pub.tags = [];
  return { pub, details };
};

const addBook = (name, author, isbn, coverPrice, pub = {}) => {
  const b = { id: nextId(), name, author, isbn, coverPrice, availableCopies: 0, ...pub };
  BOOKS.push(b);
  return b;
};
const addCopy = (title, barcode, status, acq = {}) => {
  const c = { id: nextId(), titleId: title.id, barcode, status, ...Object.fromEntries(ACQ_KEYS.map((k) => [k, acq[k] ?? null])) };
  COPIES.push(c);
  recount(title.id);
  return c;
};
function recount(titleId) {
  const b = BOOKS.find((x) => x.id === titleId);
  if (b) b.availableCopies = COPIES.filter((c) => c.titleId === titleId && c.status === "AVAILABLE").length;
}

// Dữ liệu riêng: sách có đủ trạng thái bản sao để test đổi trạng thái (mỗi test dùng bản sao khác nhau).
export const SEED = {
  editable: addBook("Sách để sửa thông tin", "Tác giả cũ", "9786041119001", 61000),
  isbnA: addBook("Sách ISBN lọc A", "Tác giả lọc", "9786041118881", 45000),
  dupIsbn: addBook("Sách giữ ISBN trùng", "Tác giả lọc", "9786041118882", 45000),
  states: addBook("Hoàng Lê nhất thống chí", "Ngô gia văn phái", "9786041110001", 99000),
  noCopies: addBook("Nhật ký trong tù", "Hồ Chí Minh", "9786041110018", 50000),
};
for (let i = 1; i <= 6; i++) addCopy(SEED.states, `TV0003100${i}`, "LOANED");
addCopy(SEED.states, "TV00031011", "DAMAGED");
addCopy(SEED.states, "TV00031012", "DAMAGED");
addCopy(SEED.states, "TV00031021", "RESERVED");
addCopy(SEED.states, "TV00031031", "AVAILABLE");
addCopy(SEED.states, "TV00031041", "LOST");
// Sách để kiểm thông tin nhập kho: ACQ_SHOW (hiển thị), ACQ_EDIT (sửa), ACQ_CLEAR (xóa hết) và ACQ_VIEW (chỉ xem, ẩn nút) dùng bản sao riêng.
SEED.acq = addBook("Sách có thông tin nhập kho", "Tác giả nhập kho", "9786041110102", 120000);
const FULL = { acquiredDate: "2024-03-15", acquisitionSource: "PURCHASE", purchasePrice: 85000, conditionGrade: "GOOD", conditionNote: "Gáy hơi cong", lastInventoryDate: "2025-06-01" };
addCopy(SEED.acq, "ACQ00000001", "AVAILABLE", FULL);
addCopy(SEED.acq, "ACQ00000002", "AVAILABLE", FULL);
addCopy(SEED.acq, "ACQ00000003", "AVAILABLE", FULL);
addCopy(SEED.acq, "ACQ00000004", "AVAILABLE", { acquiredDate: "2023-01-10", acquisitionSource: "DONATION", conditionGrade: "WORN" });
// 25 đầu sách để kiểm phân trang client 20 dòng/trang.
for (let i = 1; i <= 25; i++) addBook(`Tuyển tập văn học Việt Nam, tập ${String(i).padStart(2, "0")}`, "Hội Nhà văn Việt Nam", null, 78000 + i * 1000);

const TRANSITIONS = {
  LOANED: ["DAMAGED", "LOST", "AVAILABLE"],
  RESERVED: ["AVAILABLE"],
  DAMAGED: ["AVAILABLE"],
};

export function handle({ method, url, body, send, requireKey }) {
  const p = url.pathname;
  let m;

  if (method === "GET" && p === "/api/books") {
    if (!requireKey(KEYS.BOOK_SEARCH)) return true;
    const kw = (url.searchParams.get("keyword") ?? "").toLowerCase();
    const onlyAvailable = url.searchParams.get("available") === "true";
    const items = BOOKS.filter(
      (b) =>
        (!kw || `${b.name} ${b.author} ${b.isbn ?? ""}`.toLowerCase().includes(kw)) &&
        (!onlyAvailable || b.availableCopies > 0),
    );
    return send(200, items), true;
  }

  if (method === "POST" && p === "/api/books") {
    if (!requireKey(KEYS.BOOK_CREATE)) return true;
    const details = [];
    const name = String(body.name ?? "").trim();
    const author = String(body.author ?? "").trim();
    if (!name) details.push("name: Tên sách không được để trống");
    else if (name.length > 255) details.push("name: Tên sách tối đa 255 ký tự");
    if (!author) details.push("author: Tác giả không được để trống");
    if (body.isbn != null && String(body.isbn).length > 20) details.push("isbn: ISBN tối đa 20 ký tự");
    if (typeof body.coverPrice !== "number" || body.coverPrice < 0) details.push("coverPrice: Giá bìa phải từ 0 trở lên");
    const { pub, details: pubErrors } = publication(body);
    details.push(...pubErrors);
    if (details.length) return send(400, { code: "VALIDATION", message: "Dữ liệu không hợp lệ", details }), true;
    const b = addBook(name, author, body.isbn ? String(body.isbn) : null, body.coverPrice, pub);
    return send(201, b), true;
  }

  if (method === "PUT" && (m = p.match(/^\/api\/books\/([^/]+)$/))) {
    if (!requireKey(KEYS.BOOK_UPDATE ?? "TitleController/update")) return true;
    const b = BOOKS.find((x) => x.id === m[1]);
    if (!b) return send(404, { code: "TITLE_NOT_FOUND", message: "Không tìm thấy sách" }), true;
    const details = [];
    const name = String(body.name ?? "").trim();
    const author = String(body.author ?? "").trim();
    if (!name) details.push("name: Tên sách không được để trống");
    if (!author) details.push("author: Tác giả không được để trống");
    if (typeof body.coverPrice !== "number" || body.coverPrice < 0) details.push("coverPrice: Giá bìa phải từ 0 trở lên");
    const { pub, details: pubErrors } = publication(body);
    details.push(...pubErrors);
    if (details.length) return send(400, { code: "VALIDATION", message: "Dữ liệu không hợp lệ", details }), true;
    const isbn = body.isbn ? String(body.isbn) : null;
    if (isbn && BOOKS.some((x) => x.id !== b.id && x.isbn === isbn)) {
      return send(409, { code: "DUPLICATE_ISBN", message: `ISBN ${isbn} đã tồn tại` }), true;
    }
    Object.assign(b, { name, author, isbn, coverPrice: body.coverPrice, ...pub });
    return send(200, b), true;
  }

  if (method === "GET" && p === "/api/book-copies") {
    if (!requireKey(KEYS.COPY_LIST)) return true;
    const titleId = url.searchParams.get("titleId");
    return send(200, COPIES.filter((c) => c.titleId === titleId)), true;
  }

  if (method === "POST" && p === "/api/book-copies") {
    if (!requireKey(KEYS.COPY_ADD)) return true;
    const barcode = String(body.barcode ?? "").trim();
    const title = BOOKS.find((b) => b.id === body.titleId);
    if (!title) return send(404, { code: "TITLE_NOT_FOUND", message: "Không tìm thấy sách" }), true;
    if (!barcode) return send(400, { code: "VALIDATION", message: "Dữ liệu không hợp lệ", details: ["barcode: Mã vạch không được để trống"] }), true;
    if (COPIES.some((c) => c.barcode === barcode)) {
      return send(409, { code: "DUPLICATE_BARCODE", message: `Mã vạch ${barcode} đã tồn tại` }), true;
    }
    const { acq, error } = acquisition(body);
    if (error) return send(error.status, error.body), true;
    return send(201, addCopy(title, barcode, "AVAILABLE", acq)), true;
  }

  if (method === "PUT" && (m = p.match(/^\/api\/book-copies\/([^/]+)\/acquisition$/))) {
    if (!requireKey(KEYS.COPY_UPDATE_ACQUISITION)) return true;
    const c = COPIES.find((x) => x.id === m[1]);
    if (!c) return send(404, { code: "NOT_FOUND", message: "Không tìm thấy bản sao" }), true;
    const { acq, error } = acquisition(body);
    if (error) return send(error.status, error.body), true;
    Object.assign(c, acq); // thay toàn bộ 6 field (thiếu = xóa)
    return send(200, c), true;
  }

  if (method === "PUT" && (m = p.match(/^\/api\/book-copies\/([^/]+)\/status$/))) {
    if (!requireKey(KEYS.COPY_CHANGE_STATUS)) return true;
    const c = COPIES.find((x) => x.id === m[1]);
    if (!c) return send(404, { code: "NOT_FOUND", message: "Không tìm thấy bản sao" }), true;
    if (!(TRANSITIONS[c.status] ?? []).includes(body.status)) {
      return send(409, { code: "COPY_STATUS_CONFLICT", message: `Không thể chuyển từ ${c.status} sang ${body.status}` }), true;
    }
    c.status = body.status;
    recount(c.titleId);
    return send(200, c), true;
  }

  return false;
}
