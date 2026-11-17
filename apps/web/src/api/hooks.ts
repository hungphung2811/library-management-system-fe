import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useSessionOptional } from "@/auth/AuthProvider";
import { apiFetch } from "./client";
import type { ApiCallError } from "./errors";

/** Khóa cache gồm tenantId: đổi tenant thì mọi truy vấn là khóa mới và tự tải lại. */
export const apiKey = (tenantId: string | undefined, path: string) => ["api", tenantId ?? "-", path] as const;

type Opts<T> = Omit<UseQueryOptions<T, ApiCallError>, "queryKey" | "queryFn">;

/**
 * GET dữ liệu từ lms-api: `useApi<Foo[]>("/api/books?keyword=x")`. Đường dẫn là một phần của khóa nên đổi query string là tải lại.
 * Trả UseQueryResult; dùng cùng <QueryBoundary query={...}>. Truyền `null` hoặc `enabled: false` để tạm dừng.
 */
export function useApi<T = unknown>(path: `/api/${string}` | null, options?: Opts<T>) {
  const tenantId = useSessionOptional()?.tenantId;
  return useQuery<T, ApiCallError>({
    ...options,
    queryKey: apiKey(tenantId, path ?? ""),
    queryFn: ({ signal }) => apiFetch<T>(path as `/api/${string}`, { signal }),
    enabled: path !== null && (options?.enabled ?? true),
  });
}

const matches = (key: readonly unknown[], prefixes: string[]) =>
  key[0] === "api" && prefixes.some((p) => String(key[2]).startsWith(p));

/**
 * Ghi dữ liệu: `useApiMutation((v: Body) => apiFetch("/api/x", { method: "POST", json: v }), { invalidate: ["/api/x"] })`.
 * `invalidate` là tiền tố đường dẫn: mọi truy vấn useApi có path bắt đầu bằng tiền tố đó sẽ tải lại sau khi thành công.
 */
export function useApiMutation<TData = unknown, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, ApiCallError, TVars>, "mutationFn"> & { invalidate?: string[] },
) {
  const qc = useQueryClient();
  const { invalidate, onSuccess, ...rest } = options ?? {};
  return useMutation<TData, ApiCallError, TVars>({
    ...rest,
    mutationFn: fn,
    onSuccess: async (data, vars, ctx, meta) => {
      if (invalidate?.length) await qc.invalidateQueries({ predicate: (q) => matches(q.queryKey, invalidate) });
      return onSuccess?.(data, vars, ctx, meta);
    },
  });
}

/** Tải lại các truy vấn useApi theo tiền tố đường dẫn (dùng ngoài useApiMutation). */
export function useInvalidateApi() {
  const qc = useQueryClient();
  return (...prefixes: string[]) => qc.invalidateQueries({ predicate: (q) => matches(q.queryKey, prefixes) });
}
