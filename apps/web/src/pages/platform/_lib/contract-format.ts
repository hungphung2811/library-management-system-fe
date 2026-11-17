import type { BillingCycle, BillingUnit, ContractStatus, ContractPhase } from "./contract-types";

export const CONTRACT_STATUS: Record<ContractStatus, { label: string; color: string }> = {
  DRAFT: { label: "Nháp", color: "default" },
  ACTIVE: { label: "Hiệu lực", color: "success" },
  EXPIRED: { label: "Hết hạn", color: "warning" },
  CANCELLED: { label: "Đã hủy", color: "error" },
};

export const CONTRACT_PHASE: Record<ContractPhase, { label: string; color: string }> = {
  UPCOMING: { label: "Sắp tới", color: "processing" },
  IN_EFFECT: { label: "Đang hiệu lực", color: "success" },
  IN_GRACE: { label: "Ân hạn", color: "warning" },
};

/** Nhãn trạng thái hiển thị: ACTIVE kèm pha (đang hiệu lực / sắp tới / ân hạn). */
export function contractStatusLabel(status: ContractStatus, phase: ContractPhase | null | undefined): { label: string; color: string } {
  if (status === "ACTIVE" && phase && CONTRACT_PHASE[phase]) {
    return { label: `Hiệu lực: ${CONTRACT_PHASE[phase].label.toLowerCase()}`, color: CONTRACT_PHASE[phase].color };
  }
  return CONTRACT_STATUS[status] ?? { label: status, color: "default" };
}

export const SUSPENSION_CAUSE: Record<string, string> = {
  MANUAL: "Tạm ngưng tay",
  CONTRACT_EXPIRED: "Tạm ngưng do hết hạn hợp đồng",
  CONTRACT_CANCELLED: "Tạm ngưng do hủy hợp đồng",
};

/** Cảnh báo kèm theo nguyên nhân: chỉ CONTRACT_EXPIRED tự mở lại. */
export const SUSPENSION_HINT: Record<string, string> = {
  CONTRACT_EXPIRED: "Đơn vị sẽ tự được kích hoạt lại khi có hợp đồng mới tới ngày áp dụng (đã kích hoạt, ngày bắt đầu đã tới).",
  MANUAL: "Tạm ngưng tay không tự mở lại: hợp đồng mới cũng không kích hoạt lại đơn vị. Hãy bấm Kích hoạt khi cần.",
  CONTRACT_CANCELLED: "Tạm ngưng do hủy hợp đồng không tự mở lại: hợp đồng mới cũng không kích hoạt lại đơn vị. Hãy bấm Kích hoạt khi cần.",
};

const UNIT_LABEL: Record<BillingUnit, string> = { DAY: "ngày", MONTH: "tháng", YEAR: "năm" };
export const BILLING_UNIT_OPTIONS = (Object.keys(UNIT_LABEL) as BillingUnit[]).map((v) => ({ value: v, label: UNIT_LABEL[v] }));
export const billingCycleText = (c: BillingCycle | null | undefined) => (c ? `${c.value} ${UNIT_LABEL[c.unit] ?? c.unit}` : "—");

export const HISTORY_LABEL: Record<string, string> = {
  CREATED: "Tạo hợp đồng",
  UPDATED: "Sửa hợp đồng",
  ACTIVATED: "Kích hoạt",
  MODULES_APPLIED: "Áp dụng module",
  EXTENDED: "Kéo dài ngày kết thúc",
  CANCELLED: "Hủy hợp đồng",
  EXPIRED: "Hết hạn",
  LEGACY_SUPERSEDED: "Hợp đồng chuyển tiếp bị cắt",
  LEGACY_BACKFILLED: "Tạo hợp đồng chuyển tiếp",
  PAYMENT_RECORDED: "Ghi thanh toán",
  PAYMENT_REVERSED: "Đảo thanh toán",
  REMINDER_SENT: "Gửi nhắc hạn",
  MANUAL_MODULE_ENABLED: "Bật module thủ công",
  MANUAL_MODULE_DISABLED: "Tắt module thủ công",
};

/** Số ngày còn lại tới `endDate` (YYYY-MM-DD) tính theo lịch Việt Nam; âm khi đã quá hạn. */
export function daysUntil(endDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((d(endDate) - d(today)) / 86_400_000);
}

