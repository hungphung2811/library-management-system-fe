import { ApiCallError } from "./errors";
import { getActingTenant, skipsActingTenant } from "./acting-tenant";
import type { TokenResponse } from "./config";
import { sessionFromToken } from "./session";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./token-store";

type ErrBody = { code?: string; message?: string; details?: string[] };

/**
 * Kết quả làm mới phiên (ADR-0017, ADR-0022):
 * - ok: có access token mới.
 * - no-token: không có refresh token.
 * - revoked: refresh token bị thu hồi/hết hạn/tái sử dụng (401 khác) hoặc BE từ chối khác: phiên đã bị xóa.
 * - disabled / locked: 403 ACCOUNT_DISABLED / 423 ACCOUNT_LOCKED: phiên đã bị xóa.
 * - no-tenant: 403 NO_TENANT_ACCESS (không còn thuộc đơn vị): giữ phiên, cần chọn đơn vị khác.
 * - superseded: 401 REFRESH_TOKEN_SUPERSEDED mà đọc lại vẫn không có token mới hơn: KHÔNG xóa phiên, thử lại sau.
 * - transient: 429/5xx/lỗi mạng: không xóa phiên.
 */
export type RefreshOutcome = "ok" | "no-token" | "revoked" | "disabled" | "locked" | "no-tenant" | "superseded" | "transient";

let refreshing: Promise<RefreshOutcome> | null = null;

const SUPERSEDED_RETRIES = 2;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Một lần gọi POST /api/auth/refresh với token `rt`, phân loại kết quả (chưa xử lý SUPERSEDED). */
async function attemptRefresh(rt: string): Promise<RefreshOutcome | "superseded-raw"> {
  let res: Response;
  try {
    res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
  } catch {
    return "transient";
  }
  if (res.ok) {
    try {
      setTokens((await res.json()) as TokenResponse);
      return "ok";
    } catch {
      return "transient";
    }
  }
  const code = ((await res.json().catch(() => undefined)) as ErrBody | undefined)?.code;
  if (res.status === 429 || res.status === 408 || res.status >= 500) return "transient";
  if (res.status === 401 && code === "REFRESH_TOKEN_SUPERSEDED") return "superseded-raw";
  // Chỉ xóa khi refresh token chưa bị thay (đăng nhập mới/tab khác xoay token giữa chừng không bị refresh cũ xóa mất).
  const endSession = () => {
    if (getRefreshToken() === rt) clearTokens();
  };
  if (res.status === 423 || code === "ACCOUNT_LOCKED") return endSession(), "locked";
  if (code === "ACCOUNT_DISABLED") return endSession(), "disabled";
  if (res.status === 403 && code === "NO_TENANT_ACCESS") return "no-tenant";
  endSession();
  return "revoked";
}

async function runRefresh(): Promise<RefreshOutcome> {
  // Đọc refresh token MỚI NHẤT sau khi giữ khóa (tab khác có thể vừa ghi token mới).
  let rt = getRefreshToken();
  if (!rt) return "no-token";
  for (let i = 0; ; i++) {
    const r = await attemptRefresh(rt);
    if (r !== "superseded-raw") return r;
    // Tab/thiết bị khác vừa xoay token: BE không phát token. Đọc lại token mới nhất rồi thử lại, không đăng xuất.
    if (i >= SUPERSEDED_RETRIES) return "superseded";
    await wait(i === 0 ? 150 : 400);
    const latest = getRefreshToken();
    if (!latest) return "no-token"; // tab khác đã đăng xuất
    rt = latest;
  }
}

/** Chạy trong Web Lock `lms-refresh` để các tab không làm mới đồng thời; không hỗ trợ thì chạy thẳng (dựa vào ân hạn của BE). */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return fn();
  return locks.request("lms-refresh", fn) as Promise<T>;
}

/**
 * Làm mới access token và trả kết quả phân loại. Các lời gọi đồng thời trong tab dùng chung một promise, giữa các tab
 * dùng Web Locks. Chỉ các kết quả revoked/disabled/locked mới xóa phiên.
 */
