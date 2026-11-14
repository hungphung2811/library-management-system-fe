import type { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, type TokenResponse } from "@mfe/api";

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setSessionCookies(res: NextResponse, t: TokenResponse) {
  res.cookies.set(ACCESS_COOKIE, t.accessToken, { ...base, maxAge: Math.max(t.expiresIn - 5, 1) });
  res.cookies.set(REFRESH_COOKIE, t.refreshToken, { ...base, maxAge: 60 * 60 * 24 * 7 });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}
