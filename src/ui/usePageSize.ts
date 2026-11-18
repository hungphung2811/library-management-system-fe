import { useSearchParams } from "react-router";
import { DEFAULT_PAGE_SIZES } from "./DataTable";

/**
 * Cỡ trang đang chọn, đọc từ query `size` (do ô "/ trang" cạnh phân trang của DataTable ghi). Giá trị lạ hoặc vắng thì dùng
 * `defaultSize`. Trang dùng kết quả này làm `size` khi gọi BE và làm `pageSize` của `pagination` trong DataTable.
 */
export function usePageSize(defaultSize = 20, allowed: number[] = DEFAULT_PAGE_SIZES): number {
  const [sp] = useSearchParams();
  const n = Number(sp.get("size"));
  return Number.isInteger(n) && (allowed.includes(n) || n === defaultSize) ? n : defaultSize;
}
