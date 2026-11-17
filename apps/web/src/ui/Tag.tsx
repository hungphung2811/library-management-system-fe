import type { HTMLAttributes, ReactNode } from "react";

/** Sắc thái hiển thị; `color` của trang dùng tên preset antd cũ nên được quy về một sắc thái. */
type Tone = "success" | "info" | "warning" | "error" | "primary" | "neutral";

const TONE_CLASS: Record<Tone, { box: string; dot: string }> = {
  success: { box: "border-success-border bg-success-soft text-success", dot: "bg-success" },
  info: { box: "border-info-border bg-info-soft text-info", dot: "bg-info" },
  warning: { box: "border-warning-border bg-warning-soft text-warning", dot: "bg-warning" },
  error: { box: "border-error-border bg-error-soft text-error", dot: "bg-error" },
  primary: { box: "border-primary-border bg-primary-soft text-primary", dot: "bg-primary" },
  neutral: { box: "border-line bg-subtle text-muted", dot: "bg-faint" },
};

const TONE_OF: Record<string, Tone> = {
  success: "success",
  processing: "info",
  info: "info",
  warning: "warning",
  orange: "warning",
  gold: "warning",
  error: "error",
  danger: "error",
  blue: "primary",
  geekblue: "primary",
  purple: "primary",
  default: "neutral",
};

export type TagProps = Omit<HTMLAttributes<HTMLSpanElement>, "color"> & {
  /** Tên preset (success, processing, warning, orange, gold, error, blue, default); không có = trung tính, không chấm. */
  color?: string;
  /** Ép hiện/ẩn chấm (mặc định: hiện khi có màu). */
  dot?: boolean;
  children?: ReactNode;
};

/**
 * Nhãn dạng viên. Có `color` (không phải default) thì kèm chấm trạng thái; luôn có chữ nên không chỉ dựa vào màu.
 * Thay antd Tag trong toàn app để mọi nhãn cùng một kiểu.
 */
export function Tag({ color, dot, className = "", children, ...rest }: TagProps) {
  const tone = TONE_OF[color ?? "default"] ?? "neutral";
  const t = TONE_CLASS[tone];
  return (
    <span
      {...rest}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 align-middle text-caption leading-[18px] font-medium whitespace-nowrap ${t.box} ${className}`}
    >
      {(dot ?? tone !== "neutral") && <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${t.dot}`} />}
      {children}
    </span>
  );
}
