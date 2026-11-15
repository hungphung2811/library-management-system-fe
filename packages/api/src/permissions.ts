/**
 * Khóa quyền của BE (ADR-0003): khóa là "TênController/tênMethod" của controller NỘI BỘ xử lý endpoint đó,
 * không phải mã cố định. BE đổi tên controller hoặc method thì khóa đổi theo và danh sách này phải cập nhật.
 * Quản trị viên (claim admin=true) bỏ qua kiểm khóa nên `can()` luôn đúng với họ.
 * Không có hằng cho endpoint lms-api chưa mở (returnCopy, reportLost, byReader, FineController/*, resetPassword).
 */
export const PERMISSIONS = {
  /** GET /api/roles */
  LIST_ROLES: "AccessControlController/listRoles",
  /** POST /api/borrowings */
  BORROW_BOOK: "BorrowingController/borrow",
  /** POST /api/borrowings/{id}/returns */
  RETURN_BOOK: "BorrowingController/returnBook",
  /** POST /api/borrowings/{id}/renewals */
  RENEW: "BorrowingController/renew",
  /** GET /api/books */
  BOOK_SEARCH: "TitleController/search",
  /** GET /api/books/{id} */
  BOOK_VIEW: "TitleController/get",
  /** POST /api/books */
  BOOK_CREATE: "TitleController/create",
  /** GET /api/book-copies?titleId */
  COPY_LIST: "BookCopyController/list",
  /** POST /api/book-copies */
  COPY_ADD: "BookCopyController/add",
  /** GET /api/book-copies/{id} */
  COPY_VIEW: "BookCopyController/get",
  /** GET /api/book-copies/by-barcode/{barcode} */
  COPY_BY_BARCODE: "BookCopyController/getByBarcode",
  /** PUT /api/book-copies/{id}/status */
  COPY_CHANGE_STATUS: "BookCopyController/changeStatus",
  /** POST /api/reservations */
  RESERVE: "ReservationController/reserve",
  /** GET /api/reservations */
  RESERVATION_MINE: "ReservationController/mine",
  /** DELETE /api/reservations/{id} */
  RESERVATION_CANCEL: "ReservationController/cancel",
  /** POST /api/reservations/expirations */
  RESERVATION_EXPIRE: "ReservationController/expireNow",
  /** GET /api/users */
  USER_SEARCH: "UserController/search",
  /** GET /api/users/{id} */
  USER_VIEW: "UserController/get",
  /** POST /api/users */
  USER_CREATE: "UserController/create",
  /** PUT /api/users/{id} */
  USER_UPDATE: "UserController/update",
  /** PUT /api/users/{id}/status */
  USER_STATUS: "UserController/changeStatus",
  /** POST /api/auth/credentials */
  CREDENTIAL_CREATE: "AuthController/register",
  /** GET /api/users/{id}/reader-profile */
  READER_VIEW: "ReaderProfileController/get",
  /** POST /api/users/{id}/reader-profile */
  READER_ISSUE: "ReaderProfileController/issue",
  /** PUT /api/users/{id}/reader-profile/card-expiry */
  READER_RENEW: "ReaderProfileController/renew",
  /** PUT /api/users/{id}/reader-profile/status */
  READER_STATUS: "ReaderProfileController/changeStatus",
  /** GET /api/roles/{id} */
  ROLE_VIEW: "AccessControlController/getRole",
  /** POST /api/roles */
  ROLE_CREATE: "AccessControlController/createRole",
  /** POST /api/roles/{id}/permissions */
  ROLE_GRANT: "AccessControlController/grantPermission",
  /** DELETE /api/roles/{id}/permissions/** */
  ROLE_REVOKE: "AccessControlController/revokePermission",
  /** GET /api/permissions */
  PERMISSION_LIST: "AccessControlController/listPermissions",
  /** POST /api/permissions */
  PERMISSION_CREATE: "AccessControlController/createPermission",
  /** GET /api/access/users/{id} */
  ACCESS_VIEW: "AccessControlController/getUserAccess",
  /** POST /api/access/users/{id}/roles */
  ACCESS_ASSIGN: "AccessControlController/assignRole",
  /** DELETE /api/access/users/{id}/roles/{roleId} */
  ACCESS_REVOKE: "AccessControlController/revokeRole",
  /** GET /api/departments */
  DEPT_LIST: "DepartmentController/list",
  /** GET /api/departments/tree */
  DEPT_TREE: "DepartmentController/tree",
  /** GET /api/departments/{id} */
  DEPT_VIEW: "DepartmentController/get",
  /** POST /api/departments */
  DEPT_CREATE: "DepartmentController/create",
  /** PUT /api/departments/{id} */
  DEPT_UPDATE: "DepartmentController/update",
  /** PUT /api/departments/{id}/status */
  DEPT_STATUS: "DepartmentController/changeStatus",
  /** GET /api/audit-logs */
  AUDIT_SEARCH: "AuditLogController/search",
} as const;
