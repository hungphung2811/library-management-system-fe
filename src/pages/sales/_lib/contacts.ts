/** Liên hệ của khách gửi cửa hàng (ADR-0015, docs/api/sales.md của BE). Khách gửi qua storefront (ngoài FE này). */
export type ContactStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

export type MaskedContact = { name: string | null; email: string | null; phone: string | null };

export type ContactSummary = {
  id: string;
  topic: string;
  status: ContactStatus | string;
  createdAt: string;
  closedAt: string | null;
  contact: MaskedContact | null;
  piiAnonymizedAt: string | null;
  version: number;
};

export type ContactDetail = ContactSummary & { message: string | null; customerUserId: string | null };

/** Liên hệ đầy đủ (GET .../{id}/contact); đã ẩn danh thì các trường là null. */
export type ContactFull = { fullName: string | null; email: string | null; phone: string | null; piiAnonymizedAt: string | null };

export const CONTACT_TOPICS: Record<string, string> = {
  ORDER: "Đơn hàng",
  PRODUCT: "Sản phẩm",
  PAYMENT: "Thanh toán",
  OTHER: "Khác",
};

export const CONTACT_STATUS: Record<string, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  CLOSED: "Đã đóng",
};

export const CONTACT_STATUS_COLOR: Record<string, string> = { NEW: "processing", IN_PROGRESS: "warning", CLOSED: "default" };

/** NEW sang IN_PROGRESS hoặc CLOSED; IN_PROGRESS sang CLOSED; CLOSED không mở lại. */
export const CONTACT_NEXT: Record<string, ContactStatus[]> = {
  NEW: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["CLOSED"],
  CLOSED: [],
};

export const CONTACT_NOTE =
  "Yêu cầu chỉ được ghi nhận; nhân viên liên hệ khách ngoài hệ thống (email, điện thoại khách để lại). Dữ liệu cá nhân tự ẩn danh sau thời hạn lưu giữ của đơn vị.";
