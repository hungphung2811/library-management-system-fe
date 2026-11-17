/** Thông tin lỗi dạng object thuần, truyền được cho ErrorPanel. */
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

/** Chuyển lỗi bất kỳ (ApiCallError, lỗi mạng...) thành ErrorInfo. */
export function toErrorInfo(e: unknown): ErrorInfo {
  if (e instanceof ApiCallError) {
    if (e.status === 0) return { status: 503, code: e.code ?? "NETWORK" };
    return { status: e.status, code: e.code, message: e.message, details: e.details };
  }
  if (e instanceof TypeError) return { status: 503, code: "NETWORK" };
  return { status: 500 };
}
