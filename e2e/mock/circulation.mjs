// Mock của zone circulation: /api/borrowings*, /api/reservations* (zone circulation sở hữu file này).
// Trạng thái nằm trong bộ nhớ, dùng chung cho 2 worker: test tự lập phiếu/đặt trước mới (id riêng) rồi thao tác trên
// đúng id đó; các bản ghi seed bên dưới chỉ để ĐỌC (không test nào sửa chúng, trừ hủy đặt trước quá hạn).
// Mock không theo dõi "bản sao đang mượn": hai test có thể cùng mượn TV00010001 mà không va chạm. Trạng thái bản sao
// lấy từ data.mjs (TV00010003 là LOANED nên mượn sẽ bị từ chối COPY_NOT_AVAILABLE).
import { randomUUID } from "node:crypto";
import { BOOKS, COPIES, DIRECTORY, KEYS, READER_PROFILES } from "./data.mjs";

const DAY = 86_400_000;
const ymd = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/** Người dùng giả có khoản phạt chưa trả: lập phiếu bị từ chối UNPAID_FINES. */
export const FINE_USER_ID = "f1000000-0000-4000-8000-0000000000f1";
/** Phiếu seed: ACTIVE đã quá hạn; và phiếu đã trả hết. */
export const BORROWING_OVERDUE_ID = "bd000000-0000-4000-8000-000000000001";
export const BORROWING_RETURNED_ID = "bd000000-0000-4000-8000-000000000002";
/** Đặt trước seed của user `reader` và `librarian`. */
export const RESERVATION_READY_ID = "ad000000-0000-4000-8000-000000000001";
export const RESERVATION_EXPIRED_ID = "ad000000-0000-4000-8000-000000000002";

const borrowings = new Map([
  [
    BORROWING_OVERDUE_ID,
    {
      id: BORROWING_OVERDUE_ID,
      userId: DIRECTORY[0].id,
      status: "ACTIVE",
      borrowDate: "2020-01-18",
      dueDate: "2020-02-01",
      renewCount: 0,
      items: [{ bookCopyId: COPIES[0].id, returnDate: null }],
    },
  ],
  [
    BORROWING_RETURNED_ID,
    {
      id: BORROWING_RETURNED_ID,
      userId: DIRECTORY[0].id,
      status: "RETURNED",
      borrowDate: "2020-03-01",
      dueDate: "2020-03-15",
      renewCount: 0,
      items: [{ bookCopyId: COPIES[1].id, returnDate: "2020-03-10" }],
    },
  ],
]);

/** Đặt trước theo tên đăng nhập của người gọi. */
const reservations = new Map([
  [
    "reader",
    [
      {
        id: RESERVATION_READY_ID,
        titleId: BOOKS[1].id,
        status: "READY",
        queuePosition: null,
        reservedAt: "2030-01-02T08:00:00",
        copyId: COPIES[2].id,
        holdUntil: "2030-01-10",
      },
      {
        id: "ad000000-0000-4000-8000-000000000003",
        titleId: BOOKS[0].id,
        status: "FULFILLED",
        queuePosition: null,
        reservedAt: "2029-12-01T08:00:00",
        copyId: COPIES[0].id,
        holdUntil: "2029-12-05",
      },
    ],
  ],
  [
    "librarian",
    [
      {
        id: RESERVATION_EXPIRED_ID,
        titleId: BOOKS[1].id,
        status: "READY",
        queuePosition: null,
        reservedAt: "2020-01-02T08:00:00",
        copyId: COPIES[2].id,
        holdUntil: "2020-01-10",
      },
    ],
  ],
]);
const listFor = (caller) => {
  if (!reservations.has(caller)) reservations.set(caller, []);
  return reservations.get(caller);
};

const err = (send, status, code, message) => send(status, { code, message });

