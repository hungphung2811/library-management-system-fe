// GET đọc chéo zone (nhiều zone cùng cần): sách, bản sao, người dùng, hồ sơ độc giả. Đóng băng sau pha 0.
// Hợp đồng mọi module: `export function handle(ctx): boolean` (true = đã trả lời).
// ctx = { method, url: URL, body, caller, send(status, body), requireKey(key): boolean }; requireKey tự gửi 401/403 rồi trả false.
import { BOOKS, COPIES, DIRECTORY, KEYS, READER_PROFILES } from "./data.mjs";

const notFound = (send, message) => send(404, { code: "NOT_FOUND", message });

export function handle({ method, url, send, requireKey }) {
  if (method !== "GET") return false;
  const p = url.pathname;
  let m;

  if ((m = p.match(/^\/api\/books\/([^/]+)$/))) {
    if (!requireKey(KEYS.BOOK_VIEW)) return true;
    const b = BOOKS.find((x) => x.id === m[1]);
    return b ? (send(200, b), true) : (notFound(send, "Không tìm thấy sách"), true);
  }
  if ((m = p.match(/^\/api\/book-copies\/by-barcode\/([^/]+)$/))) {
    if (!requireKey(KEYS.COPY_BY_BARCODE)) return true;
    const barcode = decodeURIComponent(m[1]);
    const c = COPIES.find((x) => x.barcode === barcode);
    if (!c) return notFound(send, "Không tìm thấy bản sao"), true;
    const t = BOOKS.find((x) => x.id === c.titleId);
    return send(200, { ...c, titleName: t?.name, coverPrice: t?.coverPrice }), true;
  }
  if ((m = p.match(/^\/api\/book-copies\/([^/]+)$/))) {
    if (!requireKey(KEYS.COPY_VIEW)) return true;
    const c = COPIES.find((x) => x.id === m[1]);
    if (!c) return notFound(send, "Không tìm thấy bản sao"), true;
    const t = BOOKS.find((x) => x.id === c.titleId);
    return send(200, { ...c, titleName: t?.name, coverPrice: t?.coverPrice }), true;
  }
  if (p === "/api/users") {
    if (!requireKey(KEYS.USER_SEARCH)) return true;
    const kw = (url.searchParams.get("keyword") ?? "").toLowerCase();
    const items = DIRECTORY.filter((u) => !kw || `${u.fullName} ${u.username} ${u.email}`.toLowerCase().includes(kw));
    return send(200, { items, total: items.length, page: 0, size: 10 }), true;
  }
  if ((m = p.match(/^\/api\/users\/([^/]+)\/reader-profile$/))) {
    if (m[1] === "me") return false; // thuộc module shell
    if (!requireKey(KEYS.READER_VIEW)) return true;
    const r = READER_PROFILES.find((x) => x.userId === m[1]);
    return r ? (send(200, r), true) : (notFound(send, "Người dùng chưa có hồ sơ độc giả"), true);
  }
  if ((m = p.match(/^\/api\/users\/([^/]+)$/))) {
    if (m[1] === "me") return false; // thuộc module shell
    if (!requireKey(KEYS.USER_VIEW)) return true;
    const u = DIRECTORY.find((x) => x.id === m[1]);
    return u ? (send(200, u), true) : (notFound(send, "Không tìm thấy người dùng"), true);
  }
  return false;
}
