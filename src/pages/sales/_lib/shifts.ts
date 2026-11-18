/** Chốt ca thu ngân (ADR-0030 gói B, docs/api/sales-shifts.md). Tiền là số nguyên đồng; thời điểm ISO-8601 UTC. */
export type ShiftStatus = "OPEN" | "CLOSED";
export type ShiftPhase = "OPEN" | "REOPENED" | "PENDING_APPROVAL" | "CLOSED";
export type VarianceStatus = "NONE" | "PENDING_APPROVAL" | "APPROVED";

export type ShiftView = {
  id: string;
  shiftNo: string;
  cashierUserId: string;
  registerLabel: string | null;
  status: ShiftStatus;
  phase: ShiftPhase;
  openedAt: string;
  openingFloat: number;
  closedAt: string | null;
  closedBy: string | null;
  countedCash: number | null;
  expectedCash: number | null;
  variance: number | null;
  varianceReason: string | null;
  varianceStatus: VarianceStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  reopenCount: number;
  version: number;
};

export type ShiftMethodRow = {
  method: string;
  paymentCount: number;
  collected: number;
  refundCount: number;
  refunded: number;
  net: number;
  paymentCountAfterClose: number;
  collectedAfterClose: number;
  refundCountAfterClose: number;
  refundedAfterClose: number;
};

export type ShiftReport = {
  orderCount: number;
  grandTotal: number;
  discountTotal: number;
  methods: ShiftMethodRow[];
  collectedTotal: number;
  refundedTotal: number;
  netTotal: number;
};

export type ShiftHistoryEntry = {
  id: string;
  type: "OPENED" | "CLOSED" | "REOPENED" | "VARIANCE_APPROVED";
  actorId: string | null;
  occurredAt: string;
  snapshot?: Record<string, unknown> | null;
};

export type ShiftDetail = {
  shift: ShiftView;
  report: ShiftReport;
  /** Chỉ khi ca đang mở: tiền mặt dự kiến tạm tính tới thời điểm hiện tại. */
  provisionalExpectedCash?: number | null;
  history: ShiftHistoryEntry[];
};

export type ShiftSettings = {
  requireOpenShiftForPos: boolean;
  varianceThreshold: number;
  version: number;
  updatedAt: string | null;
};

export const SHIFT_PHASE: Record<string, string> = {
  OPEN: "Đang mở",
  REOPENED: "Đã mở lại",
  PENDING_APPROVAL: "Chờ duyệt chênh lệch",
  CLOSED: "Đã đóng",
};
export const SHIFT_PHASE_COLOR: Record<string, string> = { OPEN: "success", REOPENED: "processing", PENDING_APPROVAL: "warning", CLOSED: "default" };
export const VARIANCE_STATUS: Record<string, string> = { NONE: "Không chênh lệch đáng kể", PENDING_APPROVAL: "Chờ duyệt", APPROVED: "Đã duyệt" };
export const SHIFT_HISTORY: Record<string, string> = { OPENED: "Mở ca", CLOSED: "Đóng ca", REOPENED: "Mở lại ca", VARIANCE_APPROVED: "Duyệt chênh lệch" };
export const SHIFT_METHODS: Record<string, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  QR: "QR",
  MOMO: "MoMo",
  SEPAY: "SePay",
};

/** Chênh lệch có dấu: dương là thừa, âm là thiếu. */
export function varianceText(v: number | null | undefined, money: (n: number) => string): string {
  if (v == null) return "—";
  if (v === 0) return "Khớp (0)";
  return `${v > 0 ? "Thừa" : "Thiếu"} ${money(Math.abs(v))}`;
}
