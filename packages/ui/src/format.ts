// Hàm thuần, dùng được ở server component, client component và trong `kind` của DataTable.
// Cố định múi giờ để SSR (múi giờ máy chủ) và client (múi giờ trình duyệt) ra cùng một chuỗi, tránh lỗi hydrate.
const TZ = "Asia/Ho_Chi_Minh";
const DASH = "—";

type DateInput = string | number | Date | null | undefined;

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const moneyFmt = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

function toDate(v: DateInput): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" && !DATE_ONLY.test(v) && v.includes("T") && !HAS_ZONE.test(v)) v += "Z"; // LocalDateTime của BE coi là UTC
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `dd/MM/yyyy` theo giờ Việt Nam. Chuỗi ngày thuần (`2026-11-15`, LocalDate của BE) giữ nguyên ngày. null/rỗng/sai -> "—". */
export function formatDate(v: DateInput): string {
  if (typeof v === "string") {
    const m = DATE_ONLY.exec(v);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = toDate(v);
  return d ? dateFmt.format(d) : DASH;
}

/** `HH:mm dd/MM/yyyy` theo giờ Việt Nam. */
export function formatDateTime(v: DateInput): string {
  const d = toDate(v);
  return d ? `${timeFmt.format(d)} ${dateFmt.format(d)}` : DASH;
}

/** Tiền VND, ví dụ `120.000 ₫`. Không phải số -> "—". */
export function formatMoney(v: number | string | null | undefined): string {
  if (v == null || v === "") return DASH;
  const n = Number(v);
  return Number.isFinite(n) ? moneyFmt.format(n) : DASH;
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước"; quá 30 ngày thì hiện ngày. Chỉ gọi sau khi mount ở client (phụ thuộc giờ hiện tại). */
export function formatRelativeTime(v: DateInput, now: number = Date.now()): string {
  const d = toDate(v);
  if (!d) return DASH;
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 45) return "vừa xong";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.round(h / 24);
  if (days <= 30) return `${days} ngày trước`;
  return formatDate(d);
}
