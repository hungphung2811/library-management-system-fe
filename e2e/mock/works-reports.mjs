// Mock tác phẩm (works), đổi tác phẩm của ấn bản, báo cáo CSV và ghi nhận tìm lại sách mất.
// Hợp đồng: docs/api/catalog-works-series.md, dashboard-reports.md, circulation-fines-compensation.md của repo BE. Trạng thái trong bộ nhớ.
// Báo cáo với channel=POS trả thêm header X-Report-Truncated: true (để test cảnh báo bị cắt).
import { BOOKS, COPIES, USERS } from "./data.mjs";

const TENANT = USERS.admin.tenantId;
USERS.workview = {
  id: "workview-id", roles: ["LIBRARIAN"], password: "Workview@12345", tenantId: TENANT, tenants: [TENANT],
  permissions: ["WorkController/search", "WorkController/get"],
};

const uuid = () => crypto.randomUUID();
const norm = (s) => String(s ?? "").trim().toLowerCase();

// Sách có tác phẩm + hai bản sao đã mất (để ghi nhận tìm lại).
const FOUND_BOOK = { id: uuid(), name: "Sách đã mất được tìm lại", author: "Tác giả thất lạc", isbn: null, coverPrice: 70000, availableCopies: 0, tags: [] };
BOOKS.push(FOUND_BOOK);
COPIES.push(
  { id: uuid(), titleId: FOUND_BOOK.id, barcode: "LOSTFOUND01", status: "LOST" },
  { id: uuid(), titleId: FOUND_BOOK.id, barcode: "LOSTFOUND02", status: "LOST" },
);

/** @type {Array<Record<string, any>>} */
const WORKS = [];
const ed = (titleId, name, extra = {}) => ({ titleId, isbn: null, name, format: "PAPERBACK", language: "vi", translator: null, edition: null, publicationYear: 2020, partNumber: null, partLabel: null, availableCopies: 1, ...extra });
const addWork = (title, author, editions, extra = {}) => {
  const w = { id: uuid(), title, originalTitle: null, originalLanguage: null, author, authors: [], description: null, categoryId: null, categoryName: null, seriesId: null, seriesName: null, seriesNumber: null, seriesLabel: null, kind: "SINGLE", editions, ...extra };
  WORKS.push(w);
  return w;
};
const POTTER = addWork("Harry Potter và Hòn đá Phù thủy", "J.K. Rowling", [ed(FOUND_BOOK.id, "Harry Potter tập 1 (bìa mềm)"), ed(uuid(), "Harry Potter tập 1 (bìa cứng)", { format: "HARDCOVER" }), ed(uuid(), "Harry Potter and the Philosopher's Stone", { language: "en" })], { originalTitle: "Harry Potter and the Philosopher's Stone", originalLanguage: "en", seriesName: "Harry Potter", seriesNumber: 1 });
addWork("Sapiens: Lược sử loài người", "Yuval Noah Harari", [ed(uuid(), "Sapiens")]);
addWork("Tác phẩm gộp đích A", "Tác giả gộp", [ed(uuid(), "Ấn bản A1")]);
addWork("Tác phẩm gộp nguồn B", "Tác giả gộp", [ed(uuid(), "Ấn bản B1")]);
addWork("Tác phẩm gộp nguồn C", "Tác giả gộp", [ed(uuid(), "Ấn bản C1")]);
addWork("Tác phẩm để sửa", "Tác giả cũ", [ed(uuid(), "Ấn bản để sửa")], { description: "Mô tả cũ" });
FOUND_BOOK.workId = POTTER.id;
FOUND_BOOK.workTitle = POTTER.title;

const summary = (w) => ({
  id: w.id, title: w.title, originalTitle: w.originalTitle, author: w.author, seriesId: w.seriesId, seriesName: w.seriesName, seriesNumber: w.seriesNumber, kind: w.kind,
  editionCount: w.editions.length, availableCopies: w.editions.reduce((n, e) => n + e.availableCopies, 0), coverImageUrl: null,
});

const bad = (send, details) => send(400, { code: "VALIDATION_FAILED", message: "Dữ liệu không hợp lệ", details });
function readWork(body) {
  const details = [];
  const title = String(body.title ?? "").trim();
  if (!title) details.push("title: Tên tác phẩm không được để trống");
  if (title.length > 255) details.push("title: tối đa 255 ký tự");
  if (body.originalLanguage != null && !/^[a-z]{2,8}$/.test(body.originalLanguage)) details.push("originalLanguage: phải gồm 2 đến 8 chữ cái thường");
  if (body.seriesNumber != null && !body.seriesId) details.push("seriesNumber: chỉ nhập khi có bộ sách");
  const author = body.author ? String(body.author).trim() : "";
  if (!author && !(body.authorIds ?? []).length) return { error: { status: 400, body: { code: "INVALID_WORK", message: "Cần tác giả hoặc tác giả chuẩn" } } };
  if (details.length) return { details };
  return { work: { title, originalTitle: body.originalTitle ?? null, originalLanguage: body.originalLanguage ?? null, author, description: body.description ?? null, seriesId: body.seriesId ?? null, seriesNumber: body.seriesNumber ?? null, seriesLabel: body.seriesLabel ?? null, kind: body.kind ?? "SINGLE" } };
}

const FOUND = new Set();

