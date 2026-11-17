export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number; // giây
  /** True khi tài khoản phải đổi mật khẩu: token chưa mang admin/permissions. */
  mustChangePassword?: boolean;
};

export type ApiError = { code: string; message: string; details?: string[] };
