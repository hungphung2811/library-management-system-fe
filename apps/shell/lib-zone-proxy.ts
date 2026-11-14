import type { NextRequest } from "next/server";

export const ZONES = {
  catalog: process.env.CATALOG_URL ?? "http://localhost:3001",
  circulation: process.env.CIRCULATION_URL ?? "http://localhost:3002",
  admin: process.env.ADMIN_URL ?? "http://localhost:3003",
} as const;

export type ZoneName = keyof typeof ZONES;

const DROP_REQUEST = ["host", "connection", "accept-encoding", "content-length"];
const DROP_RESPONSE = ["content-encoding", "content-length", "transfer-encoding", "connection"];

function unavailable(zone: string) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Module tạm thời không khả dụng</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:96px auto;padding:0 16px;color:#16181d}@media(prefers-color-scheme:dark){body{background:#0f1115;color:#e8eaee}a{color:#60a5fa}}</style></head>
<body><h1>Module "${zone}" tạm thời không khả dụng</h1>
<p>Các phần khác của hệ thống vẫn hoạt động bình thường. Vui lòng thử lại sau ít phút.</p>
<p><a href="/">← Về trang chủ</a></p></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "30" },
  });
}

/**
 * Chuyển tiếp request tới zone. Khác với rewrites, nếu zone chết/chậm thì trả trang 503 thân thiện
 * thay vì lỗi 500 trần. (Asset /<zone>-static vẫn đi qua rewrites vì chỉ cần khi trang đã tải được.)
 */
export function createZoneHandler(zone: ZoneName) {
  const origin = ZONES[zone];
  return async function handler(req: NextRequest) {
    const target = new URL(req.nextUrl.pathname + req.nextUrl.search, origin);
    const headers = new Headers(req.headers);
    DROP_REQUEST.forEach((h) => headers.delete(h));
    headers.set("x-forwarded-host", req.nextUrl.host);
    headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", ""));

    const hasBody = !["GET", "HEAD"].includes(req.method);
    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers,
        body: hasBody ? req.body : undefined,
        duplex: "half",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      } as RequestInit & { duplex: "half" });
    } catch {
      return unavailable(zone);
    }
    if (upstream.status >= 502 && upstream.status <= 504) return unavailable(zone);

    const out = new Headers(upstream.headers);
    DROP_RESPONSE.forEach((h) => out.delete(h));
    const loc = out.get("location");
    if (loc?.startsWith(origin)) out.set("location", loc.replace(origin, req.nextUrl.origin));
    return new Response(upstream.body, { status: upstream.status, headers: out });
  };
}
