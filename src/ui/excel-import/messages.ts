import { toErrorInfo } from "@/api";
import { describeError, type DescribedError } from "../error-messages";

/** Thông điệp mã lỗi của cụm nhập Excel (docs/api/identity-import.md mục 5). */
export const IMPORT_ERRORS: Record<string, string> = {
  IMPORT_FILE_REQUIRED: "Chưa chọn tệp hoặc tệp rỗng.",
  IMPORT_FILE_TOO_LARGE: "Tệp vượt quá 5 MB. Hãy tách thành nhiều tệp.",
  IMPORT_UNSUPPORTED_FILE: "Chỉ nhận tệp Excel .xlsx thường (không nhận .xls, .xlsm có macro, .xlsb hay tệp đặt mật khẩu).",
  IMPORT_FILE_UNSAFE: "Tệp không an toàn nên không được xử lý.",
  IMPORT_FILE_CORRUPT: "Không đọc được cấu trúc tệp. Hãy mở bằng Excel, lưu lại thành .xlsx rồi tải lên.",
  IMPORT_TEMPLATE_MISMATCH: "Tệp không đúng mẫu: thiếu sheet hoặc cột bắt buộc, hoặc là tệp của loại khác. Hãy tải mẫu mới và điền vào đó.",
  IMPORT_EMPTY: "Tệp không có dòng dữ liệu nào.",
  IMPORT_TOO_MANY_ROWS: "Tệp có quá 5.000 dòng dữ liệu. Hãy tách thành nhiều tệp.",
  IMPORT_NOT_FOUND: "Phiên nhập không còn (hết hạn sau 30 phút, đã hủy hoặc không phải của bạn). Hãy tải tệp lên lại.",
  IMPORT_INVALID_STATE: "Phiên đang ở trạng thái không cho phép thao tác này. Hãy thử lại sau ít giây.",
  IMPORT_NOTHING_TO_COMMIT: "Không có dòng hợp lệ nào để nhập.",
  IMPORT_SESSION_LIMIT: "Bạn đang mở tối đa 3 phiên nhập. Hãy hoàn tất hoặc hủy phiên cũ (tự hết hạn sau 30 phút) rồi thử lại.",
  IMPORT_BUSY: "Hệ thống đang bận xử lý việc nhập khác. Hãy thử lại sau ít phút.",
  IMPORT_STORAGE_UNAVAILABLE: "Kho tạm của phiên nhập chưa sẵn sàng. Hãy thử lại sau.",
  IMPORT_TYPE_NOT_FOUND: "Loại nhập này không tồn tại.",
  IMPORT_CREDENTIALS_GONE:
    "File mật khẩu tạm đã được tải một lần hoặc đã hết hạn nên không tải lại được. Dùng chức năng đặt lại mật khẩu cho từng người nếu cần.",
  INVALID_QUERY: "Tham số lọc không hợp lệ.",
  CATALOG_UNAVAILABLE: "Không tra được danh mục sách, hãy thử lại sau.",
};

/** Mô tả lỗi của lời gọi nhập Excel; 413/415 do nginx trả HTML (không có mã) thì dựa vào mã HTTP. */
export function describeImportError(e: unknown): DescribedError {
  const info = toErrorInfo(e);
  if (!info.code && info.status === 413) return { text: IMPORT_ERRORS.IMPORT_FILE_TOO_LARGE };
  if (!info.code && info.status === 415) return { text: IMPORT_ERRORS.IMPORT_UNSUPPORTED_FILE };
  return describeError(info, IMPORT_ERRORS);
}
