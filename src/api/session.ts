export type Session = {
  /** `sub` của JWT: id người dùng. */
  userId: string;
  /** Tên đăng nhập (claim `username`), dùng để hiển thị. */
  username: string;
  roles: string[];
  permissions: string[];
  departmentId?: string;
  /** Claim `tenantId`: đơn vị đang làm việc. */
  tenantId?: string;
  /** Claim `admin=true`: có role quản trị, BE bỏ qua kiểm khóa quyền. */
  admin: boolean;
  /** Claim `platformAdmin=true` và không có `tenantId`: quản trị nền tảng SaaS (CMS, yêu cầu liên hệ). BE (system-service) kiểm lại. */
  platformAdmin: boolean;
  /** Claim `modules`: module đơn vị đã bật (LENDING, SALES). Token cũ thiếu claim coi là ["LENDING"] như BE (ADR-0009). */
  modules: string[];
  /** Tài khoản phải đổi mật khẩu: token không mang admin/permissions cho tới khi đổi. */
  mustChangePassword: boolean;
  accessToken: string;
  /** Chỉ có với platform admin đang làm việc thay một đơn vị (xem `withActingTenant`): id đơn vị đó (cũng đặt vào `tenantId`). */
  actingTenantId?: string;
};

/** Giải mã base64url thành chuỗi UTF-8 bằng atob (không dùng Buffer). */
function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function decodePayload(jwt: string): Record<string, unknown> | null {
  try {
    return JSON.parse(decodeBase64Url(jwt.split(".")[1]));
  } catch {
    return null;
  }
}

/** Đọc Session từ access token. Không verify chữ ký: BE là nơi verify và kiểm quyền. */
export function sessionFromToken(token: string | null): Session | null {
  if (!token) return null;
  const p = decodePayload(token);
  if (!p) return null;
  const userId = String(p.sub ?? "");
  return {
    userId,
    username: typeof p.username === "string" ? p.username : userId,
    roles: (p.roles as string[]) ?? [],
    permissions: (p.permissions as string[]) ?? [],
    departmentId: p.departmentId as string | undefined,
    tenantId: typeof p.tenantId === "string" ? p.tenantId : undefined,
    admin: p.admin === true,
    platformAdmin: p.platformAdmin === true && typeof p.tenantId !== "string",
    modules: Array.isArray(p.modules) ? (p.modules as unknown[]).filter((m): m is string => typeof m === "string") : ["LENDING"],
    mustChangePassword: p.mustChangePassword === true,
    accessToken: token,
  };
}

const ALL_MODULES: string[] = ["LENDING", "SALES"];

/**
 * Platform admin chọn một đơn vị để làm việc thay (ADR-0016): session hiệu lực mang `tenantId` đó, `admin=true` và đủ module
 * (BE cũng coi họ là admin của đơn vị, bỏ qua kiểm khóa và module), nhưng `platformAdmin` vẫn `true` để giữ khu Nền tảng SaaS.
 * Người dùng khác hoặc chưa chọn đơn vị: trả nguyên session. Chỉ để ẩn/hiện UI, BE mới là nơi quyết định.
 */
export function withActingTenant(session: Session | null, actingTenantId: string | null): Session | null {
  if (!session || !session.platformAdmin || !actingTenantId) return session;
  return { ...session, admin: true, tenantId: actingTenantId, modules: ALL_MODULES, actingTenantId };
}

/** Quản trị viên luôn đúng; người khác cần khóa quyền trong claim `permissions`. Chỉ để ẩn/hiện UI, BE mới là nơi quyết định. */
export function can(session: Session | null | undefined, permission: string) {
  return !!session && (session.admin || session.permissions.includes(permission));
}

export type ModuleCode = "LENDING" | "SALES";

/** Đơn vị đã bật module chưa. Platform admin (không thuộc đơn vị) không bị chặn; chỉ để ẩn/hiện UI, BE trả 403 MODULE_NOT_ENABLED là quyết định cuối. */
export function hasModule(session: Pick<Session, "modules" | "platformAdmin"> | null | undefined, module: ModuleCode) {
  return !!session && (session.platformAdmin || session.modules.includes(module));
}
