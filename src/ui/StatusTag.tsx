import { Tag } from "./Tag";
import { STATUS_LABELS, type StatusDomain } from "./status-labels";

/** Nhãn trạng thái tiếng Việt kèm màu. Giá trị lạ: hiện nguyên chuỗi, màu mặc định. Luôn có chữ (không chỉ dựa vào màu). */
export function StatusTag({ domain, value }: { domain: StatusDomain; value: string | null | undefined }) {
  if (!value) return <>—</>;
  const meta = STATUS_LABELS[domain]?.[value];
  return <Tag dot color={meta?.color ?? "default"}>{meta?.label ?? value}</Tag>;
}