export function handle({ method, url, body, send, requireKey, sendFile }) {
  const p = url.pathname;
  let m;

  if (method === "GET" && p === "/api/works") {
    if (!requireKey("WorkController/search")) return true;
    const kw = norm(url.searchParams.get("keyword"));
    const list = WORKS.filter((w) => !kw || norm(w.title).includes(kw) || norm(w.author).includes(kw));
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0);
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get("size") ?? 20) || 20));
    return send(200, { items: list.slice(page * size, page * size + size).map(summary), total: list.length, page, size }), true;
  }
  if (method === "POST" && p === "/api/works") {
    if (!requireKey("WorkController/create")) return true;
    const r = readWork(body);
    if (r.error) return send(r.error.status, r.error.body), true;
    if (r.details) return bad(send, r.details), true;
    return send(201, addWork(r.work.title, r.work.author, [], r.work)), true;
  }
  if ((m = p.match(/^\/api\/works\/([^/]+)(?:\/(merge))?$/))) {
    const w = WORKS.find((x) => x.id === m[1]);
    const nf = () => send(404, { code: "WORK_NOT_FOUND", message: "Không tìm thấy tác phẩm" });
    if (method === "GET" && !m[2]) {
      if (!requireKey("WorkController/get")) return true;
      return w ? (send(200, w), true) : (nf(), true);
    }
    if (method === "PUT" && !m[2]) {
      if (!requireKey("WorkController/update")) return true;
      if (!w) return nf(), true;
      const r = readWork(body);
      if (r.error) return send(r.error.status, r.error.body), true;
      if (r.details) return bad(send, r.details), true;
      Object.assign(w, r.work);
      return send(200, w), true;
    }
    if (method === "POST" && m[2] === "merge") {
      if (!requireKey("WorkController/merge")) return true;
      if (!w) return nf(), true;
      const ids = body.sourceWorkIds;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20) return bad(send, ["sourceWorkIds: 1 đến 20 tác phẩm"]), true;
      if (ids.includes(w.id)) return send(409, { code: "WORK_MERGE_SELF", message: "Nguồn chứa đích" }), true;
      for (const id of ids) {
        const i = WORKS.findIndex((x) => x.id === id);
        if (i < 0) return send(404, { code: "WORK_NOT_FOUND", message: "Không tìm thấy tác phẩm nguồn" }), true;
        w.editions.push(...WORKS[i].editions);
        WORKS.splice(i, 1);
      }
      return send(200, w), true;
    }
  }

  if (method === "PUT" && (m = p.match(/^\/api\/books\/([^/]+)\/work$/))) {
    if (!requireKey("TitleController/changeWork")) return true;
    const b = BOOKS.find((x) => x.id === m[1]);
    if (!b) return send(404, { code: "NOT_FOUND", message: "Không tìm thấy sách" }), true;
    const hasId = body.workId != null;
    const hasNew = body.newWork != null;
    if (hasId === hasNew) return send(400, { code: "INVALID_WORK", message: "Gửi đúng một trong workId hoặc newWork" }), true;
    let target;
    if (hasId) {
      target = WORKS.find((x) => x.id === body.workId);
      if (!target) return send(404, { code: "WORK_NOT_FOUND", message: "Không tìm thấy tác phẩm" }), true;
    } else {
      target = addWork(String(body.newWork.title ?? "").trim(), b.author, []);
    }
    for (const w of WORKS) w.editions = w.editions.filter((e) => e.titleId !== b.id);
    target.editions.push(ed(b.id, b.name));
    b.workId = target.id;
    b.workTitle = target.title;
    return send(200, b), true;
  }

  if (method === "POST" && p === "/api/borrowings/found") {
    if (!requireKey("BorrowingController/reportFound")) return true;
    const c = COPIES.find((x) => x.id === body.bookCopyId || x.barcode === body.barcode);
    if (!c) return send(404, { code: "COPY_NOT_FOUND", message: "Không tìm thấy bản sao" }), true;
    if (c.status !== "LOST") return send(409, { code: "COPY_NOT_LOST", message: "Bản sao không ở trạng thái mất" }), true;
    if (FOUND.has(c.id)) return send(409, { code: "REFUND_ALREADY_EXISTS", message: "Khoản mất này đã có đề nghị hoàn khoản" }), true;
    if (!["AVAILABLE", "DAMAGED"].includes(body.restoreStatus) || !["CASH", "BANK_TRANSFER"].includes(body.refundMethod)) return bad(send, ["restoreStatus: không hợp lệ"]), true;
    FOUND.add(c.id);
    return send(201, { id: uuid(), bookCopyId: c.id, restoreStatus: body.restoreStatus, refundMethod: body.refundMethod, referenceCode: body.referenceCode ?? null, checkNote: body.checkNote ?? null, mode: "WAIVE", status: "PENDING" }), true;
  }

  if (method === "GET" && (m = p.match(/^\/api\/reports\/(overdue-borrowings|stock|orders)$/))) {
    const key = { "overdue-borrowings": "LendingReportController/overdueBorrowingsCsv", stock: "SalesReportController/stockCsv", orders: "SalesReportController/ordersCsv" }[m[1]];
    if (!requireKey(key)) return true;
    const q = url.searchParams;
    if (q.get("from") && q.get("to") && q.get("from") > q.get("to")) return send(400, { code: "INVALID_RANGE", message: "from sau to" }), true;
    const header = { "overdue-borrowings": "borrowingId,userId,readerName,titleName,barcode,borrowDate,dueDate,daysOverdue", stock: "titleId,titleName,isbn,onHand,reserved,available,threshold,lowStock,sellingPrice", orders: "orderNo,channel,status,paymentStatus,createdAt,paidAt,itemCount,subtotal,discount,vat,shippingFee,total" }[m[1]];
    // Dòng thứ hai ghi lại query đã nhận để test kiểm bộ lọc.
    const csv = `﻿${header}\r\nquery,${url.search.replace(/^\?/, "")}\r\n`;
    sendFile(200, Buffer.from(csv, "utf8"), `${m[1]}-20261119.csv`, q.get("channel") === "POS" ? { "X-Report-Truncated": "true" } : {});
    return true;
  }

  return false;
}
