// Mock của zone catalog: /api/books*, /api/book-copies* (phần còn lại ngoài các GET đọc chéo ở common.mjs).
// fe-dev catalog sở hữu file này. Thêm dữ liệu riêng của catalog vào chính các mảng BOOKS/COPIES của data.mjs
// (thay đổi tại chỗ, không sửa file data.mjs) để GET /api/books/{id} và by-barcode ở common.mjs thấy được.
import { BOOKS, COPIES, KEYS } from "./data.mjs";

const uuid = (n) => `d${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
let seq = 1000;
const nextId = () => uuid(++seq);

const addBook = (name, author, isbn, coverPrice) => {
  const b = { id: nextId(), name, author, isbn, coverPrice, availableCopies: 0 };
  BOOKS.push(b);
  return b;
};
const addCopy = (title, barcode, status) => {
  const c = { id: nextId(), titleId: title.id, barcode, status };
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
    if (details.length) return send(400, { code: "VALIDATION", message: "Dữ liệu không hợp lệ", details }), true;
    const b = addBook(name, author, body.isbn ? String(body.isbn) : null, body.coverPrice);
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
    if (details.length) return send(400, { code: "VALIDATION", message: "Dữ liệu không hợp lệ", details }), true;
    const isbn = body.isbn ? String(body.isbn) : null;
    if (isbn && BOOKS.some((x) => x.id !== b.id && x.isbn === isbn)) {
      return send(409, { code: "DUPLICATE_ISBN", message: `ISBN ${isbn} đã tồn tại` }), true;
    }
    Object.assign(b, { name, author, isbn, coverPrice: body.coverPrice });
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
    return send(201, addCopy(title, barcode, "AVAILABLE")), true;
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
