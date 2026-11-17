import { ErrorPanel } from "@/ui";
import { toErrorInfo } from "@/api";
import type { UseQueryResult } from "@tanstack/react-query";

/** Lỗi của một truy vấn useApi, dạng ErrorPanel có nút "Thử lại" (refetch). */
export function ErrorBlock({ query }: { query: Pick<UseQueryResult, "error" | "refetch"> }) {
  return <ErrorPanel error={toErrorInfo(query.error)} onRetry={() => void query.refetch()} />;
}
