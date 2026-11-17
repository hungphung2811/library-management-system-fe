import { ApiCallError } from "@/api";
import type { BusinessType, ContactStatus } from "./types";

/** Che email khi chưa cần xem: giữ ký tự đầu của phần tên và toàn bộ tên miền ("an@example.com" -> "a***@example.com"). */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${[...email.slice(0, at)][0]}***${email.slice(at)}`;
}

/** Che điện thoại: chỉ giữ 3 chữ số cuối. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\s+/g, "");
  return `${"*".repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}`;
}

export const BUSINESS_LABELS: Record<BusinessType, string> = {
  LIBRARY: "Thư viện",
  BOOKSTORE: "Hiệu sách",
  OTHER: "Khác",
};

export const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "NEW", label: "Mới" },
  { value: "IN_PROGRESS", label: "Đang xử lý" },
  { value: "HANDLED", label: "Đã xử lý" },
  { value: "SPAM", label: "Spam" },
];

/** Bảng chuyển trạng thái hợp lệ (docs/api/customer-api-contact-saas.md mục 7). BE vẫn là nơi quyết định. */
export const CONTACT_TRANSITIONS: Record<ContactStatus, ContactStatus[]> = {
  NEW: ["IN_PROGRESS", "HANDLED", "SPAM"],
  IN_PROGRESS: ["NEW", "HANDLED", "SPAM"],
  HANDLED: ["IN_PROGRESS"],
  SPAM: ["NEW"],
};

/** Mã lỗi riêng của nhóm nền tảng, truyền vào describeError/ErrorPanel qua `extra`. */
export const PLATFORM_ERRORS: Record<string, string> = {
  CMS_PAGE_NOT_FOUND: "Không tìm thấy trang này (có thể đã bị xóa).",
  CMS_SLUG_DUPLICATED: "Đường dẫn (slug) này đã có trang khác dùng.",
  CMS_VERSION_CONFLICT: "Trang vừa được người khác thay đổi. Đã tải lại bản mới nhất, hãy kiểm tra rồi thao tác lại.",
  CMS_SLUG_INVALID: "Slug chỉ gồm chữ thường a-z, số và dấu gạch ngang, tối đa 80 ký tự.",
  CMS_CONTENT_TOO_LONG: "Nội dung vượt giới hạn cho phép.",
  CMS_PAGE_INVALID: "Tiêu đề hoặc nội dung chứa ký tự không hợp lệ (ký tự điều khiển).",
  CONTACT_REQUEST_NOT_FOUND: "Không tìm thấy yêu cầu liên hệ này.",
  CONTACT_REQUEST_ANONYMIZED: "Yêu cầu này đã được ẩn danh, không thể thay đổi.",
  CONTACT_REQUEST_VERSION_CONFLICT: "Yêu cầu vừa được người khác thay đổi. Đã tải lại bản mới nhất, hãy thử lại.",
  CONTACT_STATUS_TRANSITION_INVALID: "Không thể chuyển sang trạng thái này từ trạng thái hiện tại.",
  VALIDATION_ERROR: "Dữ liệu chưa hợp lệ.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ.",
  FORBIDDEN: "Chỉ quản trị viên nền tảng (platform admin) mới dùng được chức năng này.",
};

/** Đổi thông điệp lỗi của BE theo mã lỗi nền tảng (FormModal không nhận bảng mã riêng nên cần câu tiếng Việt từ đây). */
export async function withPlatformErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiCallError && e.code && PLATFORM_ERRORS[e.code]) {
      throw new ApiCallError(e.status, e.code, PLATFORM_ERRORS[e.code], e.details);
    }
    throw e;
  }
}
