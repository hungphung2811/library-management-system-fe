// Mock của zone circulation: /api/borrowings*, /api/reservations* (zone circulation sở hữu file này).
// Trạng thái nằm trong bộ nhớ, dùng chung cho 2 worker: test tự lập phiếu/đặt trước mới (id riêng) rồi thao tác trên
// đúng id đó; các bản ghi seed bên dưới chỉ để ĐỌC (không test nào sửa chúng, trừ hủy đặt trước quá hạn).
// Mock không theo dõi "bản sao đang mượn": hai test có thể cùng mượn TV00010001 mà không va chạm. Trạng thái bản sao
// lấy từ data.mjs (TV00010003 là LOANED nên mượn sẽ bị từ chối COPY_NOT_AVAILABLE).
import { randomUUID } from "node:crypto";
import { BOOKS, COPIES, DIRECTORY, KEYS, READER_PROFILES, USERS } from "./data.mjs";

// Khóa quyền của nhóm mượn trả mà data.mjs chưa khai báo (khớp src/api/permissions.ts).
const K = {
  BORROWING_SEARCH: "BorrowingController/search",
  BORROWING_GET_ANY: "BorrowingController/getAny",
  FINE_BY_READER: "FineController/byReader",
  FINE_COLLECT: "FineController/collect",
  BORROWING_BY_READER: "BorrowingController/byReader",
  BORROWING_RETURN_COPY: "BorrowingController/returnCopy",
  BORROWING_REPORT_LOST: "BorrowingController/reportLost",
};

// Tài khoản riêng của nhóm mượn trả, gắn thêm vào USERS dùng chung lúc nạp module (không sửa data.mjs).
// Spec đăng nhập bằng mật khẩu ghi trong spec (helpers.ts chỉ biết các tài khoản có sẵn).
//   clerk: thủ thư đầy đủ mượn trả + tra danh sách phiếu + xem/thu phạt + tìm/xem người dùng.
//   finelook: chỉ xem phạt của độc giả (không có FineController/collect).
USERS.clerk = {
  id: "clerk-id", roles: ["LIBRARIAN"], password: "Clerk@12345", tenantId: USERS.admin.tenantId, tenants: [USERS.admin.tenantId],
  permissions: [
    KEYS.BORROW_BOOK, KEYS.RETURN_BOOK, KEYS.RENEW, K.BORROWING_SEARCH,
    KEYS.COPY_VIEW, KEYS.COPY_BY_BARCODE, KEYS.USER_SEARCH, KEYS.USER_VIEW,
    K.FINE_BY_READER, K.FINE_COLLECT, KEYS.RESERVATION_MINE, K.BORROWING_GET_ANY,
    K.BORROWING_BY_READER, K.BORROWING_RETURN_COPY, K.BORROWING_REPORT_LOST,
  ],
};
// Thủ thư dùng chung (data.mjs) cũng cần getAny để xem phiếu bất kỳ qua /detail.
if (!USERS.librarian.permissions.includes(K.BORROWING_GET_ANY)) USERS.librarian.permissions.push(K.BORROWING_GET_ANY);
USERS.finelook = {
  id: "finelook-id", roles: ["LIBRARIAN"], password: "Finelook@12345", tenantId: USERS.admin.tenantId, tenants: [USERS.admin.tenantId],
  permissions: [K.FINE_BY_READER, KEYS.USER_SEARCH, KEYS.USER_VIEW],
};

/**
 * Hai bản sao riêng của circulation-2.spec.ts (đầu sách không có trong BOOKS nên không lọt vào danh sách bản sao của catalog).
 * Không test nào khác dùng, nên trả/báo mất theo mã vạch không va chạm với phiếu của test khác.
 */
export const CIRC2_COPY_A = { id: "c9000000-0000-4000-8000-0000000000a1", titleId: "b9000000-0000-4000-8000-0000000000a1", barcode: "TV99000001", status: "AVAILABLE" };
export const CIRC2_COPY_B = { id: "c9000000-0000-4000-8000-0000000000a2", titleId: "b9000000-0000-4000-8000-0000000000a1", barcode: "TV99000002", status: "AVAILABLE" };
/** Bản sao riêng của test "trả theo mã vạch" trong circulation.spec.ts (tránh va chạm với phiếu của test khác cùng giữ TV00010001/2 khi chạy song song). */
export const CIRC1_COPY_BARCODE = { id: "c9000000-0000-4000-8000-0000000000b1", titleId: "b9000000-0000-4000-8000-0000000000a1", barcode: "TV99000011", status: "AVAILABLE" };
COPIES.push(CIRC2_COPY_A, CIRC2_COPY_B, CIRC1_COPY_BARCODE);

const DAY = 86_400_000;
const ymd = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

