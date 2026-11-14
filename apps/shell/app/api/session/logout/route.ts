import { NextResponse, type NextRequest } from "next/server";
import { GATEWAY_URL, REFRESH_COOKIE } from "@mfe/api";
import { clearSessionCookies } from "../../../../lib-cookies";

export async function POST(req: NextRequest) {
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  if (rt) {
    // Best-effort: thu hồi refresh token ở BE
    await fetch(`${GATEWAY_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => null);
  }
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  clearSessionCookies(res);
  return res;
}
