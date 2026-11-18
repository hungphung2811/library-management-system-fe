// Dữ liệu mẫu dùng chung cho các module mock (đóng băng sau pha 0; zone cần thêm dữ liệu thì xin điều phối viên).
// Trạng thái này nằm trong bộ nhớ và dùng chung cho 2 worker chạy song song: test KHÔNG được giả định số lượng bản ghi,
// mỗi test dùng dữ liệu riêng (barcode, tên có hậu tố riêng) và không dựa vào việc test khác đã sửa dữ liệu.

/** Khóa quyền của BE (ADR-0003); khớp packages/api/src/permissions.ts. */
export const KEYS = {
  LIST_ROLES: "AccessControlController/listRoles",
  BORROW_BOOK: "BorrowingController/borrow",
  RETURN_BOOK: "BorrowingController/returnBook",
  RENEW: "BorrowingController/renew",
  BOOK_SEARCH: "TitleController/search",
  BOOK_VIEW: "TitleController/get",
  BOOK_CREATE: "TitleController/create",
  COPY_LIST: "BookCopyController/list",
  COPY_ADD: "BookCopyController/add",
  COPY_VIEW: "BookCopyController/get",
  COPY_BY_BARCODE: "BookCopyController/getByBarcode",
  COPY_CHANGE_STATUS: "BookCopyController/changeStatus",
  COPY_UPDATE_ACQUISITION: "BookCopyController/updateAcquisition",
  RESERVE: "ReservationController/reserve",
  RESERVATION_MINE: "ReservationController/mine",
  RESERVATION_CANCEL: "ReservationController/cancel",
  RESERVATION_EXPIRE: "ReservationController/expireNow",
  USER_SEARCH: "UserController/search",
  USER_VIEW: "UserController/get",
  READER_VIEW: "ReaderProfileController/get",
  PREVIEW_VIEW: "TitleController/preview",
  PREVIEW_UPDATE: "TitleController/updatePreview",
};

export const TENANTS = [
  { id: "11111111-1111-4111-8111-111111111111", code: "main", name: "Thư viện trung tâm" },
  { id: "22222222-2222-4222-8222-222222222222", code: "branch", name: "Thư viện cơ sở 2" },
];
const [TENANT_A, TENANT_B] = TENANTS.map((t) => t.id);

/**
 * Tài khoản đăng nhập. mustChangePassword đổi được qua POST /api/auth/password.
 * `tenants` là các đơn vị người dùng thuộc về; `tenantId` là đơn vị hiện tại (claim tenantId).
 */
export const USERS = {
  // Quản trị viên: chỉ có admin=true, KHÔNG có permission nào (bỏ qua kiểm khóa).
  admin: {
    id: "admin-id", roles: ["SUPER_ADMIN"], permissions: [], admin: true, password: "Admin@12345",
    tenantId: TENANT_A, tenants: [TENANT_A],
  },
  // Thủ thư kiểu cũ: được gán khóa cụ thể, không phải admin.
  staff: {
    id: "staff-id", roles: ["LIBRARIAN"], permissions: [KEYS.LIST_ROLES, KEYS.BORROW_BOOK], password: "Staff@12345",
    tenantId: TENANT_A, tenants: [TENANT_A],
  },
  member: {
    id: "member-id", roles: ["MEMBER"], permissions: [], password: "Member@12345",
    tenantId: TENANT_A, tenants: [TENANT_A],
  },
  // Hai tài khoản phải đổi mật khẩu (mật khẩu tạm). newbie2 dành cho test thực sự đổi mật khẩu.
  newbie: {
    id: "newbie-id", roles: ["MEMBER"], permissions: [], mustChangePassword: true, password: "Temp@12345",
    tenantId: TENANT_A, tenants: [TENANT_A],
  },
  newbie2: {
    id: "newbie2-id", roles: ["MEMBER"], permissions: [], mustChangePassword: true, password: "Temp@12345",
    tenantId: TENANT_A, tenants: [TENANT_A],
  },
  // Thủ thư đầy đủ nghiệp vụ catalog + circulation, cùng tìm người dùng và xem hồ sơ độc giả.
  librarian: {
    id: "librarian-id",
    roles: ["LIBRARIAN"],
    permissions: [
      KEYS.BOOK_SEARCH, KEYS.BOOK_VIEW, KEYS.BOOK_CREATE,
      KEYS.COPY_LIST, KEYS.COPY_ADD, KEYS.COPY_VIEW, KEYS.COPY_BY_BARCODE, KEYS.COPY_CHANGE_STATUS,
      KEYS.BORROW_BOOK, KEYS.RETURN_BOOK, KEYS.RENEW,
      KEYS.RESERVE, KEYS.RESERVATION_MINE, KEYS.RESERVATION_CANCEL, KEYS.RESERVATION_EXPIRE,
      KEYS.USER_SEARCH, KEYS.READER_VIEW,
    ],
    password: "Librarian@12345",
    tenantId: TENANT_A, tenants: [TENANT_A],
  },
  // Độc giả: tra sách và đặt trước.
  reader: {
    id: "reader-id",
    roles: ["READER"],
    permissions: [KEYS.BOOK_SEARCH, KEYS.BOOK_VIEW, KEYS.RESERVE, KEYS.RESERVATION_MINE, KEYS.RESERVATION_CANCEL],
    password: "Reader@12345",
    tenantId: TENANT_A, tenants: [TENANT_A],
  },
  // Platform admin: token KHÔNG có tenantId, claim platformAdmin=true (CMS và yêu cầu liên hệ của nền tảng SaaS).
  platform: {
    id: "platform-id", roles: ["PLATFORM_ADMIN"], permissions: [], platformAdmin: true, password: "Platform@12345",
    tenantId: undefined, tenants: [],
  },
  // Nhập mô tả/preview đầu sách: xem chi tiết sách + xem và sửa preview. previewviewer chỉ xem.
  previewer: {
    id: "previewer-id", roles: ["CATALOGER"], permissions: [KEYS.BOOK_SEARCH, KEYS.BOOK_VIEW, KEYS.PREVIEW_VIEW, KEYS.PREVIEW_UPDATE],
    password: "Previewer@12345", tenantId: TENANT_A, tenants: [TENANT_A],
  },
  previewviewer: {
    id: "previewviewer-id", roles: ["CATALOGER"], permissions: [KEYS.BOOK_SEARCH, KEYS.BOOK_VIEW, KEYS.PREVIEW_VIEW],
    password: "Previewviewer@12345", tenantId: TENANT_A, tenants: [TENANT_A],
  },
  // Thuộc 2 đơn vị, dùng cho test chuyển đơn vị (switch-tenant đổi tenantId trong bộ nhớ).
  multi: {
    id: "multi-id", roles: ["READER"], permissions: [KEYS.BOOK_SEARCH, KEYS.BOOK_VIEW], password: "Multi@12345",
    tenantId: TENANT_A, tenants: [TENANT_A, TENANT_B],
  },
  // Như multi nhưng dành riêng cho test chuyển đơn vị qua giao diện (shared.spec.ts); multi dành cho test API.
  multi2: {
    id: "multi2-id", roles: ["READER"], permissions: [KEYS.BOOK_SEARCH, KEYS.BOOK_VIEW], password: "Multi2@12345",
    tenantId: TENANT_A, tenants: [TENANT_A, TENANT_B],
  },
};