/** Người dùng giả có khoản phạt chưa trả: lập phiếu bị từ chối UNPAID_FINES. */
export const FINE_USER_ID = "f1000000-0000-4000-8000-0000000000f1";
/** Phiếu seed: ACTIVE đã quá hạn; và phiếu đã trả hết. */
export const BORROWING_OVERDUE_ID = "bd000000-0000-4000-8000-000000000001";
export const BORROWING_RETURNED_ID = "bd000000-0000-4000-8000-000000000002";
/** Độc giả riêng của test thu phạt (không có trong DIRECTORY, nên test vào thẳng ?readerId=). Test thu phạt là test DUY NHẤT sửa dữ liệu này. */
export const FINE_COLLECT_READER_ID = "f2000000-0000-4000-8000-0000000000f2";
/** Số phiếu quá hạn seed thêm (cộng 1 phiếu BORROWING_OVERDUE_ID = 46 phiếu quá hạn, 3 trang x 20). Không test nào tạo/sửa phiếu quá hạn. */
export const BULK_OVERDUE = 45;
/** Độc giả có khoản phạt seed (chỉ đọc): Lê Văn Hùng, DIRECTORY[0]; id UUID hợp lệ nên qua UUID_RE của trang Phạt. */
export const FINE_READER_ID = DIRECTORY[0].id;
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

/** Phiếu seed của user `reader` cho trang "Phiếu của tôi" (chỉ đọc; không quá hạn nên không ảnh hưởng tổng phiếu quá hạn). */
export const MINE_ACTIVE_ID = "bd000000-0000-4000-8000-000000000011";
export const MINE_RETURNED_ID = "bd000000-0000-4000-8000-000000000012";
borrowings.set(MINE_ACTIVE_ID, {
  id: MINE_ACTIVE_ID, userId: USERS.reader.id, status: "ACTIVE", borrowDate: ymd(-3), dueDate: ymd(11), renewCount: 0,
  items: [{ bookCopyId: COPIES[0].id, returnDate: null }],
});
borrowings.set(MINE_RETURNED_ID, {
  id: MINE_RETURNED_ID, userId: USERS.reader.id, status: "RETURNED", borrowDate: "2020-05-01", dueDate: "2020-05-15", renewCount: 0,
  items: [{ bookCopyId: COPIES[1].id, returnDate: "2020-05-10", condition: "GOOD" }],
});

for (let i = 1; i <= BULK_OVERDUE; i++) {
  const n = String(i).padStart(4, "0");
  const id = `be${n}00-0000-4000-8000-000000000001`;
  borrowings.set(id, {
    id,
    userId: DIRECTORY[1].id,
    status: "ACTIVE",
    borrowDate: `2019-${String(1 + (i % 12)).padStart(2, "0")}-01`,
    dueDate: `2019-${String(1 + (i % 12)).padStart(2, "0")}-15`,
    renewCount: 0,
    items: [{ bookCopyId: COPIES[0].id, returnDate: null }],
  });
}

