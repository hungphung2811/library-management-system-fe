import { Button } from "@/ui";

export type Chip = { key: string; label: string; onClose: () => void };

/** Số kết quả và nút "Xóa bộ lọc" (vô hiệu khi không có bộ lọc). Giá trị lọc đã hiện ngay trong ô lọc nên không lặp lại bằng chip. */
export function FilterChips({ chips, onClear, count }: { chips: Chip[]; onClear?: () => void; count?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="filter-chips">
      {count && (
        <span className="text-sm text-muted" role="status" data-testid="result-count">
          {count}
        </span>
      )}
      {onClear && (
        <Button size="small" disabled={chips.length === 0} onClick={onClear}>
          Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}
