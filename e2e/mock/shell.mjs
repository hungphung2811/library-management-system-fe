// Module của shell: /api/notifications/*, /api/me/*, /api/users/me*, /api/auth/switch-tenant, /api/auth/me/external*.
// Pha 0 chỉ dựng phần khung dùng chung (chuông thông báo, danh sách đơn vị, chuyển đơn vị); người làm shell bổ sung phần còn lại.
import { TENANTS, USERS } from "./data.mjs";

const NOTIFICATIONS = [
  { id: "n0000000-0000-4000-8000-000000000001", type: "INFO", message: "Sách bạn đặt trước đã sẵn sàng nhận.", createdAt: "2026-11-14T08:00:00Z", readAt: null },
  { id: "n0000000-0000-4000-8000-000000000002", type: "INFO", message: "Phiếu mượn của bạn sắp đến hạn trả.", createdAt: "2026-11-10T08:00:00Z", readAt: "2026-11-10T09:00:00Z" },
];

// Danh sách thông báo theo người dùng. Mặc định dùng NOTIFICATIONS (member thấy đúng 1 chưa đọc, shared.spec dựa vào đó).
//  - staff: rỗng (test trạng thái rỗng).
//  - reader: thêm 22 thông báo cũ đã đọc để có hơn 20 mục (test phân trang).
const OLD = Array.from({ length: 22 }, (_, i) => ({
  id: `n1000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  type: "INFO",
  message: `Thông báo cũ số ${i + 1}`,
  createdAt: new Date(Date.UTC(2026, 9, 1, 8, 0, 0) - i * 3600_000).toISOString(),
  readAt: "2026-10-31T00:00:00Z",
}));
// librarian: 5 thông báo nhiều loại cho e2e/admin-2.spec.ts (đọc từng mục, đọc hết, lọc loại/ngày, phân trang).
const LIB = [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `n2000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, type: "OVERDUE", message: `Phiếu quá hạn số ${i + 1}`, createdAt: `2026-11-1${i}T08:00:00Z`, readAt: null })),
  { id: "n2000000-0000-4000-8000-000000000004", type: "RESERVATION", message: "Sách đặt trước đã về", createdAt: "2026-10-05T08:00:00Z", readAt: null },
  { id: "n2000000-0000-4000-8000-000000000005", type: "RESERVATION", message: "Đặt trước hết hạn giữ", createdAt: "2026-10-01T08:00:00Z", readAt: "2026-10-02T00:00:00Z" },
];
const NOTIFICATIONS_BY_USER = { staff: [], reader: [...NOTIFICATIONS, ...OLD], librarian: LIB };
// Trạng thái đã đọc theo từng người: bản sao riêng để đọc ở test này không đổi dữ liệu của test khác.
const STATE = new Map();
const notificationsOf = (u) => {
  if (!STATE.has(u)) STATE.set(u, (NOTIFICATIONS_BY_USER[u] ?? NOTIFICATIONS).map((n) => ({ ...n })));
  return STATE.get(u);
};

// Hồ sơ cá nhân. Chỉ `reader` có thẻ độc giả (người khác: 404, trang hồ sơ phải ẩn thẻ không báo lỗi).
const PROFILES = {
  admin: { fullName: "Nguyễn Quốc Bảo", username: "bao.nguyen" },
  staff: { fullName: "Trần Thị Thu Hà", username: "ha.tran" },
  member: { fullName: "Trần Minh Khôi", username: "khoi.tran" },
  newbie: { fullName: "Lý Gia Bảo", username: "bao.ly" },
  newbie2: { fullName: "Dương Thanh Trúc", username: "truc.duong" },
  librarian: { fullName: "Vũ Quang Huy", username: "huy.vu" },
  reader: { fullName: "Đỗ Thị Mai Anh", username: "maianh.do" },
  multi: { fullName: "Hồ Anh Tuấn", username: "tuan.ho" },
  multi2: { fullName: "Hồ Anh Tuấn", username: "tuan.ho2" },
};
const READER_CARD = {
  userId: USERS.reader.id, cardNo: "TV26-000512", fullName: PROFILES.reader.fullName, email: `${PROFILES.reader.username}@outlook.com`,
  readerType: "STUDENT", cardExpiryDate: "2030-12-31", status: "ACTIVE", cardValid: true,
};

