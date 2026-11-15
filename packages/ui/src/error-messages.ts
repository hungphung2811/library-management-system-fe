import type { ErrorInfo } from "@mfe/api/client";

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
