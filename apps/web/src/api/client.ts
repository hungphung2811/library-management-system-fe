import { ApiCallError } from "./errors";
import type { TokenResponse } from "./config";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./token-store";

type ErrBody = { code?: string; message?: string; details?: string[] };

let refreshing: Promise<boolean> | null = null;

/**
 * Làm mới access token bằng refresh token trong localStorage. Các lời gọi đồng thời dùng chung một promise.
 * Trả true khi có access token mới. Refresh bị BE từ chối (4xx) thì xóa phiên; lỗi mạng/5xx giữ refresh token để thử lại sau.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (res.ok) {
        setTokens((await res.json()) as TokenResponse);
        return true;
      }
      // Chỉ xóa khi refresh token chưa bị thay (đăng nhập mới giữa chừng không bị refresh cũ xóa mất).
      if (res.status < 500 && getRefreshToken() === rt) clearTokens();
      return false;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function parseError(res: Response): Promise<ApiCallError> {
  const b = (await res.json().catch(() => undefined)) as ErrBody | undefined;
  return new ApiCallError(res.status, b?.code, b?.message, b?.details);
}

export type ApiInit = Omit<RequestInit, "body"> & {
  json?: unknown;
  body?: BodyInit | null;
  /** true: không gắn Bearer và không refresh khi 401 (login, refresh). */
  anonymous?: boolean;
};

/**
 * Gọi lms-api cùng origin (`/api/...`, proxy ở dev, nginx ở production). Gắn Bearer từ bộ nhớ.
 * 401: làm mới phiên một lần rồi gọi lại; vẫn 401 thì xóa phiên (ProtectedRoute đưa về /login?next=) và ném ApiCallError 401.
 * Lỗi ném ApiCallError; 204 trả undefined. Đoạn đường dẫn chứa dữ liệu người dùng phải tự encodeURIComponent.
 */
export async function apiFetch<T = unknown>(path: `/api/${string}`, init: ApiInit = {}): Promise<T> {
  const { json, headers, anonymous, body, ...rest } = init;
  let usedToken: string | null = null;
  const call = async () => {
    const token = anonymous ? null : getAccessToken();
    usedToken = token;
    try {
      return await fetch(path, {
        ...rest,
        cache: "no-store",
        headers: {
          ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: json !== undefined ? JSON.stringify(json) : body,
      });
    } catch {
      throw new ApiCallError(0, "NETWORK", "Không kết nối được máy chủ");
    }
  };

  // Chưa có access token (đang boot hoặc vừa hết hạn) mà còn refresh token: lấy access trước khi gọi.
  if (!anonymous && !getAccessToken() && getRefreshToken()) await refreshSession();

  let res = await call();
  if (res.status === 401 && !anonymous) {
    if (await refreshSession()) res = await call();
    if (res.status === 401) {
      // Chỉ xóa phiên nếu token hiện tại vẫn là token vừa bị từ chối (không xóa token của lần đăng nhập mới hơn).
      if (getAccessToken() === usedToken) clearTokens();
      throw new ApiCallError(401, "UNAUTHENTICATED", "Phiên đã hết hạn");
    }
  }
  if (!res.ok) {
    const err = await parseError(res);
    // ADR-0009: 403 MODULE_NOT_ENABLED có thể do token cũ (module vừa được bật): làm mới phiên một lần rồi gọi lại.
    if (err.code === "MODULE_NOT_ENABLED" && !anonymous && (await refreshSession())) {
      res = await call();
      if (res.ok) {
        if (res.status === 204) return undefined as T;
        const t = await res.text();
        return (t ? JSON.parse(t) : undefined) as T;
      }
      throw await parseError(res);
    }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
