import { Tag } from "antd";
import { Button } from "@/ui";

export type Chip = { key: string; label: string; onClose: () => void };

/** Dải chip các bộ lọc đang bật (bấm × để bỏ từng cái) kèm nút "Xóa bộ lọc" thường trực (vô hiệu khi không có bộ lọc). */
export function FilterChips({ chips, onClear, count }: { chips: Chip[]; onClear?: () => void; count?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filter-chips">
      {count && (
        <span className="text-sm text-muted" role="status" data-testid="result-count">
          {count}
        </span>
      )}
      {chips.map((c) => (
        <Tag key={c.key} closable onClose={c.onClose} data-testid="filter-chip">
          {c.label}
        </Tag>
      ))}
      {onClear && (
        <Button size="small" disabled={chips.length === 0} onClick={onClear}>
          Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}
