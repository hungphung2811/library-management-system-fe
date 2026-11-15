// Không import next/*: dùng được ở cả server lẫn client component (qua @mfe/api/client).

/** Thông tin lỗi dạng object thuần, server component truyền được cho ErrorPanel. */
export type ErrorInfo = { status: number; code?: string; message?: string; details?: string[] };

export class ApiCallError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
    public details?: string[],
  ) {
    super(message ?? (code ? `${code} (${status})` : `Lỗi ${status}`));
    this.name = "ApiCallError";
  }
}

type GatewayLike = { status: number; body?: { code?: string; message?: string; details?: string[] } };

// GatewayError (gateway.ts) nhận diện theo hình dạng để file này không phải import gateway.ts (kéo next/headers).
function isGatewayLike(e: unknown): e is GatewayLike {
  return (
    e instanceof Error &&
    e.name !== "ApiCallError" &&
    typeof (e as { status?: unknown }).status === "number" &&
    "body" in e
  );
}

/** Chuyển lỗi bất kỳ (GatewayError, ApiCallError, lỗi mạng...) thành ErrorInfo. */
export function toErrorInfo(e: unknown): ErrorInfo {
  if (e instanceof ApiCallError) {
    if (e.status === 0) return { status: 503, code: e.code ?? "NETWORK" };
    return { status: e.status, code: e.code, message: e.message, details: e.details };
  }
  if (isGatewayLike(e)) {
    return { status: e.status, code: e.body?.code, message: e.body?.message, details: e.body?.details };
  }
  if (e instanceof TypeError) return { status: 503, code: "NETWORK" };
  return { status: 500 };
}
