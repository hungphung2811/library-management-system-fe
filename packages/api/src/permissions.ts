/**
 * Khóa quyền của BE (ADR-0003): khóa là "TênController/tênMethod" của controller NỘI BỘ xử lý endpoint đó,
 * không phải mã cố định. BE đổi tên controller hoặc method thì khóa đổi theo và danh sách này phải cập nhật.
 * Quản trị viên (claim admin=true) bỏ qua kiểm khóa nên `can()` luôn đúng với họ.
 */
export const PERMISSIONS = {
  /** GET /api/roles (identity-service, AccessControlController.listRoles) */
  LIST_ROLES: "AccessControlController/listRoles",
  /** POST /api/borrowings (circulation-service, BorrowingController.borrow) */
  BORROW_BOOK: "BorrowingController/borrow",
  /** POST /api/borrowings/{id}/returns (circulation-service, BorrowingController.returnBook; có thêm returnCopy) */
  RETURN_BOOK: "BorrowingController/returnCopy",
} as const;
