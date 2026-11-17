import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiKey, useSessionOptional, type ApiCallError } from "@/api";
import type { CopyDetails, CopyInfo } from "./circulation";

/**
 * Tên sách/mã vạch của các bản sao (BE không trả kèm trong phiếu nên gọi thêm từng bản sao).
 * Lỗi từng bản sao thì bỏ qua (UI hiện mã rút gọn). `enabled=false` (thiếu quyền xem bản sao) thì không gọi.
 */
export function useCopyInfos(copyIds: string[], enabled: boolean) {
  const tenantId = useSessionOptional()?.tenantId;
  const key = copyIds.join(",");
  return useQuery<Record<string, CopyInfo>, ApiCallError>({
    queryKey: apiKey(tenantId, `/api/book-copies#${key}`),
    enabled: enabled && copyIds.length > 0,
    queryFn: async () => {
      const r = await Promise.allSettled(copyIds.map((id) => apiFetch<CopyDetails>(`/api/book-copies/${encodeURIComponent(id)}`)));
      const out: Record<string, CopyInfo> = {};
      r.forEach((x, i) => {
        if (x.status === "fulfilled") out[copyIds[i]] = { titleName: x.value.titleName, barcode: x.value.barcode };
      });
      return out;
    },
  });
}

/** Nạp tên sách theo titleId (cần quyền xem sách); lỗi từng sách thì bỏ qua. */
export function useTitleNames(titleIds: string[], enabled: boolean) {
  const tenantId = useSessionOptional()?.tenantId;
  const ids = [...new Set(titleIds)];
  return useQuery<Record<string, string>, ApiCallError>({
    queryKey: apiKey(tenantId, `/api/books#names:${ids.join(",")}`),
    enabled: enabled && ids.length > 0,
    queryFn: async () => {
      const r = await Promise.allSettled(ids.map((id) => apiFetch<{ name: string }>(`/api/books/${encodeURIComponent(id)}`)));
      const out: Record<string, string> = {};
      r.forEach((x, i) => {
        if (x.status === "fulfilled" && x.value.name) out[ids[i]] = x.value.name;
      });
      return out;
    },
  });
}
