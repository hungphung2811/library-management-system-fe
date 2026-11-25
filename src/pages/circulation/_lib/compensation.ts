// Kiểu và nhãn cho chính sách đền bù, bậc hư hại, yêu cầu miễn/giảm và hoàn khoản (docs/api/circulation-fines-compensation.md).
import { ERROR_MESSAGES } from "@/ui";

export type DamageLevel = {
  code: string;
  label: string;
  rate: number;
  sortOrder: number;
  active: boolean;
  version: number;
  updatedAt: string | null;
};

export type DamageLevels = { custom: boolean; maxLevels: number; items: DamageLevel[] };

export type CompensationPolicy = {
  lostRate: number;
  priceSource: "COVER_PRICE" | "PURCHASE_PRICE";
  minAmount: number | null;
  maxAmount: number | null;
  foundWindowDays: number;
  refundProcessingFee: number;
  custom: boolean;
  version: number;
  updatedAt: string | null;
};

export type Adjustment = {
  id: string;
  fineId: string;
  readerId: string;
  fineReason: string;
  fineAmount: number;
  type: "WAIVE" | "REDUCE";
  payableAmount: number | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type Refund = {
  id: string;
  fineId: string;
  borrowingId: string;
  bookCopyId: string;
  readerId: string;
  lostOn: string | null;
  foundOn: string | null;
  restoreStatus: "AVAILABLE" | "DAMAGED";
  checkNote: string | null;
  refundMethod: "CASH" | "BANK_TRANSFER";
  referenceCode: string | null;
  mode: "REFUND" | "WAIVE" | "RESTORE_ONLY";
  fineStatusAtRequest: string;
  collectedAmount: number | null;
  processingFee: number | null;
  refundAmount: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type Paged<T> = { items: T[]; total: number; page: number; size: number };

export const PRICE_SOURCES: Record<string, string> = { COVER_PRICE: "Giá bìa", PURCHASE_PRICE: "Giá mua của bản sao" };
export const REQUEST_STATUS: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Đã từ chối" };
export const REQUEST_STATUS_COLOR: Record<string, string> = { PENDING: "warning", APPROVED: "success", REJECTED: "default" };
export const ADJUSTMENT_TYPES: Record<string, string> = { WAIVE: "Miễn toàn phần", REDUCE: "Giảm" };
export const REFUND_MODES: Record<string, string> = { REFUND: "Hoàn tiền đã thu", WAIVE: "Miễn khoản chưa thu", RESTORE_ONLY: "Chỉ đưa sách về kho" };
export const REFUND_METHODS: Record<string, string> = { CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản" };

/** Mã lỗi riêng của nhóm đền bù (bổ sung cho ERROR_MESSAGES qua tham số `extra` của describeError). */
export const COMPENSATION_ERRORS: Record<string, string> = {
  POLICY_VERSION_CONFLICT: "Cấu hình vừa được người khác sửa. Hãy tải lại rồi thử lại.",
  INVALID_COMPENSATION_POLICY: "Chính sách đền bù có giá trị ngoài khoảng cho phép. Hãy kiểm tra lại các ô.",
  COMPENSATION_BOUNDS_INVALID: "Mức tối thiểu không được lớn hơn mức tối đa.",
  DAMAGE_LEVEL_CODE_EXISTS: "Mã mức hư hại này đã tồn tại.",
  DAMAGE_LEVEL_LIMIT_REACHED: "Mỗi đơn vị chỉ có tối đa 10 mức hư hại.",
  DAMAGE_LEVEL_IN_USE: "Mức hư hại này đã được dùng nên không xóa được. Hãy tắt mức này thay vì xóa.",
  DAMAGE_LEVEL_NOT_FOUND: "Không tìm thấy mức hư hại này.",
  INVALID_DAMAGE_LEVEL: "Thông tin mức hư hại chưa hợp lệ (mã 2 đến 30 ký tự A-Z, 0-9, _; tỷ lệ 0 đến 500%).",
  DAMAGE_LEVEL_CODE_IMMUTABLE: "Không đổi được mã của mức hư hại.",
  APPROVER_MUST_DIFFER: "Người duyệt phải khác người đã đề nghị.",
  FINE_NOT_ADJUSTABLE: "Khoản phạt này không còn ở trạng thái chưa thanh toán nên không miễn/giảm được.",
  ADJUSTMENT_ALREADY_PENDING: "Khoản phạt này đã có yêu cầu đang chờ duyệt.",
  ADJUSTMENT_NOT_PENDING: "Yêu cầu này đã được xử lý.",
  FINE_NOT_FOUND: "Không tìm thấy khoản phạt này.",
  ADJUSTMENT_NOT_FOUND: "Không tìm thấy yêu cầu này.",
  INVALID_ADJUSTMENT_AMOUNT: "Số phải thu mới phải lớn hơn 0 và nhỏ hơn số tiền gốc của khoản phạt.",
  ADJUSTMENT_REASON_REQUIRED: "Cần nhập lý do (tối đa 500 ký tự).",
  REFUND_NOT_PENDING: "Yêu cầu hoàn khoản này đã được xử lý.",
  REFUND_NOT_FOUND: "Không tìm thấy yêu cầu hoàn khoản này.",
  REFUND_FINE_STATE_CHANGED: "Khoản phạt đã đổi trạng thái từ lúc đề nghị. Hãy từ chối rồi lập lại yêu cầu.",
  COPY_STATUS_CONFLICT: "Catalog chưa cho đổi bản sao từ trạng thái đã mất sang trạng thái mới nên chưa duyệt được.",
  DEPENDENCY_UNAVAILABLE: "Dịch vụ danh mục tạm thời không phản hồi. Chưa có gì bị ghi, hãy thử lại sau.",
};

/** Tỷ lệ (1.5) thành phần trăm hiển thị ("150%"). */
export const pct = (rate: number) => `${Math.round(Number(rate) * 10000) / 100}%`;

// FormModal tự dịch lỗi bằng ERROR_MESSAGES (không nhận `extra`), nên bổ sung các mã chưa có để lỗi trong hộp thoại cũng bằng tiếng Việt.
for (const [code, text] of Object.entries(COMPENSATION_ERRORS)) if (!(code in ERROR_MESSAGES)) ERROR_MESSAGES[code] = text;
