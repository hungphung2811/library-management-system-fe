// Subpath an toàn cho client component: KHÔNG import next/headers, next/navigation hay session.ts.
export * from "./config";
export * from "./permissions";
export * from "./errors";

import { ApiCallError } from "./errors";

let refreshing: Promise<boolean> | null = null;

/** Làm mới phiên ngầm; các lời gọi đồng thời dùng chung một promise. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/session/refresh", { method: "POST", cache: "no-store" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function goLogin(): never {
  location.assign("/login?next=" + encodeURIComponent(location.pathname + location.search));
  throw new ApiCallError(401, "UNAUTHENTICATED", "Phiên đã hết hạn");
}

/**
 * Gọi BE từ client component qua BFF của shell. `path` là đường dẫn BE đầy đủ (`/api/books?keyword=x`);
 * helper tự đổi tiền tố `/api/` thành `/api/bff/`. Lỗi ném ApiCallError; 204 trả undefined.
 * 401: làm mới phiên một lần rồi gọi lại; vẫn 401 thì chuyển về /login.
 * Đoạn đường dẫn chứa dữ liệu người dùng phải được zone tự encodeURIComponent từng đoạn.
 */
export async function bffFetch<T = unknown>(
  path: `/api/${string}`,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error(`bffFetch: đường dẫn phải bắt đầu bằng /api/ (nhận "${path}")`);
  const { json, headers, ...rest } = init;
  const url = `/api/bff/${path.slice("/api/".length)}`;
  const build = (): RequestInit => ({
    ...rest,
    cache: "no-store",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const call = async () => {
    try {
      return await fetch(url, build());
    } catch {
      throw new ApiCallError(0, "NETWORK", "Không kết nối được máy chủ");
    }
  };

  let res = await call();
  if (res.status === 401) {
    if (await refreshSession()) res = await call();
    if (res.status === 401) goLogin();
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => undefined)) as
      | { code?: string; message?: string; details?: string[] }
      | undefined;
    throw new ApiCallError(res.status, b?.code, b?.message, b?.details);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
