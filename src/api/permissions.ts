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
  /** PUT /api/book-copies/{id}/acquisition (thay toàn bộ 6 field nhập kho) */
  COPY_UPDATE_ACQUISITION: "BookCopyController/updateAcquisition",
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
  /** GET /api/users/export */
  USER_EXPORT: "UserController/exportUsers",
  /** POST /api/auth/credentials */
  CREDENTIAL_CREATE: "AuthController/register",
  /** GET /api/users/{id}/reader-profile */
  READER_VIEW: "ReaderProfileController/get",
  /** POST /api/users/{id}/reader-profile */
  READER_ISSUE: "ReaderProfileController/issue",
  /** PUT /api/users/{id}/reader-profile */
  READER_UPDATE: "ReaderProfileController/update",
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
  /** GET /api/sales/logs/integration (nhật ký tích hợp: gọi ra, gọi vào) */
  LOG_INTEGRATION: "OperationalLogController/integration",
  /** GET /api/sales/logs/system (nhật ký hệ thống chọn lọc) */
  LOG_SYSTEM: "OperationalLogController/system",
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
  /** GET /api/sales/settings/order-abuse-policy */
  ORDER_ABUSE_POLICY_GET: "OrderAbusePolicyController/get",
  /** PUT /api/sales/settings/order-abuse-policy */
  ORDER_ABUSE_POLICY_UPDATE: "OrderAbusePolicyController/update",
  /** GET /api/sales/banners */
  BANNER_LIST: "SalesBannerController/list",
  /** GET /api/sales/banners/{id} */
  BANNER_GET: "SalesBannerController/get",
  /** POST /api/sales/banners */
  BANNER_CREATE: "SalesBannerController/create",
  /** PUT /api/sales/banners/{id} */
  BANNER_UPDATE: "SalesBannerController/update",
  /** DELETE /api/sales/banners/{id} */
  BANNER_DELETE: "SalesBannerController/delete",
  /** POST /api/sales/stock-items */
  STOCK_REGISTER: "StockItemController/register",
  /** GET /api/sales/stock-items */
  STOCK_SEARCH: "StockItemController/search",
  /** GET /api/sales/stock-items/{titleId} */
  STOCK_VIEW: "StockItemController/get",
  /** GET /api/sales/stock-items/{titleId}/details (có giá nhập và ghi chú nội bộ) */
  STOCK_DETAILS_VIEW: "StockItemController/getDetails",
  /** PUT /api/sales/stock-items/{titleId}/details (thay toàn bộ 7 field) */
  STOCK_DETAILS_UPDATE: "StockItemController/updateDetails",
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
  /** GET /api/sales/payments/intents/{id} (thăm dò trạng thái thanh toán QR) */
  PAYMENT_INTENT_VIEW: "PaymentIntentController/get",
  /** POST /api/sales/payments/intents/{id}/cancel */
  PAYMENT_INTENT_CANCEL: "PaymentIntentController/cancel",
  /** POST /api/sales/payments/intents/{id}/confirm (xác nhận đã thu tiền mặt/thẻ/chuyển khoản) */
  PAYMENT_INTENT_CONFIRM: "PaymentIntentController/confirm",
  /** POST /api/sales/payments/intents/{id}/simulate-paid (sandbox) */
  PAYMENT_INTENT_SIMULATE_PAID: "PaymentIntentController/simulatePaid",
  /** GET /api/sales/orders */
  SALES_ORDER_SEARCH: "SalesOrderController/search",
  /** GET /api/sales/orders/{id} */
  SALES_ORDER_VIEW: "SalesOrderController/get",
  /** GET /api/sales/orders/{id}/contact (liên hệ khách đầy đủ) */
  SALES_ORDER_CONTACT: "SalesOrderController/getContact",
  /** GET /api/sales/orders/{id}/notes (ghi chú nội bộ, ngày giao dự kiến) */
  SALES_ORDER_NOTES_VIEW: "SalesOrderController/getNotes",
  /** PUT /api/sales/orders/{id}/notes */
  SALES_ORDER_NOTES_UPDATE: "SalesOrderController/updateNotes",
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
  /** GET /api/circulation/damage-levels */
  DAMAGE_LEVEL_LIST: "DamageLevelController/list",
  /** POST /api/circulation/damage-levels */
  DAMAGE_LEVEL_CREATE: "DamageLevelController/create",
  /** PUT /api/circulation/damage-levels/{code} */
  DAMAGE_LEVEL_UPDATE: "DamageLevelController/update",
  /** DELETE /api/circulation/damage-levels/{code} */
  DAMAGE_LEVEL_DELETE: "DamageLevelController/delete",
  /** GET /api/circulation/compensation-policy */
  COMPENSATION_POLICY_GET: "CompensationPolicyController/get",
  /** PUT /api/circulation/compensation-policy */
  COMPENSATION_POLICY_UPDATE: "CompensationPolicyController/update",
  /** POST /api/fines/{id}/adjustment-requests (đề nghị miễn/giảm) */
  FINE_ADJUSTMENT_REQUEST: "FineAdjustmentController/request",
  /** GET /api/fines/adjustment-requests */
  FINE_ADJUSTMENT_LIST: "FineAdjustmentController/list",
  /** POST /api/fines/adjustment-requests/{requestId}/approve */
  FINE_ADJUSTMENT_APPROVE: "FineAdjustmentController/approve",
  /** POST /api/fines/adjustment-requests/{requestId}/reject */
  FINE_ADJUSTMENT_REJECT: "FineAdjustmentController/reject",
  /** GET /api/fines/refund-requests */
  FINE_REFUND_LIST: "FineRefundController/list",
  /** POST /api/fines/refund-requests/{id}/approve */
  FINE_REFUND_APPROVE: "FineRefundController/approve",
  /** POST /api/fines/refund-requests/{id}/reject */
  FINE_REFUND_REJECT: "FineRefundController/reject",
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
  /** POST /api/identity/imports/users (tải lên tệp Excel người dùng) */
  USER_IMPORT_UPLOAD: "UserImportController/upload",
  /** POST /api/identity/imports/users/{importId}/confirm */
  USER_IMPORT_CONFIRM: "UserImportController/confirm",
  /** GET /api/identity/imports/users/{importId}/credentials (file mật khẩu tạm, tải một lần) */
  USER_IMPORT_CREDENTIALS: "UserImportController/credentials",
  /** POST /api/catalog/imports/titles */
  TITLE_IMPORT_UPLOAD: "TitleImportController/upload",
  /** POST /api/catalog/imports/titles/{importId}/confirm */
  TITLE_IMPORT_CONFIRM: "TitleImportController/confirm",
  /** POST /api/catalog/imports/authors */
  AUTHOR_IMPORT_UPLOAD: "AuthorImportController/upload",
  /** POST /api/catalog/imports/authors/{importId}/confirm */
  AUTHOR_IMPORT_CONFIRM: "AuthorImportController/confirm",
  /** POST /api/catalog/imports/publishers */
  PUBLISHER_IMPORT_UPLOAD: "PublisherImportController/upload",
  /** POST /api/catalog/imports/publishers/{importId}/confirm */
  PUBLISHER_IMPORT_CONFIRM: "PublisherImportController/confirm",
  /** POST /api/catalog/imports/categories */
  CATEGORY_IMPORT_UPLOAD: "CategoryImportController/upload",
  /** POST /api/catalog/imports/categories/{importId}/confirm */
  CATEGORY_IMPORT_CONFIRM: "CategoryImportController/confirm",
  /** POST /api/catalog/imports/shelf-locations */
  SHELF_LOCATION_IMPORT_UPLOAD: "ShelfLocationImportController/upload",
  /** POST /api/catalog/imports/shelf-locations/{importId}/confirm */
  SHELF_LOCATION_IMPORT_CONFIRM: "ShelfLocationImportController/confirm",
  /** POST /api/catalog/imports/series */
  SERIES_IMPORT_UPLOAD: "SeriesImportController/upload",
  /** POST /api/catalog/imports/series/{importId}/confirm */
  SERIES_IMPORT_CONFIRM: "SeriesImportController/confirm",
  /** POST /api/sales/imports/stock-items */
  STOCK_IMPORT_UPLOAD: "StockItemImportController/upload",
  /** POST /api/sales/imports/stock-items/{importId}/confirm */
  STOCK_IMPORT_CONFIRM: "StockItemImportController/confirm",
  /** POST /api/sales/imports/suppliers */
  SUPPLIER_IMPORT_UPLOAD: "SupplierImportController/upload",
  /** POST /api/sales/imports/suppliers/{importId}/confirm */
  SUPPLIER_IMPORT_CONFIRM: "SupplierImportController/confirm",
  /** GET /api/applications */
  APPLICATION_LIST: "ApplicationController/list",
  /** GET /api/applications/{id} */
  APPLICATION_VIEW: "ApplicationController/get",
  /** POST /api/applications */
  APPLICATION_CREATE: "ApplicationController/create",
  /** PUT /api/applications/{id} */
  APPLICATION_UPDATE: "ApplicationController/update",
  /** DELETE /api/applications/{id} (thu hồi Application) */
  APPLICATION_DELETE: "ApplicationController/delete",
  /** PUT /api/applications/{id}/scopes */
  APPLICATION_REPLACE_SCOPES: "ApplicationController/replaceScopes",
  /** POST /api/applications/{id}/credentials (tạo, xoay vòng) */
  APPLICATION_CREATE_CREDENTIAL: "ApplicationController/createCredential",
  /** POST /api/applications/{id}/credentials/{credentialId}/revocation */
  APPLICATION_REVOKE_CREDENTIAL: "ApplicationController/revokeCredential",
  /** POST /api/applications/{id}/site-key/rotation */
  APPLICATION_ROTATE_SITE_KEY: "ApplicationController/rotateSiteKey",
  /** GET /api/applications/{id}/domains */
  APPLICATION_LIST_DOMAINS: "ApplicationController/listDomains",
  /** POST /api/applications/{id}/domains */
  APPLICATION_ADD_DOMAIN: "ApplicationController/addDomain",
  /** DELETE /api/applications/{id}/domains/{domainId} */
  APPLICATION_REMOVE_DOMAIN: "ApplicationController/removeDomain",
  /** GET /api/applications/{id}/history */
  APPLICATION_HISTORY: "ApplicationController/history",
  /** GET /api/applications/{id}/usage?from&to (thống kê yêu cầu theo ngày; FE chưa có màn) */
  APPLICATION_USAGE: "ApplicationController/usage",
  /** GET /api/series/options (ô chọn bộ sách) */
  SERIES_OPTIONS: "SeriesController/options",
  /** GET /api/works */
  WORK_SEARCH: "WorkController/search",
  /** GET /api/works/{id} */
  WORK_VIEW: "WorkController/get",
  /** POST /api/works */
  WORK_CREATE: "WorkController/create",
  /** PUT /api/works/{id} */
  WORK_UPDATE: "WorkController/update",
  /** POST /api/works/{id}/merge */
  WORK_MERGE: "WorkController/merge",
  /** PUT /api/books/{id}/work (gắn ấn bản vào tác phẩm khác hoặc tách ra tác phẩm mới) */
  BOOK_CHANGE_WORK: "TitleController/changeWork",
  /** POST /api/borrowings/found (ghi nhận tìm lại sách đã báo mất, đề nghị hoàn khoản) */
  BORROWING_REPORT_FOUND: "BorrowingController/reportFound",
  /** GET /api/reports/overdue-borrowings (CSV, module LENDING) */
  REPORT_OVERDUE_CSV: "LendingReportController/overdueBorrowingsCsv",
  /** GET /api/reports/stock (CSV, module SALES) */
  REPORT_STOCK_CSV: "SalesReportController/stockCsv",
  /** GET /api/reports/orders (CSV, module SALES) */
  REPORT_ORDERS_CSV: "SalesReportController/ordersCsv",
  // ---- Hóa đơn VAT nội bộ (ADR-0030 gói A, docs/api/sales-invoices.md) ----
  /** GET /api/sales/invoices */
  INVOICE_SEARCH: "InvoiceController/search",
  /** GET /api/sales/invoices/{id} */
  INVOICE_GET: "InvoiceController/get",
  /** GET /api/sales/invoices/{id}/print (HTML) */
  INVOICE_PRINT: "InvoiceController/print",
  /** POST /api/sales/orders/{orderId}/invoice */
  INVOICE_ISSUE: "InvoiceController/issue",
  /** POST /api/sales/invoices/{id}/cancellation */
  INVOICE_CANCEL: "InvoiceController/cancel",
  /** POST /api/sales/invoices/{id}/replacement */
  INVOICE_REPLACE: "InvoiceController/replace",
  /** GET /api/sales/orders/{orderId}/invoice-request */
  INVOICE_REQUEST_GET: "InvoiceRequestController/get",
  /** PUT /api/sales/orders/{orderId}/invoice-request */
  INVOICE_REQUEST_SAVE: "InvoiceRequestController/save",
  /** GET /api/sales/invoice-settings */
  INVOICE_SETTINGS_GET: "InvoiceSettingsController/get",
  /** PUT /api/sales/invoice-settings */
  INVOICE_SETTINGS_UPDATE: "InvoiceSettingsController/update",
  // ---- Chốt ca thu ngân (ADR-0030 gói B, docs/api/sales-shifts.md) ----
  /** POST /api/sales/shifts (mở ca) */
  SHIFT_OPEN: "CashierShiftController/open",
  /** GET /api/sales/shifts/me/current */
  SHIFT_CURRENT: "CashierShiftController/current",
  /** GET /api/sales/shifts/me */
  SHIFT_MINE: "CashierShiftController/mine",
  /** GET /api/sales/shifts/me/{id} */
  SHIFT_GET_MINE: "CashierShiftController/getMine",
  /** POST /api/sales/shifts/me/current/closing */
  SHIFT_CLOSE: "CashierShiftController/close",
  /** GET /api/sales/shifts (quản lý) */
  SHIFT_ADMIN_SEARCH: "CashierShiftAdminController/search",
  /** GET /api/sales/shifts/{id} (quản lý) */
  SHIFT_ADMIN_GET: "CashierShiftAdminController/get",
  /** POST /api/sales/shifts/{id}/closing (đóng thay) */
  SHIFT_ADMIN_CLOSE_ON_BEHALF: "CashierShiftAdminController/closeOnBehalf",
  /** POST /api/sales/shifts/{id}/reopening */
  SHIFT_ADMIN_REOPEN: "CashierShiftAdminController/reopen",
  /** POST /api/sales/shifts/{id}/variance-approval */
  SHIFT_ADMIN_APPROVE_VARIANCE: "CashierShiftAdminController/approveVariance",
  /** GET /api/sales/shift-settings */
  SHIFT_SETTINGS_GET: "CashierShiftSettingsController/get",
  /** PUT /api/sales/shift-settings */
  SHIFT_SETTINGS_UPDATE: "CashierShiftSettingsController/update",
  // ---- Thông báo theo sự kiện (ADR-0030 gói C, docs/api/notifications.md; khóa do support-service kiểm) ----
  /** GET /api/notification-deliveries */
  NOTIFICATION_DELIVERY_SEARCH: "NotificationDeliveryController/search",
  /** POST /api/notification-deliveries/{id}/retry */
  NOTIFICATION_DELIVERY_RETRY: "NotificationDeliveryController/retry",
  /** GET /api/notification-settings/channels */
  NOTIFICATION_CHANNELS_GET: "NotificationSettingsController/getChannels",
  /** PUT /api/notification-settings/channels */
  NOTIFICATION_CHANNELS_UPDATE: "NotificationSettingsController/updateChannels",
  /** GET /api/notification-templates */
  NOTIFICATION_TEMPLATE_LIST: "NotificationTemplateController/list",
  /** GET /api/notification-templates/{type}/{channel} */
  NOTIFICATION_TEMPLATE_GET: "NotificationTemplateController/get",
  /** PUT /api/notification-templates/{type}/{channel} */
  NOTIFICATION_TEMPLATE_SAVE: "NotificationTemplateController/save",
  /** POST /api/notification-templates/{type}/{channel}/preview */
  NOTIFICATION_TEMPLATE_PREVIEW: "NotificationTemplateController/preview",
} as const;
