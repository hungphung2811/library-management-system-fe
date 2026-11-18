/** Thông báo theo sự kiện (ADR-0030 gói C, docs/api/notifications.md). Nhãn tiếng Việt cho loại, nhóm, trạng thái, lý do bỏ qua, mã lỗi gửi. */

export const NOTIFICATION_TYPES: Record<string, string> = {
  ORDER_PLACED: "Đơn hàng vừa đặt",
  ORDER_PAID: "Đơn hàng đã thanh toán",
  ORDER_READY_FOR_PICKUP: "Đơn sẵn sàng nhận",
  ORDER_SHIPPING: "Đơn đang giao",
  ORDER_COMPLETED: "Đơn hoàn tất",
  ORDER_CANCELLED: "Đơn bị hủy",
  REFUND_COMPLETED: "Hoàn tiền xong",
  INVOICE_ISSUED: "Hóa đơn đã xuất",
  LOAN_DUE_SOON: "Sắp đến hạn trả sách",
  LOAN_OVERDUE: "Quá hạn trả sách",
  RESERVATION_READY: "Sách đặt trước sẵn sàng",
  FINE_ISSUED: "Phát sinh tiền phạt",
  CONTRACT_EXPIRING: "Hợp đồng sắp hết hạn",
};

export const NOTIFICATION_CATEGORIES: Record<string, string> = {
  ORDER: "Đơn hàng",
  INVOICE: "Hóa đơn",
  LOAN_REMINDER: "Nhắc hạn mượn sách",
  RESERVATION: "Đặt trước",
  FINE: "Tiền phạt",
  REFUND: "Hoàn tiền",
  ACCOUNT: "Tài khoản",
};

export const NOTIFICATION_CHANNELS: Record<string, string> = { EMAIL: "Email" };

export const DELIVERY_STATUS: Record<string, string> = {
  PENDING: "Chờ gửi",
  SENDING: "Đang gửi",
  SENT: "Đã gửi",
  RETRY: "Chờ thử lại",
  DEAD: "Thất bại hẳn",
  SKIPPED: "Bỏ qua",
};
export const DELIVERY_STATUS_COLOR: Record<string, string> = {
  PENDING: "default",
  SENDING: "processing",
  SENT: "success",
  RETRY: "warning",
  DEAD: "error",
  SKIPPED: "default",
};

export const SKIP_REASON: Record<string, string> = {
  NO_PROVIDER: "Chưa cấu hình dịch vụ gửi",
  CHANNEL_DISABLED: "Kênh đã tắt cho loại này",
  OPTED_OUT: "Người nhận đã tắt",
  NO_ADDRESS: "Người nhận chưa có địa chỉ",
  INACTIVE_USER: "Người nhận không còn hoạt động",
};

/** Mã lỗi gửi (đã che: BE không trả thông điệp gốc của SMTP). */
export const DELIVERY_ERROR: Record<string, string> = {
  SMTP_4XX: "Máy chủ thư tạm từ chối (4xx)",
  SMTP_5XX: "Máy chủ thư từ chối hẳn (5xx)",
  TIMEOUT: "Hết thời gian chờ",
  SMTP_CONNECT: "Không kết nối được máy chủ thư",
  SMTP_AUTH: "Sai thông tin đăng nhập máy chủ thư",
  SMTP_INVALID_MESSAGE: "Nội dung thư không hợp lệ",
  MAIL_NOT_CONFIGURED: "Chưa cấu hình máy chủ thư",
  RECIPIENT_LOOKUP_FAILED: "Không tra được email người nhận",
  TEMPLATE_ERROR: "Lỗi dựng nội dung từ mẫu",
  UNEXPECTED_ERROR: "Lỗi không xác định",
};

export type ChannelSetting = { type: string; category: string; channel: string; enabled: boolean };

export type NotificationTemplate = {
  type: string;
  category: string;
  channel: string;
  source: "DEFAULT" | "TENANT" | string;
  version: number;
  subject: string;
  body: string;
  allowedParams: string[];
};

export type Delivery = {
  id: string;
  eventId: string | null;
  eventType: string | null;
  type: string;
  category: string;
  channel: string;
  status: string;
  skipReason: string | null;
  recipientUserId: string | null;
  recipientAddressMasked: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  sentAt: string | null;
  templateSource: string | null;
  templateVersion: number | null;
  lastRetryBy: string | null;
  lastRetryAt: string | null;
  createdAt: string;
};

export type MyDelivery = {
  id: string;
  type: string;
  category: string;
  channel: string;
  status: string;
  skipReason: string | null;
  recipientAddressMasked: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type Preference = { category: string; channel: string; enabled: boolean; mandatory: boolean };

export const typeLabel = (t: string) => NOTIFICATION_TYPES[t] ?? t;
