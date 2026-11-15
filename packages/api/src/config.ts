// File này KHÔNG import next/headers để dùng được trong proxy.ts (import qua "@mfe/api/config").
export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
/** URL công khai của shell; zone dùng để chuyển người dùng chưa đăng nhập về /login. */
export const SHELL_URL = process.env.SHELL_URL ?? "http://localhost:3000";
export const ACCESS_COOKIE = "lms_at";
export const REFRESH_COOKIE = "lms_rt";

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number; // giây
  /** True khi tài khoản phải đổi mật khẩu: token chưa mang admin/permissions. */
  mustChangePassword?: boolean;
};

export type ApiError = { code: string; message: string; details?: string[] };