/** Phạt theo độc giả (readerId). Seed chỉ đọc, trừ FINE_COLLECT_READER_ID. */
const mkFine = (id, readerId, reason, amount, status, createdAt) => ({
  id, readerId, borrowingId: BORROWING_OVERDUE_ID, bookCopyId: COPIES[0].id, reason, amount, status, createdAt,
  paidAt: status === "PAID" ? "2020-04-01T09:00:00" : null,
});
const fines = new Map([
  [FINE_READER_ID, [
    mkFine("f0000000-0000-4000-8000-000000000001", FINE_READER_ID, "LATE_RETURN", 15000, "UNPAID", "2020-02-10T08:00:00"),
    mkFine("f0000000-0000-4000-8000-000000000002", FINE_READER_ID, "DAMAGED", 50000, "PAID", "2020-03-12T08:00:00"),
  ]],
  [FINE_COLLECT_READER_ID, [
    mkFine("f0000000-0000-4000-8000-000000000011", FINE_COLLECT_READER_ID, "LATE_RETURN", 20000, "UNPAID", "2020-02-10T08:00:00"),
    mkFine("f0000000-0000-4000-8000-000000000012", FINE_COLLECT_READER_ID, "LOST", 30000, "UNPAID", "2020-02-11T08:00:00"),
  ]],
  [USERS.reader.id, [mkFine("f0000000-0000-4000-8000-000000000021", USERS.reader.id, "LATE_RETURN", 10000, "UNPAID", "2020-02-10T08:00:00")]],
]);
const finesOf = (readerId) => {
  const list = fines.get(readerId) ?? [];
  return { readerId, totalUnpaid: list.filter((f) => f.status === "UNPAID").reduce((a, f) => a + f.amount, 0), fines: list };
};

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

  // ---- Phạt ----
  if (method === "GET" && p === "/api/fines") {
    if (!requireKey(K.FINE_BY_READER)) return true;
    const readerId = url.searchParams.get("readerId") ?? "";
    return send(200, finesOf(readerId)), true;
  }
  if (method === "GET" && p === "/api/fines/mine") {
    if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true; // @AuthenticatedOnly
    return send(200, finesOf(USERS[caller].id)), true;
  }
  if (method === "POST" && p === "/api/fines/payments") {
    if (!requireKey(K.FINE_COLLECT)) return true;
    let n = 0;
    for (const f of fines.get(body.readerId) ?? []) {
      if (f.status === "UNPAID") {
        f.status = "PAID";
        f.paidAt = new Date().toISOString().slice(0, 19);
        n += 1;
      }
    }
    return send(200, { collectedCount: n }), true;
  }

  // ---- Phiếu mượn ----
  // Danh sách có lọc + phân trang server (page từ 0). status=ACTIVE|RETURNED, overdue=true: ACTIVE đã quá hạn.
  if (method === "GET" && p === "/api/borrowings/search") {
    if (!requireKey(K.BORROWING_SEARCH)) return true;
    const sp = url.searchParams;
    const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
    const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
    let all = [...borrowings.values()];
    if (sp.get("status")) all = all.filter((b) => b.status === sp.get("status"));
    if (sp.get("overdue") === "true") all = all.filter((b) => b.status === "ACTIVE" && b.dueDate < ymd(0));
    if (sp.get("readerId")) all = all.filter((b) => b.userId === sp.get("readerId"));
    all.sort((a, b) => b.borrowDate.localeCompare(a.borrowDate) || a.id.localeCompare(b.id));
    return send(200, { items: all.slice(page * size, (page + 1) * size), total: all.length, page, size }), true;
  }
  // Phiếu của chính người gọi (@AuthenticatedOnly). Seed: MINE_ACTIVE_ID và MINE_RETURNED_ID của user `reader` (chỉ đọc).
  if (method === "GET" && p === "/api/borrowings/mine") {
    if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true;
    return send(200, [...borrowings.values()].filter((b) => b.userId === USERS[caller].id)), true;
  }
  // Phiếu theo độc giả (không phân trang, readerId bắt buộc).
  if (method === "GET" && p === "/api/borrowings") {
    if (!requireKey(K.BORROWING_BY_READER)) return true;
    const rid = url.searchParams.get("readerId");
    if (!rid) return err(send, 400, "VALIDATION_FAILED", "Thiếu readerId"), true;
    return send(200, [...borrowings.values()].filter((b) => b.userId === rid)), true;
  }
  // Trả/báo mất theo mã vạch bản sao (không cần mã phiếu): tìm phiếu ACTIVE đang giữ bản sao.
  if (method === "POST" && (p === "/api/borrowings/returns" || p === "/api/borrowings/losses")) {
    const lost = p.endsWith("/losses");
    if (!requireKey(lost ? K.BORROWING_REPORT_LOST : K.BORROWING_RETURN_COPY)) return true;
    if (!body.bookCopyId && !body.barcode) return err(send, 422, "INVALID_BORROWING", "Phải chỉ định bản sao"), true;
    if (!lost && body.condition && !["GOOD", "DAMAGED"].includes(body.condition)) return err(send, 400, "VALIDATION_FAILED", "condition không hợp lệ"), true;
    const copy = COPIES.find((c) => c.id === body.bookCopyId || c.barcode === body.barcode);
    if (!copy) return err(send, 404, "COPY_NOT_FOUND", "Không tìm thấy bản sao"), true;
    const b = [...borrowings.values()].find((x) => x.status === "ACTIVE" && x.items.some((i) => i.bookCopyId === copy.id && !i.returnDate));
    if (!b) return err(send, 404, "BORROWING_NOT_FOUND", "Bản sao không nằm trong phiếu mượn đang mở"), true;
    const item = b.items.find((i) => i.bookCopyId === copy.id && !i.returnDate);
    const condition = lost ? "LOST" : (body.condition ?? "GOOD");
    item.returnDate = ymd(0);
    item.condition = condition;
    if (b.items.every((i) => i.returnDate)) b.status = "RETURNED";
    const fines = condition === "GOOD" ? [] : [{
      id: randomUUID(), readerId: b.userId, borrowingId: b.id, bookCopyId: copy.id,
      reason: condition, amount: condition === "LOST" ? 100000 : 30000, status: "UNPAID", createdAt: ymd(0), paidAt: null,
    }];
    return send(200, { ...b, fines }), true;
  }
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

  if ((m = p.match(/^\/api\/borrowings\/([^/]+)\/detail$/)) && method === "GET") {
    if (!requireKey(K.BORROWING_GET_ANY)) return true;
    const b = borrowings.get(m[1]);
    return b ? (send(200, b), true) : (err(send, 404, "BORROWING_NOT_FOUND", "Không tìm thấy phiếu mượn"), true);
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
