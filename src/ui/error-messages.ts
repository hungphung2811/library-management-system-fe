import type { ErrorInfo } from "@/api";

export type DescribedError = {
  /** Câu hiển thị chính cho người dùng. */
  text: string;
  /** message nguyên văn của BE (chữ nhỏ bên dưới), có khi chứa dữ liệu hữu ích như số cuốn còn được mượn. */
  detail?: string;
  /** Danh sách lỗi theo trường (400). */
  details?: string[];
};

/** Bảng mã lỗi chung (đặc tả UI 0.5). Mã riêng của zone truyền qua `extra`, không sửa file này. */
export const ERROR_MESSAGES: Record<string, string> = {
  NETWORK: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
  COPY_NOT_FOUND: "Không tìm thấy bản sao này. Kiểm tra lại mã vạch.",
  AUTHOR_NOT_FOUND: "Không tìm thấy tác giả này (có thể đã bị xóa).",
  PUBLISHER_NOT_FOUND: "Không tìm thấy nhà xuất bản này.",
  CATEGORY_NOT_FOUND: "Không tìm thấy thể loại này.",
  SHELF_LOCATION_NOT_FOUND: "Không tìm thấy vị trí kệ này.",
  DUPLICATE_AUTHOR_NAME: "Đã có tác giả trùng tên này.",
  DUPLICATE_PUBLISHER_NAME: "Đã có nhà xuất bản trùng tên này.",
  DUPLICATE_CATEGORY_NAME: "Đã có thể loại trùng tên này.",
  DUPLICATE_SHELF_LOCATION_CODE: "Đã có vị trí kệ trùng mã này.",
  INVALID_AUTHOR: "Thông tin tác giả chưa hợp lệ (tên bắt buộc, tối đa 255 ký tự; sách tối đa 20 tác giả).",
  INVALID_PUBLISHER: "Thông tin nhà xuất bản chưa hợp lệ (tên bắt buộc, tối đa 255 ký tự).",
  INVALID_CATEGORY: "Thông tin thể loại chưa hợp lệ (tên bắt buộc, tối đa 255 ký tự).",
  INVALID_SHELF_LOCATION: "Thông tin vị trí kệ chưa hợp lệ (mã bắt buộc, tối đa 64 ký tự).",
  CATEGORY_CYCLE: "Không thể chọn thể loại con của chính nó làm thể loại cha.",
  CATEGORY_TOO_DEEP: "Thể loại chỉ có tối đa 2 cấp. Hãy chọn thể loại cha ở cấp gốc.",
  AUTHOR_INACTIVE: "Tác giả này đã ngừng dùng nên không thể gán mới.",
  PUBLISHER_INACTIVE: "Nhà xuất bản này đã ngừng dùng nên không thể gán mới.",
  CATEGORY_INACTIVE: "Thể loại này đã ngừng dùng nên không thể gán mới.",
  SHELF_LOCATION_INACTIVE: "Vị trí kệ này đã ngừng dùng nên không thể gán mới.",
  READER_NOT_FOUND: "Người này chưa có hồ sơ độc giả. Hãy cấp thẻ trước.",
  BORROW_RULE_NOT_FOUND: "Hệ thống chưa cấu hình quy định mượn cho loại độc giả này. Liên hệ quản trị viên.",
  CARD_INVALID: "Thẻ độc giả đã hết hạn hoặc tài khoản đang bị khóa.",
  OVERDUE_ITEMS: "Độc giả còn sách quá hạn chưa trả nên chưa thể mượn thêm.",
  UNPAID_FINES: "Độc giả còn khoản phạt chưa thanh toán.",
  BORROWING_LIMIT_EXCEEDED: "Vượt hạn mức mượn.",
  COPY_NOT_AVAILABLE: "Bản sao này hiện không sẵn sàng để cho mượn.",
  COPY_RESERVED_FOR_OTHER: "Bản sao này đang được giữ cho độc giả khác.",
  COPY_ALREADY_BORROWED: "Bản sao này đang nằm trong một phiếu mượn khác.",
  COPY_STATUS_CONFLICT: "Không thể chuyển bản sao sang trạng thái này từ trạng thái hiện tại.",
  MODULE_NOT_ENABLED:
    "Gói dịch vụ của đơn vị chưa bật chức năng này. Nếu vừa được bật, hãy đăng nhập lại để làm mới phiên.",
  TENANT_REQUIRED: "Bạn chưa chọn đơn vị làm việc. Hãy chọn đơn vị rồi thử lại.",
  TENANT_MODULE_REQUIRED: "Không thể tắt module cuối cùng: đơn vị phải còn ít nhất một module.",
  TENANT_NOT_FOUND: "Không tìm thấy đơn vị này.",
  UNKNOWN_MODULE: "Module không hợp lệ.",
  INVALID_MODULES: "Danh sách module không hợp lệ.",
  MENU_NOT_FOUND: "Không tìm thấy mục menu này.",
  MENU_PARENT_NOT_FOUND: "Không tìm thấy mục menu cha.",
  MENU_CODE_DUPLICATED: "Mã menu đã tồn tại. Hãy dùng mã khác.",
  MENU_HAS_CHILDREN: "Mục menu còn mục con nên chưa thể xóa. Hãy xóa hoặc chuyển các mục con trước.",
  MENU_VERSION_CONFLICT: "Mục menu vừa được người khác sửa. Hãy tải lại rồi thử lại.",
  MENU_CONFLICT: "Menu vừa thay đổi do thao tác khác. Hãy tải lại rồi thử lại.",
  MENU_CYCLE: "Không thể chuyển mục menu vào chính nó hoặc mục con của nó.",
  MENU_TOO_DEEP: "Menu lồng quá sâu.",
  MENU_PATH_INVALID: "Đường dẫn menu không hợp lệ.",
  MENU_PERMISSION_KEY_INVALID: "Khóa quyền của menu không hợp lệ.",
  MENU_LIMIT_EXCEEDED: "Số mục menu vượt giới hạn cho phép.",
  MENU_INVALID: "Dữ liệu menu chưa hợp lệ.",
  MENU_MODULE_INVALID: "Module của mục menu không hợp lệ.",
  MENU_ALREADY_INITIALIZED: "Menu đã được khởi tạo mặc định trước đó.",
  ROLE_IN_USE: "Vai trò đang được gán cho người dùng nên chưa thể xóa. Hãy thu hồi vai trò trước.",
  LAST_ADMIN_ROLE: "Không thể thao tác vì đây là vai trò quản trị cuối cùng.",
  DUPLICATE: "Tên đã được dùng bởi bản ghi khác. Hãy chọn tên khác.",
  USER_OPERATION_NOT_ALLOWED: "Bạn không được phép thao tác trên tài khoản này (quản trị nền tảng hoặc thuộc đơn vị khác).",
  INVALID_USER: "Người dùng này chưa có tài khoản đăng nhập nên chưa thể đặt lại mật khẩu.",
  INVALID_RESET_TOKEN: "Liên kết đặt lại mật khẩu không đúng, đã hết hạn hoặc đã được dùng. Hãy yêu cầu lại.",
  INVALID_USERNAME: "Tên đăng nhập không hợp lệ.",
  INVALID_FULL_NAME: "Họ tên không hợp lệ.",
  INVALID_EMAIL: "Email không hợp lệ.",
  DEPARTMENT_NOT_FOUND: "Mã phòng ban không tồn tại hoặc không còn hoạt động.",
  WEAK_PASSWORD: "Mật khẩu tạm chưa đạt (8 đến 72 ký tự, không trùng tên đăng nhập).",
  DUPLICATE_IN_FILE: "Tên đăng nhập bị lặp trong tệp.",
  DUPLICATE_USER: "Tên đăng nhập đã được sử dụng.",
  DUPLICATE_READER: "Số thẻ độc giả đã tồn tại.",
  INVALID_ROW: "Dòng dữ liệu không hợp lệ.",
  INTERNAL_ERROR: "Lỗi hệ thống khi xử lý dòng này.",
  INVALID_ACCESS_CONTROL:"Tên vai trò chưa đúng quy tắc (chữ HOA, số và dấu gạch dưới).",
  BORROWING_NOT_FOUND: "Không tìm thấy phiếu mượn.",
  INSUFFICIENT_STOCK: "Tồn kho khả dụng không đủ.",
  DISCOUNT_NOT_ALLOWED: "Bạn không có quyền áp dụng giảm giá cho đơn này.",
  DISCOUNT_EXCEEDS_AMOUNT: "Giảm giá vượt quá giá trị đơn hàng.",
  SUPPLIER_EXISTS: "Nhà cung cấp trùng tên đã tồn tại.",
  SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp.",
  STOCK_ITEM_EXISTS: "Đầu sách này đã được đăng ký bán.",
  SKU_EXISTS: "Mã SKU đã tồn tại.",
  STOCK_ITEM_NOT_FOUND: "Không tìm thấy mặt hàng tồn kho.",
  STOCK_ITEM_NOT_REGISTERED: "Đầu sách này chưa được đăng ký bán. Hãy đăng ký trước.",
  TITLE_NOT_AVAILABLE: "Không tìm thấy đầu sách trong danh mục.",
  CATALOG_UNAVAILABLE: "Dịch vụ danh mục sách tạm thời chưa phản hồi. Vui lòng thử lại sau.",
  INVALID_REQUEST: "Yêu cầu chưa hợp lệ. Kiểm tra lại dữ liệu đã nhập.",
  INVALID_QUANTITY: "Số lượng không hợp lệ.",
  INVALID_PRICE: "Giá không hợp lệ.",
  INVALID_SETTINGS: "Cấu hình bán hàng chưa hợp lệ.",
  REASON_REQUIRED: "Vui lòng nhập lý do.",
  RECEIPT_NOT_FOUND: "Không tìm thấy phiếu nhập.",
  RECEIPT_STATE_CONFLICT: "Phiếu nhập không còn ở trạng thái cho phép thao tác này.",
  SHOP_CONTACT_NOT_FOUND: "Không tìm thấy yêu cầu liên hệ.",
  SHOP_CONTACT_STATE_CONFLICT: "Yêu cầu liên hệ vừa được người khác xử lý hoặc không thể chuyển sang trạng thái này. Đã tải lại bản mới nhất.",
  SHOP_CONTACT_LIMIT_EXCEEDED: "Đã gửi quá nhiều yêu cầu liên hệ trong 24 giờ. Vui lòng thử lại sau.",
  CONSENT_REQUIRED: "Cần đồng ý cho phép xử lý dữ liệu cá nhân trước khi gửi.",
  USER_REQUIRED: "Cần đăng nhập bằng tài khoản người dùng để thực hiện thao tác này.",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
  ORDER_STATE_CONFLICT: "Đơn hàng vừa được người khác thao tác hoặc không còn ở trạng thái cho phép thao tác này. Hãy tải lại rồi kiểm tra.",
  SETTINGS_VERSION_CONFLICT: "Cấu hình vừa được người khác sửa. Hãy tải lại rồi thử lại.",
  POLICY_VERSION_CONFLICT: "Chính sách mượn trả vừa được người khác sửa. Hãy tải lại rồi thử lại.",
  INVALID_CIRCULATION_POLICY: "Chính sách mượn trả có giá trị ngoài khoảng cho phép. Hãy kiểm tra lại các ô.",
  DUPLICATE_REQUEST: "Yêu cầu bị gửi trùng. Hãy tải lại để xem kết quả.",
  PAYMENT_NOT_ENABLED: "Hình thức thanh toán này (QR/MoMo) chưa được bật. Hãy chọn hình thức khác.",
  PAYMENT_GATEWAY_ERROR: "Cổng thanh toán đang lỗi hoặc không trả lời. Thử lại sau ít phút hoặc chọn hình thức khác.",
  PAYMENT_SANDBOX_DISABLED: "Cổng thanh toán giả lập đang tắt nên không thể giả lập thanh toán.",
  PAYMENT_INTENT_STATE_CONFLICT: "Lệnh thanh toán đã đổi trạng thái (đã thanh toán hoặc hết hạn) nên không thể thực hiện thao tác này.",
  PAYMENT_INTENT_NOT_FOUND: "Không tìm thấy lệnh thanh toán.",
  PAYMENT_INTENT_EXPIRED: "Lệnh thanh toán đã hết hạn. Hãy tạo mã QR mới.",
  PAYMENT_INTENT_CANCELLED: "Lệnh thanh toán đã bị hủy.",
  PAYMENT_AMOUNT_MISMATCH: "Số tiền thanh toán không khớp với lệnh thanh toán.",
  PAYMENT_DUPLICATE_TRANSACTION: "Mã giao dịch này đã được dùng cho một lệnh thanh toán khác.",
  INVALID_WEBHOOK_SIGNATURE: "Chữ ký thông báo thanh toán không hợp lệ.",
  ORDER_NOT_PAID: "Đơn chưa được đánh dấu đã thu tiền nên chưa thể hoàn tất hoặc trả hàng.",
  RETURN_QUANTITY_EXCEEDED: "Số lượng trả vượt quá số đã mua chưa trả của dòng hàng.",
  RETURN_WINDOW_EXPIRED: "Đơn đã quá hạn trả hàng.",
  RETURN_NOT_FOUND: "Không tìm thấy phiếu trả hàng.",
  REFUND_NOT_FOUND: "Không tìm thấy khoản hoàn tiền.",
  LATE_REASON_REQUIRED: "Trả quá hạn bắt buộc nhập lý do.",
  // Hợp đồng thuê dịch vụ (ADR-0012)
  INVALID_CONTRACT:
    "Dữ liệu hợp đồng chưa hợp lệ: cần ngày kết thúc không trước ngày bắt đầu, tổng tiền không âm, chu kỳ đúng và lý do khi hủy.",
  INVALID_PAYMENT: "Thanh toán chưa hợp lệ: số tiền phải lớn hơn 0 và phải có ngày thanh toán.",
  CONTRACT_NOT_FOUND: "Không tìm thấy hợp đồng này.",
  PAYMENT_NOT_FOUND: "Không tìm thấy khoản thanh toán này.",
  CONTRACT_OVERLAP: "Thời hạn chồng với một hợp đồng đang hiệu lực khác của đơn vị. Hãy đổi ngày hoặc kết thúc hợp đồng kia trước.",
  CONTRACT_NOT_EDITABLE: "Hợp đồng không còn ở trạng thái cho phép thao tác này (hợp đồng đang hiệu lực chỉ sửa được ghi chú nội bộ).",
  CONTRACT_VERSION_CONFLICT: "Hợp đồng vừa được người khác sửa. Hãy tải lại rồi thử lại.",
  PAYMENT_NOT_ALLOWED: "Hợp đồng nháp chưa ghi được thanh toán. Hãy kích hoạt hợp đồng trước.",
  PAYMENT_ALREADY_REVERSED: "Khoản thanh toán này đã được đảo rồi.",
  // Origin website của tenant (ADR-0013); lý do chi tiết của ORIGIN_INVALID xử lý ở pages/platform/_lib/storefront-origin.ts
  ORIGIN_INVALID: "Origin chưa hợp lệ. Nhập dạng https://tenant.example.com, không có đường dẫn, không wildcard.",
  ORIGIN_DUPLICATED: "Origin này đã được khai báo. Mỗi origin chỉ thuộc một đơn vị trên toàn hệ thống.",
  ORIGIN_LIMIT_EXCEEDED: "Đơn vị đã đạt số origin tối đa. Hãy xóa bớt một origin trước khi thêm.",
  STOREFRONT_ORIGIN_NOT_FOUND: "Không tìm thấy origin này (có thể đã bị xóa). Hãy tải lại danh sách.",
  PAYMENT_NOT_REVERSIBLE: "Dòng đảo không đảo lại được. Muốn sửa hãy ghi một khoản thanh toán mới.",
  // Application, scope, credential (Developer Portal, docs/api/applications.md)
  APPLICATION_NOT_FOUND: "Không tìm thấy ứng dụng này (có thể đã bị thu hồi). Hãy tải lại danh sách.",
  CREDENTIAL_NOT_FOUND: "Không tìm thấy credential này. Hãy tải lại trang.",
  APPLICATION_DOMAIN_NOT_FOUND: "Không tìm thấy domain này (có thể đã bị xóa). Hãy tải lại danh sách.",
  INVALID_APPLICATION: "Thông tin ứng dụng chưa hợp lệ (tên 1-100 ký tự, giới hạn tốc độ từ 1 đến 1.000.000 yêu cầu/phút).",
  INVALID_SCOPE: "Có scope không nằm trong danh mục hỗ trợ. Hãy tải lại trang rồi chọn lại.",
  SCOPE_NOT_GRANTABLE: "Scope này chưa mở cấp. Hiện chỉ cấp được các scope đọc: books:read, inventory:read, orders:read.",
  CONTRACT_REQUIRED: "Đơn vị chưa có hợp đồng thuê đang hiệu lực nên chưa tạo được ứng dụng tích hợp (INTEGRATION). Hãy liên hệ nhà cung cấp dịch vụ.",
  KIND_MISMATCH: "Thao tác này không áp dụng cho loại ứng dụng đang chọn.",
  APPLICATION_NAME_DUPLICATED: "Đã có ứng dụng trùng tên này trong đơn vị (không phân biệt hoa thường).",
  APPLICATION_LIMIT_EXCEEDED: "Đơn vị đã đạt số ứng dụng tối đa. Hãy thu hồi bớt một ứng dụng trước khi tạo mới.",
  CREDENTIAL_LIMIT_EXCEEDED: "Ứng dụng đã có 2 credential đang dùng được. Hãy thu hồi credential cũ trước khi tạo hoặc xoay vòng.",
  CREDENTIAL_NOT_ACTIVE: "Credential này không còn hoạt động nên không thu hồi được nữa.",
  APPLICATION_NOT_ACTIVE: "Ứng dụng không ở trạng thái hoạt động (có thể đang bị tạm ngưng) nên không thực hiện được thao tác này.",
  APPLICATION_NOT_SUSPENDED: "Ứng dụng không ở trạng thái tạm ngưng.",
  USAGE_UNAVAILABLE: "Chưa lấy được thống kê sử dụng lúc này. Vui lòng thử lại sau.",
  // Hóa đơn VAT nội bộ (ADR-0030 gói A, docs/api/sales-invoices.md)
  INVOICE_NOT_FOUND: "Không tìm thấy hóa đơn (hoặc đơn này chưa có yêu cầu xuất hóa đơn).",
  ORDER_NOT_INVOICEABLE: "Đơn này chưa xuất hóa đơn được: đơn phải hoàn tất và đã thu tiền, chưa có phiếu trả hàng và chưa bị hủy.",
  INVOICE_ALREADY_EXISTS: "Đơn này đã có hóa đơn còn hiệu lực. Muốn đổi thông tin hãy hủy hoặc thay thế hóa đơn.",
  INVOICE_STATE_CONFLICT: "Hóa đơn không ở trạng thái cho phép thao tác này (có thể đã bị hủy, hoặc vừa được người khác sửa). Hãy tải lại.",
  INVOICE_HAS_ADJUSTMENTS: "Hóa đơn đã có hóa đơn điều chỉnh (do trả hàng) nên không hủy hoặc thay thế được.",
  INVOICE_SETTINGS_INCOMPLETE: "Chưa cấu hình đủ thông tin người bán (tên pháp lý, MST, địa chỉ, mẫu số, ký hiệu). Hãy hoàn tất ở Cấu hình hóa đơn.",
  INVALID_TAX_CODE: "Mã số thuế chưa đúng định dạng (10 chữ số, 10 chữ số-3 chữ số hoặc 12 chữ số).",
  CANCEL_REASON_REQUIRED: "Vui lòng nhập lý do hủy.",
  CLIENT_REQUEST_CONFLICT: "Mã yêu cầu này đã được dùng cho một thao tác khác. Hãy thử lại.",
  // Chốt ca thu ngân (ADR-0030 gói B, docs/api/sales-shifts.md)
  SHIFT_NOT_FOUND: "Không tìm thấy ca (hoặc bạn chưa có ca nào đang mở).",
  SHIFT_ALREADY_OPEN: "Thu ngân này đang có một ca mở. Hãy đóng ca đó trước.",
  SHIFT_NOT_OPEN: "Bạn chưa mở ca. Cửa hàng đang yêu cầu mở ca trước khi bán hoặc thu, hoàn tiền mặt.",
  SHIFT_STATE_CONFLICT: "Ca không ở trạng thái cho phép thao tác này (đã đóng, đang mở hoặc vừa được người khác thao tác). Hãy tải lại.",
  SHIFT_HAS_PENDING_PAYMENTS: "Còn lệnh thu tay đang chờ trong ca này. Hãy xác nhận hoặc hủy các lệnh đó rồi đóng ca.",
  SHIFT_VARIANCE_REASON_REQUIRED: "Chênh lệch vượt ngưỡng cho phép: bắt buộc nhập lý do chênh lệch.",
  REOPEN_REASON_REQUIRED: "Vui lòng nhập lý do mở lại ca.",
  // Thông báo theo sự kiện (ADR-0030 gói C, docs/api/notifications.md)
  PREFERENCE_MANDATORY: "Nhóm thông báo bắt buộc (tài khoản, hoàn tiền) không tắt được.",
  TEMPLATE_PARAM_NOT_ALLOWED: "Mẫu dùng tham số không được phép cho loại thông báo này. Chỉ dùng các tham số trong danh sách.",
  TEMPLATE_INVALID: "Mẫu nội dung sai cú pháp (chỗ trống phải dạng {{ten_tham_so}}) hoặc vượt độ dài.",
  TEMPLATE_ERROR: "Không dựng được nội dung từ mẫu.",
  DELIVERY_NOT_FOUND: "Không tìm thấy lượt gửi này.",
  DELIVERY_NOT_RETRYABLE: "Chỉ gửi lại được lượt gửi đã thất bại hẳn (DEAD). Hãy tải lại danh sách.",
  NOTIFICATION_NOT_FOUND: "Không tìm thấy thông báo này.",
};

