import { type NextRequest } from "next/server";
import { ACCESS_COOKIE, GATEWAY_URL } from "@mfe/api";

// BFF: client component gọi /api/bff/{đường dẫn BE}; shell gắn Bearer từ cookie httpOnly
// rồi chuyển tiếp tới gateway. Trình duyệt không cầm token và không dính CORS.
async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return Response.json({ code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }, { status: 401 });

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const upstream = await fetch(`${GATEWAY_URL}/api/${path.join("/")}${req.nextUrl.search}`, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${at}`,
      "Content-Type": req.headers.get("content-type") ?? "application/json",
    },
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
