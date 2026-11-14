import { NextResponse } from "next/server";
import { GATEWAY_URL, type TokenResponse } from "@mfe/api";
import { setSessionCookies } from "../../../../lib-cookies";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.username || !body?.password) {
    return NextResponse.json({ message: "Thiếu username hoặc password" }, { status: 400 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: body.username, password: body.password }),
    });
  } catch {
    return NextResponse.json({ message: "Không kết nối được API Gateway" }, { status: 502 });
  }
  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({ message: "Đăng nhập thất bại" }));
    return NextResponse.json(err, { status: upstream.status });
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookies(res, (await upstream.json()) as TokenResponse);
  return res;
}