export const FORBIDDEN_TEXT =
  "Bạn chưa có quyền thực hiện thao tác này. Nếu vừa được cấp quyền, hãy đăng xuất rồi đăng nhập lại.";
const UNAVAILABLE_TEXT = "Hệ thống tạm thời chưa phản hồi. Vui lòng thử lại sau ít phút.";

/**
 * Chuyển ErrorInfo thành câu hiển thị. Thứ tự: mã lỗi trong `extra` > bảng chung > theo status > message BE nguyên văn.
 * Có câu theo mã thì `detail` là message BE (nếu khác câu đó).
 */
export function describeError(info: ErrorInfo, extra?: Record<string, string>): DescribedError {
  const byCode = info.code ? (extra?.[info.code] ?? ERROR_MESSAGES[info.code]) : undefined;
  if (byCode) {
    return {
      text: byCode,
      detail: info.message && info.message !== byCode ? info.message : undefined,
      details: info.details,
    };
  }
  if (info.status === 401) return { text: "Phiên đã hết hạn. Vui lòng đăng nhập lại." };
  if (info.status === 403) return { text: FORBIDDEN_TEXT };
  if (info.status === 502 || info.status === 503 || info.status === 504) return { text: UNAVAILABLE_TEXT };
  if (info.status === 400 && info.details?.length) {
    return { text: info.message ?? "Dữ liệu chưa hợp lệ.", details: info.details };
  }
  if (info.message) return { text: info.message, details: info.details };
  if (info.status === 404) return { text: "Không tìm thấy dữ liệu yêu cầu." };
  return { text: "Đã có lỗi xảy ra. Vui lòng thử lại." };
}
