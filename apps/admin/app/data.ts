import { gatewayFetch, toErrorInfo, type ErrorInfo } from "@mfe/api";

/** Kết quả gọi BE phía server: có `data` hoặc có `error` (object thuần, truyền được cho ErrorPanel). */
export type Loaded<T> = { data: T; error?: undefined } | { data?: undefined; error: ErrorInfo };

/** Bọc gatewayFetch trong try/catch. KHÔNG bọc requireSession (redirect() hoạt động bằng cách ném lỗi). */
export async function load<T>(path: string): Promise<Loaded<T>> {
  try {
    return { data: await gatewayFetch<T>(path) };
  } catch (e) {
    return { error: toErrorInfo(e) };
  }
}

/** Đọc một tham số query dạng chuỗi (searchParams của Next có thể là mảng). */
export function qp(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** `page` trên URL đánh số từ 1. */
export function pageNo(v: string | string[] | undefined): number {
  const n = Number.parseInt(qp(v), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Mã lỗi riêng của admin (bổ sung cho bảng chung). Chưa rõ mã thật của BE nên chỉ khai báo câu chắc chắn đúng nghĩa. */
export const ADMIN_ERROR_MESSAGES: Record<string, string> = {};
