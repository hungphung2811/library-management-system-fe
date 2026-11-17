/**
 * Design tokens của app (Modern SaaS Admin: Indigo + Slate, giao diện gọn).
 * Đây là nguồn giá trị cho antd (antd-theme.ts) và cho code TS cần màu thật (SVG, canvas...).
 * theme.css giữ BẢN SAO của đúng các giá trị này dưới dạng CSS variable cho Tailwind và CSS tùy biến:
 * đổi một giá trị thì sửa cả hai file (cùng tên khóa, có chú thích tương ứng).
 */
export const color = {
  primary: "#4338CA",
  primaryHover: "#4F46E5",
  primaryActive: "#3730A3",
  primarySoft: "#EEF2FF",
  primaryBorder: "#C7D2FE",
  violet: "#7C3AED",
  violetSoft: "#F5F3FF",

  canvas: "#F8FAFC", // nền layout
  surface: "#FFFFFF",
  subtle: "#F1F5F9", // nền phụ (chip, hover nhẹ)
  rowHover: "#F5F7FF",

  ink: "#1E293B", // chữ chính
  muted: "#64748B", // chữ phụ
  faint: "#94A3B8", // chữ mờ, placeholder

  line: "#E2E8F0", // viền mặc định
  lineSoft: "#F1F5F9",
  lineStrong: "#CBD5E1", // viền ô nhập

  success: "#16A34A",
  successSoft: "#F0FDF4",
  successBorder: "#BBF7D0",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  warningBorder: "#FDE68A",
  error: "#DC2626",
  errorSoft: "#FEF2F2",
  errorBorder: "#FECACA",
  info: "#0284C7",
  infoSoft: "#F0F9FF",
  infoBorder: "#BAE6FD",

  /** Điểm nhấn của logo (cuốn sách nghiêng). */
  logoAccent: "#FBBF24",
} as const;

/** Kích thước tính bằng px. */
export const size = {
  sidebar: 224,
  header: 52,
  pagePadding: 20,
  control: 32,
  controlSm: 28,
  controlLg: 40,
  tableRow: 40,
  radiusCard: 10,
  radiusControl: 7,
} as const;

export const font = {
  family:
    '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  title: 18, // tiêu đề trang
  section: 15, // tiêu đề mục / card
  body: 13,
  caption: 12, // mô tả, nhãn
} as const;

export const shadow = {
  card: "0 1px 2px rgba(15, 23, 42, 0.04)",
  popup: "0 8px 24px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)",
} as const;
