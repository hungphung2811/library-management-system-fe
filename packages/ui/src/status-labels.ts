export type StatusDomain = "copy" | "borrowing" | "reservation" | "user" | "reader" | "department" | "fine";

export type StatusMeta = { label: string; color: string };

/**
 * Bảng nhãn và màu trạng thái (đặc tả UI 0.4). `borrowing.OVERDUE` là giá trị tổng hợp do zone tự suy ra
 * (ACTIVE và dueDate < hôm nay); StatusTag không tự tính ngày.
 */
export const STATUS_LABELS: Record<StatusDomain, Record<string, StatusMeta>> = {
  copy: {
    AVAILABLE: { label: "Sẵn sàng", color: "success" },
    LOANED: { label: "Đang cho mượn", color: "processing" },
    RESERVED: { label: "Đang giữ chỗ", color: "warning" },
    DAMAGED: { label: "Hư hỏng", color: "orange" },
    LOST: { label: "Đã mất", color: "error" },
  },
  borrowing: {
    ACTIVE: { label: "Đang mượn", color: "processing" },
    RETURNED: { label: "Đã trả hết", color: "success" },
    OVERDUE: { label: "Quá hạn", color: "error" },
  },
  reservation: {
    WAITING: { label: "Đang chờ", color: "default" },
    READY: { label: "Sẵn sàng nhận", color: "success" },
    FULFILLED: { label: "Đã nhận", color: "blue" },
    EXPIRED: { label: "Hết hạn nhận", color: "default" },
    CANCELLED: { label: "Đã hủy", color: "default" },
  },
  user: {
    ACTIVE: { label: "Đang hoạt động", color: "success" },
    DISABLED: { label: "Đã vô hiệu", color: "default" },
  },
  reader: {
    ACTIVE: { label: "Đang hoạt động", color: "success" },
    LOCKED: { label: "Bị khóa", color: "error" },
  },
  department: {
    ACTIVE: { label: "Đang dùng", color: "success" },
    INACTIVE: { label: "Ngừng dùng", color: "default" },
  },
  fine: {
    UNPAID: { label: "Chưa thanh toán", color: "warning" },
    PAID: { label: "Đã thanh toán", color: "success" },
  },
};
