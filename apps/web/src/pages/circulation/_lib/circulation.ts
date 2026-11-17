// Kiểu và hàm thuần của nhóm circulation (port từ apps/shell/.../circulation/_lib).

/** condition: GOOD, DAMAGED, LOST; null/thiếu khi còn đang mượn. */
export type BorrowingItem = { bookCopyId: string; returnDate: string | null; condition?: string | null };

/** `BorrowingView` của BE (GET/POST /api/borrowings...). */
export type BorrowingView = {
  id: string;
  userId: string;
  status: string;
  borrowDate: string;
  dueDate: string;
  renewCount: number;
  items: BorrowingItem[];
  /** Khoản phạt vừa lập bởi thao tác trả/báo mất (rỗng hoặc thiếu với thao tác khác). */
  fines?: FineView[];
};

/** Trang kết quả của GET /api/borrowings/search (page đánh số từ 0 ở BE). */
export type BorrowingPage = { items: BorrowingView[]; total: number; page: number; size: number };

/** Bộ lọc trạng thái trên URL của danh sách phiếu mượn: "" là tất cả; OVERDUE là ACTIVE đã quá hạn (BE: overdue=true). */
export const BORROWING_FILTERS = ["ACTIVE", "OVERDUE", "RETURNED"] as const;
export type BorrowingFilter = (typeof BORROWING_FILTERS)[number];

/** Thông tin hiển thị của một bản sao (BE không trả kèm trong phiếu nên FE gọi thêm). */
export type CopyInfo = { titleName?: string; barcode?: string };

/** `CopyDetailsView` của GET /api/book-copies/by-barcode/{barcode} (và /{id}). */
export type CopyDetails = {
  id: string;
  titleId: string;
  titleName?: string;
  barcode: string;
  status: string;
  coverPrice?: number;
};

export type ReservationView = {
  id: string;
  titleId: string;
  status: string;
  queuePosition?: number | null;
  reservedAt?: string | null;
  copyId?: string | null;
  holdUntil?: string | null;
};

/** `FineView` của BE. */
export type FineView = {
  id: string;
  readerId: string;
  borrowingId: string;
  bookCopyId: string;
  reason: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
};

/** `ReaderFinesView` của GET /api/fines và /api/fines/mine. */
export type ReaderFines = { readerId: string; totalUnpaid: number; fines: FineView[] };

export const FINE_REASONS: Record<string, string> = {
  LATE_RETURN: "Trả trễ hạn",
  LOST: "Mất sách",
  DAMAGED: "Sách hỏng",
};

/** Tình trạng sách khi trả (POST /api/borrowings/returns). */
export const COPY_CONDITIONS: Record<string, string> = { GOOD: "Tốt", DAMAGED: "Hỏng", LOST: "Mất" };

export const MAX_RENEWALS = 2;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mã lỗi riêng của circulation (mã chung nằm ở src/ui/error-messages.ts). */
export const CIRC_ERRORS: Record<string, string> = {
  UNPAID_FINES:
    "Độc giả còn khoản phạt chưa thanh toán. Mời độc giả thanh toán phạt trước (thu phạt tại quầy chờ hệ thống hỗ trợ).",
};

const TZ = "Asia/Ho_Chi_Minh";

/** Ngày hôm nay theo giờ Việt Nam, dạng `yyyy-MM-dd`. */
export function todayVN(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Số ngày quá hạn (0 nếu chưa quá hạn hoặc phiếu đã trả hết). FE chỉ tính ngày, không tính tiền phạt. */
export function overdueDays(b: Pick<BorrowingView, "status" | "dueDate">, today: string = todayVN()): number {
  if (b.status !== "ACTIVE" || !b.dueDate) return 0;
  const n = dayNumber(today) - dayNumber(b.dueDate);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Trạng thái hiển thị của phiếu: ACTIVE quá hạn thành OVERDUE (giá trị tổng hợp của StatusTag). */
export function displayStatus(b: Pick<BorrowingView, "status" | "dueDate">, today?: string): string {
  return overdueDays(b, today) > 0 ? "OVERDUE" : b.status;
}

export const shortId = (id: string) => id.slice(0, 8);

/** Dạng gọn của người dùng (GET /api/users, /api/users/{id}). */
export type UserBrief = { id: string; username: string; fullName: string; email: string };

/** Nhãn hiển thị của một người dùng trong ô chọn độc giả. */
export const userLabel = (u: UserBrief) => `${u.fullName} · ${u.username} · ${u.email}`;
