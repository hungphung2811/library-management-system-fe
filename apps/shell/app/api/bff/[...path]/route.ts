import { type NextRequest } from "next/server";
import { ACCESS_COOKIE, GATEWAY_URL } from "@mfe/api";

// BFF: client component gọi /api/bff/{đường dẫn BE}; shell gắn Bearer từ cookie httpOnly
// rồi chuyển tiếp tới gateway. Trình duyệt không cầm token và không dính CORS.
// Cố ý KHÔNG chuyển tiếp Set-Cookie của BE (xem docs/design/2026-11-15-shared-design.md, Q3c).
async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return Response.json({ code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }, { status: 401 });

  // params.path là các đoạn đã giải mã: mã hóa lại từng đoạn để `?`, `#`, `%` trong dữ liệu (barcode...) không thành query/fragment.
  const target = `${GATEWAY_URL}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${at}`,
        "Content-Type": req.headers.get("content-type") ?? "application/json",
      },
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { code: "GATEWAY_UNAVAILABLE", message: "Hệ thống tạm thời chưa phản hồi. Vui lòng thử lại sau ít phút." },
      { status: 502 },
    );
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
