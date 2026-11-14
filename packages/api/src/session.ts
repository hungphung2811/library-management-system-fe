import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, SHELL_URL } from "./config";

export type Session = {
  userId: string;
  roles: string[];
  permissions: string[];
  departmentId?: string;
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
  return {
    userId: String(p.sub ?? ""),
    roles: (p.roles as string[]) ?? [],
    permissions: (p.permissions as string[]) ?? [],
    departmentId: p.departmentId as string | undefined,
    accessToken: token,
  };
}

/**
 * Mỗi zone tự bảo vệ trang của mình (không chỉ dựa vào proxy của shell):
 * chưa đăng nhập thì chuyển về trang login của shell, kèm đường dẫn để quay lại.
 */
export async function requireSession(nextPath: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`${SHELL_URL}/login?next=${encodeURIComponent(nextPath)}`);
  return s;
}

export function can(session: Session | null, permission: string) {
  return !!session?.permissions.includes(permission);
}
