import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, GATEWAY_URL, REFRESH_COOKIE, type TokenResponse } from "@mfe/api";
import { setSessionCookies } from "../../../../lib-cookies";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chuyển đơn vị làm việc. Client chỉ gửi `{tenantId}`; refresh token nằm trong cookie httpOnly nên shell gắn vào.
 * BE (`AuthController/switchTenant`, @AuthenticatedOnly) cần Bearer: thiếu lms_at (hết hạn) thì trả 401 để client làm mới phiên rồi thử lại.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { tenantId?: unknown } | null;
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
  if (!UUID.test(tenantId)) {
    return NextResponse.json({ code: "VALIDATION", message: "tenantId không hợp lệ" }, { status: 400 });
  }
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!at || !rt) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${GATEWAY_URL}/api/auth/switch-tenant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${at}` },
      body: JSON.stringify({ tenantId, refreshToken: rt }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ code: "GATEWAY_UNAVAILABLE", message: "Không kết nối được API Gateway" }, { status: 502 });
  }
  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({ message: "Không chuyển được đơn vị" }));
    return NextResponse.json(err, { status: upstream.status });
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookies(res, (await upstream.json()) as TokenResponse);
  return res;
}
