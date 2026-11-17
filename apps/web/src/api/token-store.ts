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
