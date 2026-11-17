import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { toErrorInfo } from "@/api/errors";
import { ErrorPanel } from "./ErrorPanel";
import { PageSkeleton } from "./PageSkeleton";

/**
 * Bọc kết quả `useApi`: đang tải lần đầu = PageSkeleton, lỗi = ErrorPanel kèm nút "Thử lại" (refetch),
 * có dữ liệu thì gọi `children(data)`. Truyền `skeleton` để thay khung chờ (ví dụ `<PageSkeleton variant="detail" />`).
 * `errorMessages` là bảng mã lỗi riêng của trang cho ErrorPanel.
 */
export function QueryBoundary<T>({
  query,
  skeleton,
  errorMessages,
  children,
}: {
  query: Pick<UseQueryResult<T>, "data" | "error" | "isPending" | "isError" | "refetch">;
  skeleton?: ReactNode;
  errorMessages?: Record<string, string>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <PageSkeleton />}</>;
  if (query.isError) return <ErrorPanel error={toErrorInfo(query.error)} onRetry={() => void query.refetch()} messages={errorMessages} />;
  return <>{children(query.data as T)}</>;
}
