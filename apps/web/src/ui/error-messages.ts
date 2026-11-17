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
  INVALID_ACCESS_CONTROL: "Tên vai trò chưa đúng quy tắc (chữ HOA, số và dấu gạch dưới).",
  BORROWING_NOT_FOUND: "Không tìm thấy phiếu mượn.",
  INSUFFICIENT_STOCK: "Tồn kho khả dụng không đủ.",
  DISCOUNT_NOT_ALLOWED: "Bạn không có quyền áp dụng giảm giá cho đơn này.",
  DISCOUNT_EXCEEDS_AMOUNT: "Giảm giá vượt quá giá trị đơn hàng.",
  SUPPLIER_EXISTS: "Nhà cung cấp trùng tên đã tồn tại.",
  SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp.",
  STOCK_ITEM_EXISTS: "Đầu sách này đã được đăng ký bán.",
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
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
  ORDER_STATE_CONFLICT: "Đơn hàng vừa được người khác thao tác hoặc không còn ở trạng thái cho phép thao tác này. Hãy tải lại rồi kiểm tra.",
  SETTINGS_VERSION_CONFLICT: "Cấu hình vừa được người khác sửa. Hãy tải lại rồi thử lại.",
  DUPLICATE_REQUEST: "Yêu cầu bị gửi trùng. Hãy tải lại để xem kết quả.",
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