export function handle({ method, url, body, caller, send, requireKey }) {
  const p = url.pathname;
  let m;

  // Dự phòng: GET /api/books (danh sách) nếu mock catalog chưa xử lý (catalog đứng trước trong thứ tự dispatch).
  if (method === "GET" && p === "/api/books") {
    if (!requireKey(KEYS.BOOK_SEARCH)) return true;
    const kw = (url.searchParams.get("keyword") ?? "").toLowerCase();
    return send(200, BOOKS.filter((b) => !kw || `${b.name} ${b.author} ${b.isbn}`.toLowerCase().includes(kw))), true;
  }

  // ---- Phiếu mượn ----
  if (method === "POST" && p === "/api/borrowings") {
    if (!requireKey(KEYS.BORROW_BOOK)) return true;
    const ids = Array.isArray(body.bookCopyIds) ? body.bookCopyIds : [];
    if (!body.userId || ids.length === 0) {
      return send(400, { code: "VALIDATION", message: "Dữ liệu chưa hợp lệ", details: ["bookCopyIds: không được rỗng"] }), true;
    }
    if (body.userId === FINE_USER_ID) return err(send, 409, "UNPAID_FINES", "Độc giả còn khoản phạt chưa thanh toán"), true;
    const profile = READER_PROFILES.find((r) => r.userId === body.userId);
    if (!profile) return err(send, 404, "READER_NOT_FOUND", "Người dùng chưa có hồ sơ độc giả"), true;
    if (!profile.cardValid) return err(send, 409, "CARD_INVALID", "Thẻ độc giả không hợp lệ"), true;
    for (const id of ids) {
      const c = COPIES.find((x) => x.id === id);
      if (!c) return err(send, 404, "COPY_NOT_FOUND", "Không tìm thấy bản sao"), true;
      if (c.status !== "AVAILABLE" && c.status !== "RESERVED") {
        return err(send, 409, "COPY_NOT_AVAILABLE", `Bản sao ${c.barcode} không sẵn sàng`), true;
      }
    }
    const b = {
      id: randomUUID(),
      userId: body.userId,
      status: "ACTIVE",
      borrowDate: ymd(0),
      dueDate: ymd(14),
      renewCount: 0,
      items: ids.map((bookCopyId) => ({ bookCopyId, returnDate: null })),
    };
    borrowings.set(b.id, b);
    return send(201, b), true;
  }

  if ((m = p.match(/^\/api\/borrowings\/([^/]+)$/)) && method === "GET") {
    if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true; // @AuthenticatedOnly
    const b = borrowings.get(m[1]);
    return b ? (send(200, b), true) : (err(send, 404, "BORROWING_NOT_FOUND", "Không tìm thấy phiếu mượn"), true);
  }

  if ((m = p.match(/^\/api\/borrowings\/([^/]+)\/returns$/)) && method === "POST") {
    if (!requireKey(KEYS.RETURN_BOOK)) return true;
    const b = borrowings.get(m[1]);
    if (!b) return err(send, 404, "BORROWING_NOT_FOUND", "Không tìm thấy phiếu mượn"), true;
    const item = b.items.find((i) => i.bookCopyId === body.bookCopyId);
    if (!item) return err(send, 400, "COPY_NOT_IN_BORROWING", "Bản sao không thuộc phiếu mượn này"), true;
    if (item.returnDate) return err(send, 409, "COPY_ALREADY_RETURNED", "Bản sao đã được trả"), true;
    item.returnDate = ymd(0);
    if (b.items.every((i) => i.returnDate)) b.status = "RETURNED";
    return send(200, b), true;
  }

  if ((m = p.match(/^\/api\/borrowings\/([^/]+)\/renewals$/)) && method === "POST") {
    if (!requireKey(KEYS.RENEW)) return true;
    const b = borrowings.get(m[1]);
    if (!b) return err(send, 404, "BORROWING_NOT_FOUND", "Không tìm thấy phiếu mượn"), true;
    if (b.status === "RETURNED") return err(send, 409, "BORROWING_RETURNED", "Phiếu mượn đã trả hết, không thể gia hạn"), true;
    if (b.dueDate < ymd(0)) return err(send, 409, "BORROWING_OVERDUE", "Phiếu mượn đã quá hạn, không thể gia hạn"), true;
    if (b.renewCount >= 2) return err(send, 409, "RENEWAL_LIMIT", "Chỉ được gia hạn tối đa 2 lần"), true;
    b.renewCount += 1;
    b.dueDate = new Date(Date.parse(b.dueDate) + 7 * DAY).toISOString().slice(0, 10);
    return send(200, b), true;
  }

  // ---- Đặt trước (chỉ của người gọi) ----
  if (method === "POST" && p === "/api/reservations") {
    if (!requireKey(KEYS.RESERVE)) return true;
    if (!BOOKS.some((b) => b.id === body.titleId)) return err(send, 404, "TITLE_NOT_FOUND", "Không tìm thấy đầu sách"), true;
    const r = {
      id: randomUUID(),
      titleId: body.titleId,
      status: "WAITING",
      queuePosition: 1,
      reservedAt: new Date().toISOString().slice(0, 19),
      copyId: null,
      holdUntil: null,
    };
    listFor(caller).push(r);
    return send(201, r), true;
  }
  if (method === "GET" && p === "/api/reservations") {
    if (!requireKey(KEYS.RESERVATION_MINE)) return true;
    return send(200, listFor(caller)), true;
  }
  if (method === "POST" && p === "/api/reservations/expirations") {
    if (!requireKey(KEYS.RESERVATION_EXPIRE)) return true;
    let n = 0;
    for (const r of listFor(caller)) {
      if (r.status === "READY" && r.holdUntil && r.holdUntil < ymd(0)) {
        r.status = "EXPIRED";
        n += 1;
      }
    }
    return send(200, { expired: n }), true;
  }
  if ((m = p.match(/^\/api\/reservations\/([^/]+)$/)) && method === "DELETE") {
    if (!requireKey(KEYS.RESERVATION_CANCEL)) return true;
    const r = listFor(caller).find((x) => x.id === m[1]);
    if (!r) return err(send, 404, "RESERVATION_NOT_FOUND", "Không tìm thấy đặt trước"), true;
    if (r.status !== "WAITING" && r.status !== "READY") return err(send, 409, "RESERVATION_NOT_ACTIVE", "Đặt trước không còn hiệu lực"), true;
    r.status = "CANCELLED";
    return send(200, r), true;
  }
  return false;
}
