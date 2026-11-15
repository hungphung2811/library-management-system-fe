import { NextResponse, type NextRequest } from "next/server";
import { GATEWAY_URL, REFRESH_COOKIE, type TokenResponse } from "@mfe/api";
import { clearSessionCookies, setSessionCookies } from "../../../../lib-cookies";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/"; // chống open redirect
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;

  const fail = () => {
    const r = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.url));
    clearSessionCookies(r);
    return r;
  };
  if (!rt) return fail();

  const upstream = await fetch(`${GATEWAY_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  }).catch(() => null);
  if (!upstream?.ok) return fail();

  const res = NextResponse.redirect(new URL(next, req.url));
  setSessionCookies(res, (await upstream.json()) as TokenResponse);
  return res;
}

/**
 * Dạng JSON cho client (bffFetch làm mới phiên ngầm): 204 + cookie mới, hoặc 401 + xóa cookie.
 * Không có tham số `next` nên không có chuyển hướng (không có nguy cơ open redirect).
 */
export async function POST(req: NextRequest) {
  const rt = req.cookies.get(REFRESH_COOKIE)?.value;
  const fail = () => {
    const r = new NextResponse(null, { status: 401 });
    clearSessionCookies(r);
    return r;
  };
  if (!rt) return fail();

  const upstream = await fetch(`${GATEWAY_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  }).catch(() => null);
  if (!upstream) return new NextResponse(null, { status: 502 }); // gateway chết: giữ cookie, thử lại sau
  if (!upstream.ok) return fail();

  const res = new NextResponse(null, { status: 204 });
  setSessionCookies(res, (await upstream.json()) as TokenResponse);
  return res;
}