export const BOOKS = [
  { id: "b0000000-0000-4000-8000-000000000001", name: "Lập trình Java cơ bản", author: "Nguyễn Văn An", isbn: "9786040000011", coverPrice: 120000, availableCopies: 2 },
  { id: "b0000000-0000-4000-8000-000000000002", name: "Cấu trúc dữ liệu và giải thuật", author: "Trần Thị Bình", isbn: "9786040000028", coverPrice: 150000, availableCopies: 0 },
];

export const COPIES = [
  { id: "c0000000-0000-4000-8000-000000000001", titleId: BOOKS[0].id, barcode: "TV00010001", status: "AVAILABLE" },
  { id: "c0000000-0000-4000-8000-000000000002", titleId: BOOKS[0].id, barcode: "TV00010002", status: "AVAILABLE" },
  { id: "c0000000-0000-4000-8000-000000000003", titleId: BOOKS[1].id, barcode: "TV00010003", status: "LOANED" },
];

export const DIRECTORY = [
  { id: "a0000000-0000-4000-8000-000000000001", username: "hung.le", fullName: "Lê Văn Hùng", email: "hung.le@gmail.com", departmentId: "dept-1", status: "ACTIVE", phone: "0912 345 678", dateOfBirth: "2003-05-14", gender: "MALE", address: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội", avatarUrl: null, jobTitle: null, employeeCode: null },
  { id: "a0000000-0000-4000-8000-000000000002", username: "huong.pham", fullName: "Phạm Thị Hương", email: "huong.pham@gmail.com", departmentId: "dept-1", status: "ACTIVE" },
];

// 45 người dùng hàng loạt (username nguoidungNN) để test phân trang server; tìm bằng từ khóa "nguoidung". Chỉ đọc.
export const BULK_USER_KEYWORD = "nguoidung";
for (let i = 1; i <= 45; i++) {
  const n = String(i).padStart(2, "0");
  DIRECTORY.push({
    id: `a1000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    username: `nguoidung${n}`,
    fullName: `Người dùng thử số ${i}`,
    email: `nguoidung${i}@gmail.com`,
    departmentId: null,
    status: "ACTIVE",
  });
}
// Người dùng đã bị vô hiệu (seed, chỉ đọc) để test lọc status=DISABLED.
DIRECTORY.push({ id: "a2000000-0000-4000-8000-000000000001", username: "da.khoa", fullName: "Đỗ Văn Khóa", email: "da.khoa@gmail.com", departmentId: "dept-2", status: "DISABLED" });

export const READER_PROFILES = [
  { userId: DIRECTORY[0].id, cardNo: "SV21-04817", fullName: DIRECTORY[0].fullName, email: DIRECTORY[0].email, readerType: "STUDENT", cardExpiryDate: "2030-12-31", status: "ACTIVE", cardValid: true, phone: "0912 345 678", dateOfBirth: "2003-05-14", gender: "MALE", address: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội", faculty: "Khoa Công nghệ thông tin", className: "K21-CNTT2", memberCode: "SV21-04817", cardIssuedDate: "2021-09-01" },
  { userId: DIRECTORY[1].id, cardNo: "GV-0342", fullName: DIRECTORY[1].fullName, email: DIRECTORY[1].email, readerType: "LECTURER", cardExpiryDate: "2020-01-31", status: "ACTIVE", cardValid: false },
];
