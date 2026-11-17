/**
 * Khóa quyền của BE (ADR-0003): khóa là "TênController/tênMethod" của controller NỘI BỘ xử lý endpoint đó,
 * không phải mã cố định. BE đổi tên controller hoặc method thì khóa đổi theo và danh sách này phải cập nhật.
 * Quản trị viên (claim admin=true) bỏ qua kiểm khóa nên `can()` luôn đúng với họ.
 * Khóa của controller nội bộ chưa có endpoint lms-api tương ứng vẫn có thể có hằng ở đây; chỉ dùng khi trang gọi đúng endpoint.
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
  /** GET /api/borrowings/search (danh sách phiếu mượn có lọc và phân trang) */
  BORROWING_SEARCH: "BorrowingController/search",
  /** GET /api/borrowings/{id} (chỉ phiếu của chính người gọi) */
  BORROWING_GET: "BorrowingController/get",
  /** GET /api/borrowings/{id}/detail (nhân viên xem phiếu bất kỳ) */
  BORROWING_GET_ANY: "BorrowingController/getAny",
  /** GET /api/borrowings?readerId (phiếu của một độc giả) */
  BORROWING_BY_READER: "BorrowingController/byReader",
  /** POST /api/borrowings/returns (trả theo mã vạch bản sao) */
  BORROWING_RETURN_COPY: "BorrowingController/returnCopy",
  /** POST /api/borrowings/losses (báo mất) */
  BORROWING_REPORT_LOST: "BorrowingController/reportLost",
  /** GET /api/fines?readerId (phạt của một độc giả, dành cho thủ thư) */
  FINE_BY_READER: "FineController/byReader",
  /** POST /api/fines/payments (thu phạt) */
  FINE_COLLECT: "FineController/collect",
  /** GET /api/books */
  BOOK_SEARCH: "TitleController/search",
  /** GET /api/books/{id} */
  BOOK_VIEW: "TitleController/get",
  /** POST /api/books */
  BOOK_CREATE: "TitleController/create",
  /** PUT /api/books/{id} */
  BOOK_UPDATE: "TitleController/update",
  /** GET /api/books/lookup */
  BOOK_LOOKUP: "TitleController/lookup",
  /** GET /api/books/{id}/preview (mô tả ngắn và đoạn đọc thử) */
  BOOK_PREVIEW_VIEW: "TitleController/preview",
  /** PUT /api/books/{id}/preview */
  BOOK_PREVIEW_UPDATE: "TitleController/updatePreview",
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
  /** POST /api/users/{id}/password-reset (quản trị đặt lại mật khẩu) */
  USER_RESET_PASSWORD: "UserController/resetPassword",
  /** POST /api/users/{id}/unlock */
  USER_UNLOCK: "UserController/unlock",
  /** POST /api/users/{id}/sessions/revocation */
  USER_REVOKE_SESSIONS: "UserController/revokeSessions",
  /** POST /api/users/imports */
  USER_IMPORT: "UserController/importUsers",
  /** GET /api/users/export */
  USER_EXPORT: "UserController/exportUsers",
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
  /** PUT /api/roles/{id} */
  ROLE_UPDATE: "AccessControlController/updateRole",
  /** DELETE /api/roles/{id} */
  ROLE_DELETE: "AccessControlController/deleteRole",
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
  /** GET /api/menus (quản trị menu) */
  MENU_LIST: "MenuAdminController/listMenus",
  /** POST /api/menus */
  MENU_CREATE: "MenuAdminController/createMenu",
  /** PUT /api/menus/{id} */
  MENU_UPDATE: "MenuAdminController/updateMenu",
  /** DELETE /api/menus/{id} */
  MENU_DELETE: "MenuAdminController/deleteMenu",
  /** POST /api/menus/defaults */
  MENU_INIT_DEFAULTS: "MenuAdminController/initializeDefaults",
  /** GET /api/sales/settings */
  SALES_SETTINGS_VIEW: "SalesSettingsController/get",
  /** PUT /api/sales/settings */
  SALES_SETTINGS_UPDATE: "SalesSettingsController/update",
  /** POST /api/sales/stock-items */
  STOCK_REGISTER: "StockItemController/register",
  /** GET /api/sales/stock-items */
  STOCK_SEARCH: "StockItemController/search",
  /** GET /api/sales/stock-items/{titleId} */
  STOCK_VIEW: "StockItemController/get",
  /** PUT /api/sales/stock-items/{titleId}/price */
  STOCK_UPDATE_PRICE: "StockItemController/updatePrice",
  /** GET /api/sales/stock-items/{titleId}/ledger */
  STOCK_LEDGER: "StockItemController/ledger",
  /** POST /api/sales/stock-adjustments */
  STOCK_ADJUST: "StockAdjustmentController/adjust",
  /** POST /api/sales/stocktakes */
  STOCK_STOCKTAKE: "StockAdjustmentController/stocktake",
  /** GET /api/sales/suppliers */
  SUPPLIER_SEARCH: "SupplierController/search",
  /** POST /api/sales/suppliers */
  SUPPLIER_CREATE: "SupplierController/create",
  /** PUT /api/sales/suppliers/{id} */
  SUPPLIER_UPDATE: "SupplierController/update",
  /** POST /api/sales/goods-receipts */
  RECEIPT_CREATE: "GoodsReceiptController/create",
  /** GET /api/sales/goods-receipts */
  RECEIPT_SEARCH: "GoodsReceiptController/search",
  /** GET /api/sales/goods-receipts/{id} */
  RECEIPT_VIEW: "GoodsReceiptController/get",
  /** POST /api/sales/goods-receipts/{id}/confirmation */
  RECEIPT_CONFIRM: "GoodsReceiptController/confirm",
  /** POST /api/sales/goods-receipts/{id}/cancellation */
  RECEIPT_CANCEL: "GoodsReceiptController/cancel",
  /** POST /api/sales/pos-orders (bán tại quầy, không giảm giá) */
  POS_ORDER_CREATE: "PosOrderController/create",
  /** POST /api/sales/pos-orders/discounted (bán tại quầy có giảm giá) */
  POS_ORDER_CREATE_DISCOUNTED: "PosOrderController/createWithDiscount",
  /** GET /api/sales/orders */
  SALES_ORDER_SEARCH: "SalesOrderController/search",
  /** GET /api/sales/orders/{id} */
  SALES_ORDER_VIEW: "SalesOrderController/get",
  /** GET /api/sales/orders/{id}/contact (liên hệ khách đầy đủ) */
  SALES_ORDER_CONTACT: "SalesOrderController/getContact",
  /** GET /api/sales/orders/{id}/receipt */
  SALES_ORDER_RECEIPT: "SalesOrderController/receipt",
  /** POST /api/sales/orders/{id}/confirmation (xác nhận đơn online, kèm phí ship) */
  SALES_ORDER_CONFIRM: "SalesOrderController/confirm",
  /** POST /api/sales/orders/{id}/discount (giảm giá sau khi tạo; chỉ role quản lý) */
  SALES_ORDER_APPLY_DISCOUNT: "SalesOrderController/applyDiscount",
  /** POST /api/sales/orders/{id}/payment (đánh dấu đã thu) */
  SALES_ORDER_MARK_PAID: "SalesOrderController/markPaid",
  /** POST /api/sales/orders/{id}/ready-for-pickup */
  SALES_ORDER_READY_FOR_PICKUP: "SalesOrderController/markReadyForPickup",
  /** POST /api/sales/orders/{id}/shipping */
  SALES_ORDER_SHIPPING: "SalesOrderController/markShipping",
  /** POST /api/sales/orders/{id}/completion */
  SALES_ORDER_COMPLETE: "SalesOrderController/complete",
  /** POST /api/sales/orders/{id}/cancellation */
  SALES_ORDER_CANCEL: "SalesOrderController/cancel",
  /** Khách (customer-api, không qua lms-api): POST /internal/sales/shop/orders */
  SHOP_PLACE_ORDER: "ShopController/placeOrder",
  /** Khách: GET /internal/sales/shop/orders */
  SHOP_MY_ORDERS: "ShopController/myOrders",
  /** Khách: GET /internal/sales/shop/orders/{id} */
  SHOP_MY_ORDER: "ShopController/myOrder",
  /** Khách: POST /internal/sales/shop/orders/{id}/cancellation */
  SHOP_CANCEL_MY_ORDER: "ShopController/cancelMyOrder",
  /** Danh mục công khai (storefront, không có đường lms-api): danh sách */
  STOREFRONT_LIST: "StorefrontController/list",
  /** Danh mục công khai: chi tiết */
  STOREFRONT_GET: "StorefrontController/get",
  /** Danh mục công khai: đọc thử */
  STOREFRONT_PREVIEW: "StorefrontController/preview",
  /** POST /api/sales/returns (trả hàng trong hạn) */
  SALES_RETURN_CREATE: "SalesReturnController/create",
  /** POST /api/sales/returns/late (trả quá hạn, quản lý cho phép) */
  SALES_RETURN_CREATE_LATE: "SalesReturnController/createLate",
  /** GET /api/sales/returns/{id} */
  SALES_RETURN_GET: "SalesReturnController/get",
  /** GET /api/sales/orders/{id}/returns */
  SALES_RETURN_LIST_BY_ORDER: "SalesReturnController/listByOrder",
  /** GET /api/sales/refunds */
  REFUND_SEARCH: "RefundController/search",
  /** POST /api/sales/refunds/{id}/completion */
  REFUND_MARK_REFUNDED: "RefundController/markRefunded",
  /** GET /api/sales/audit-log */
  SALES_AUDIT_SEARCH: "SalesAuditController/search",
  /** POST /public/t/{code}/contact-requests (khách, qua customer-api; FE nhân viên không gọi) */
  SHOP_CONTACT_CREATE: "ShopContactController/create",
  /** GET /api/sales/contact-requests */
  SALES_CONTACT_SEARCH: "SalesContactController/search",
  /** GET /api/sales/contact-requests/{id} */
  SALES_CONTACT_VIEW: "SalesContactController/get",
  /** GET /api/sales/contact-requests/{id}/contact (liên hệ khách đầy đủ) */
  SALES_CONTACT_FULL: "SalesContactController/getContact",
  /** PUT /api/sales/contact-requests/{id}/status */
  SALES_CONTACT_STATUS: "SalesContactController/updateStatus",
  /** POST /api/sales/contact-requests/{id}/anonymization */
  SALES_CONTACT_ANONYMIZE: "SalesContactController/anonymize",
  /** GET /api/contracts (hợp đồng của tenant mình, chỉ đọc) */
  CONTRACT_LIST: "TenantContractController/list",
  /** GET /api/contracts/current */
  CONTRACT_CURRENT: "TenantContractController/current",
  /** GET /api/storefront-origins (website của tenant mình, chỉ đọc) */
  STOREFRONT_ORIGIN_LIST: "TenantStorefrontOriginController/list",
  /** GET /api/circulation/policy */
  CIRCULATION_POLICY_GET: "CirculationPolicyController/get",
  /** PUT /api/circulation/policy */
  CIRCULATION_POLICY_UPDATE: "CirculationPolicyController/update",
  /** GET /api/authors */
  AUTHOR_SEARCH: "AuthorController/search",
  /** GET /api/authors/options */
  AUTHOR_OPTIONS: "AuthorController/options",
  /** GET /api/authors/{id} */
  AUTHOR_VIEW: "AuthorController/get",
  /** POST /api/authors */
  AUTHOR_CREATE: "AuthorController/create",
  /** PUT /api/authors/{id} */
  AUTHOR_UPDATE: "AuthorController/update",
  /** PUT /api/authors/{id}/status */
  AUTHOR_SET_STATUS: "AuthorController/setStatus",
  /** GET /api/publishers */
  PUBLISHER_SEARCH: "PublisherController/search",
  /** GET /api/publishers/options */
  PUBLISHER_OPTIONS: "PublisherController/options",
  /** GET /api/publishers/{id} */
  PUBLISHER_VIEW: "PublisherController/get",
  /** POST /api/publishers */
  PUBLISHER_CREATE: "PublisherController/create",
  /** PUT /api/publishers/{id} */
  PUBLISHER_UPDATE: "PublisherController/update",
  /** PUT /api/publishers/{id}/status */
  PUBLISHER_SET_STATUS: "PublisherController/setStatus",
  /** GET /api/categories */
  CATEGORY_SEARCH: "CategoryController/search",
  /** GET /api/categories/options */
  CATEGORY_OPTIONS: "CategoryController/options",
  /** GET /api/categories/{id} */
  CATEGORY_VIEW: "CategoryController/get",
  /** POST /api/categories */
  CATEGORY_CREATE: "CategoryController/create",
  /** PUT /api/categories/{id} */
  CATEGORY_UPDATE: "CategoryController/update",
  /** PUT /api/categories/{id}/status */
  CATEGORY_SET_STATUS: "CategoryController/setStatus",
  /** GET /api/shelf-locations */
  SHELF_LOCATION_SEARCH: "ShelfLocationController/search",
  /** GET /api/shelf-locations/options */
  SHELF_LOCATION_OPTIONS: "ShelfLocationController/options",
  /** GET /api/shelf-locations/{id} */
  SHELF_LOCATION_VIEW: "ShelfLocationController/get",
  /** POST /api/shelf-locations */
  SHELF_LOCATION_CREATE: "ShelfLocationController/create",
  /** PUT /api/shelf-locations/{id} */
  SHELF_LOCATION_UPDATE: "ShelfLocationController/update",
  /** PUT /api/shelf-locations/{id}/status */
  SHELF_LOCATION_SET_STATUS: "ShelfLocationController/setStatus",
  /** PUT /api/book-copies/{id}/shelf-location (đổi/gỡ vị trí kệ của bản sao) */
  COPY_MOVE_SHELF_LOCATION: "BookCopyController/moveShelfLocation",
} as const;
