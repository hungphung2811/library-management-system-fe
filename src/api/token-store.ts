// Kho token. Access token CHỈ nằm trong bộ nhớ (mất khi tải lại trang, lấy lại bằng refresh lúc boot).
// Refresh token nằm ở localStorage (khóa `lms_rt`) để giữ phiên qua các lần tải lại: đánh đổi XSS được ghi ở
// docs/design/2026-11-17-chuyen-vite-spa.md. Module này không phụ thuộc React.
import type { TokenResponse } from "./config";

export const REFRESH_KEY = "lms_rt";

let accessToken: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(t: Pick<TokenResponse, "accessToken" | "refreshToken">) {
  accessToken = t.accessToken;
  try {
    localStorage.setItem(REFRESH_KEY, t.refreshToken);
  } catch {
    /* localStorage bị chặn: phiên chỉ sống tới khi tải lại trang */
  }
  emit();
}

/**
 * Chỉ ghi refresh token mới vào localStorage, không đổi access token trong bộ nhớ và không thông báo cho React.
 * Dùng ngay trước khi tải lại trang (đổi đơn vị): lúc boot, refresh token này đổi ra access token của đơn vị mới,
 * nên không cần render lại hay gọi lại API của đơn vị cũ.
 */
export function persistRefreshTokenOnly(refreshToken: string) {
  try {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    /* localStorage bị chặn: không giữ được phiên qua lần tải lại */
  }
}

export function clearTokens() {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* bỏ qua */
  }
  emit();
}

export function subscribeTokens(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