export function refreshSessionDetailed(): Promise<RefreshOutcome> {
  refreshing ??= withRefreshLock(runRefresh)
    .catch((): RefreshOutcome => "transient")
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Như refreshSessionDetailed nhưng chỉ trả true khi có access token mới. */
export async function refreshSession(): Promise<boolean> {
  return (await refreshSessionDetailed()) === "ok";
}

async function parseError(res: Response): Promise<ApiCallError> {
  const b = (await res.json().catch(() => undefined)) as ErrBody | undefined;
  return new ApiCallError(res.status, b?.code, b?.message, b?.details);
}

/**
 * Header `X-Tenant-Id` cho platform admin đang làm việc thay một đơn vị (ADR-0016). Chỉ gắn khi token là của platform admin
 * (BE bỏ qua header của người khác) và đường dẫn thuộc một đơn vị (không phải đăng nhập hay vùng nền tảng).
 */
function actingTenantFor(path: string, token: string | null): string | null {
  if (!token) return null;
  const acting = getActingTenant();
  if (!acting || skipsActingTenant(path)) return null;
  return sessionFromToken(token)?.platformAdmin ? acting : null;
}

export type ApiInit = Omit<RequestInit, "body"> & {
  json?: unknown;
  body?: BodyInit | null;
  /** true: không gắn Bearer và không refresh khi 401 (login, refresh). */
  anonymous?: boolean;
  /** true: thân trả về là tệp (dùng qua apiDownload), không parse JSON. */
  download?: boolean;
};

export type Downloaded = { blob: Blob; filename: string | null };

/**
 * Gọi lms-api cùng origin (`/api/...`, proxy ở dev, nginx ở production). Gắn Bearer từ bộ nhớ.
 * 401: làm mới phiên một lần rồi gọi lại; vẫn 401 thì xóa phiên (ProtectedRoute đưa về /login?next=) và ném ApiCallError 401.
 * Lỗi ném ApiCallError; 204 trả undefined. Đoạn đường dẫn chứa dữ liệu người dùng phải tự encodeURIComponent.
 */
export async function apiFetch<T = unknown>(path: `/api/${string}`, init: ApiInit = {}): Promise<T> {
  const { json, headers, anonymous, body, download, ...rest } = init;
  const readOk = async (r: Response): Promise<T> => {
    if (download) {
      const cd = r.headers.get("Content-Disposition") ?? "";
      const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
      const raw = m?.[1] ?? m?.[2];
      let filename: string | null = null;
      try {
        filename = raw ? decodeURIComponent(raw) : null;
      } catch {
        filename = raw ?? null;
      }
      return { blob: await r.blob(), filename } as T;
    }
    if (r.status === 204) return undefined as T;
    const t = await r.text();
    return (t ? JSON.parse(t) : undefined) as T;
  };
  let usedToken: string | null = null;
  const call = async () => {
    const token = anonymous ? null : getAccessToken();
    usedToken = token;
    const acting = actingTenantFor(path, token);
    try {
      return await fetch(path, {
        ...rest,
        cache: "no-store",
        headers: {
          ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(acting ? { "X-Tenant-Id": acting } : {}),
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
    const outcome = await refreshSessionDetailed();
    if (outcome === "ok") res = await call();
    if (res.status === 401) {
      // Chỉ xóa phiên nếu token hiện tại vẫn là token vừa bị từ chối (không xóa token của lần đăng nhập mới hơn) và
      // refresh không thất bại tạm thời (429/5xx/mạng/superseded: giữ refresh token để thử lại).
      const temporary = outcome === "transient" || outcome === "superseded" || outcome === "no-tenant";
      if (!temporary && getAccessToken() === usedToken) clearTokens();
      throw new ApiCallError(401, "UNAUTHENTICATED", "Phiên đã hết hạn");
    }
  }
  if (!res.ok) {
    const err = await parseError(res);
    // ADR-0009: 403 MODULE_NOT_ENABLED có thể do token cũ (module vừa được bật): làm mới phiên một lần rồi gọi lại.
    if (err.code === "MODULE_NOT_ENABLED" && !anonymous && (await refreshSession())) {
      res = await call();
      if (res.ok) return readOk(res);
      throw await parseError(res);
    }
    throw err;
  }
  return readOk(res);
}

/** GET một tệp (CSV...) có Bearer và refresh-on-401 như apiFetch. Trả Blob và tên tệp từ Content-Disposition (nếu có). */
export function apiDownload(path: `/api/${string}`, init: Omit<ApiInit, "download"> = {}): Promise<Downloaded> {
  return apiFetch<Downloaded>(path, { ...init, download: true });
}

/** Kích hoạt trình duyệt lưu Blob thành tệp `filename`. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