// Liên kết tài khoản ngoài theo người dùng. `reader` chỉ để xem; `librarian` dành riêng cho test hủy liên kết
// (test đó chỉ chạy một lần, mock không tự khôi phục).
const PROVIDERS = [
  { name: "google", displayName: "Google" },
  { name: "microsoft", displayName: "Microsoft" },
];
const EXTERNAL = {
  reader: [{ provider: "google", email: "maianh.do@gmail.com", linkedAt: "2026-10-01T08:00:00Z", lastUsedAt: "2026-11-10T08:00:00Z" }],
  librarian: [{ provider: "google", email: "huy.vu@gmail.com", linkedAt: "2026-10-02T08:00:00Z", lastUsedAt: null }],
};

/** `tokens(username)` do mock-gateway truyền vào để cấp token mới sau khi chuyển đơn vị. */
export function handle({ method, url, body, caller, send, tokens }) {
  const p = url.pathname;

  if (method === "GET" && p === "/api/notifications/me/unread-count") {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    return send(200, { unread: notificationsOf(caller).filter((n) => n.readAt == null).length }), true;
  }
  if (method === "POST" && p === "/api/notifications/read-all") {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    const list = notificationsOf(caller).filter((n) => n.readAt == null);
    for (const n of list) n.readAt = new Date().toISOString();
    return send(200, { updated: list.length }), true;
  }
  let nm;
  if (method === "POST" && (nm = p.match(/^\/api\/notifications\/([^/]+)\/read$/))) {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    const n = notificationsOf(caller).find((x) => x.id === nm[1]);
    if (!n) return send(404, { code: "NOT_FOUND", message: "Không tìm thấy thông báo" }), true;
    n.readAt ??= new Date().toISOString();
    return send(200, n), true;
  }
  if (method === "GET" && p === "/api/notifications/me") {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    return send(200, notificationsOf(caller)), true;
  }
  if (method === "GET" && p === "/api/users/me") {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    return send(200, {
      id: USERS[caller].id, username: caller, fullName: PROFILES[caller]?.fullName ?? caller,
      email: `${PROFILES[caller]?.username ?? caller}@outlook.com`, departmentId: "dept-1", status: "ACTIVE",
    }), true;
  }
  if (method === "GET" && p === "/api/users/me/reader-profile") {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    if (caller !== "reader") return send(404, { code: "NOT_FOUND", message: "Người dùng chưa có hồ sơ độc giả" }), true;
    return send(200, READER_CARD), true;
  }
  if (method === "GET" && p === "/api/auth/external/providers") return send(200, PROVIDERS), true; // công khai
  if (method === "GET" && p === "/api/auth/me/external") {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    return send(200, EXTERNAL[caller] ?? []), true;
  }
  let m;
  if (method === "DELETE" && (m = p.match(/^\/api\/auth\/me\/external\/([^/]+)$/))) {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    const list = EXTERNAL[caller] ?? [];
    if (!list.some((l) => l.provider === m[1])) return send(404, { code: "NOT_FOUND", message: "Chưa liên kết với nhà cung cấp này" }), true;
    EXTERNAL[caller] = list.filter((l) => l.provider !== m[1]);
    return send(204), true;
  }
  if (method === "GET" && p === "/api/me/tenants") {
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    return send(200, TENANTS.filter((t) => USERS[caller].tenants.includes(t.id))), true;
  }
  if (method === "POST" && p === "/api/auth/switch-tenant") {
    // BE: @AuthenticatedOnly nên cần Bearer; refreshToken lấy từ cookie httpOnly do shell gắn.
    if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
    if (!USERS[caller].tenants.includes(body.tenantId) || body.refreshToken !== `rt-${caller}`) {
      return send(403, { code: "FORBIDDEN", message: "Bạn không thuộc đơn vị này" }), true;
    }
    USERS[caller].tenantId = body.tenantId;
    return send(200, tokens(caller)), true;
  }
  return false;
}
