import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, SHELL_URL } from "./config";

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
  /** Tài khoản phải đổi mật khẩu: token không mang admin/permissions cho tới khi đổi. */
  mustChangePassword: boolean;
  accessToken: string;
};

function decodePayload(jwt: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Đọc session từ cookie httpOnly (chỉ dùng phía server). Không verify chữ ký: gateway/service mới là nơi verify. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
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
    mustChangePassword: p.mustChangePassword === true,
    accessToken: token,
  };
}

/**
 * Mỗi zone tự bảo vệ trang của mình (không chỉ dựa vào proxy của shell):
 * chưa đăng nhập thì chuyển về trang login của shell, kèm đường dẫn để quay lại;
 * tài khoản phải đổi mật khẩu thì chuyển sang trang đổi mật khẩu.
 */
export async function requireSession(nextPath: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`${SHELL_URL}/login?next=${encodeURIComponent(nextPath)}`);
  if (s.mustChangePassword) redirect(`${SHELL_URL}/change-password`);
  return s;
}

/** Quản trị viên luôn đúng; người khác cần khóa quyền trong claim `permissions`. Chỉ để ẩn/hiện UI, BE mới là nơi quyết định. */
export function can(session: Session | null, permission: string) {
  return !!session && (session.admin || session.permissions.includes(permission));
}
