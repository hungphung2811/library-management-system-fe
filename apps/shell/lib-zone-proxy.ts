import type { NextRequest } from "next/server";

export const ZONES = {
  admin: process.env.ADMIN_URL ?? "http://localhost:3003",
} as const;

export type ZoneName = keyof typeof ZONES;

/** Quá ngưỡng này (ms) thì coi zone là không khả dụng. Máy tải nặng (CI, E2E) có thể cần đặt cao hơn. */
const ZONE_TIMEOUT_MS = Number(process.env.ZONE_TIMEOUT_MS) || 10_000;

const DROP_REQUEST = ["host", "connection", "accept-encoding", "content-length"];
const DROP_RESPONSE = ["content-encoding", "content-length", "transfer-encoding", "connection"];

/**
 * Trang 503 nằm trong khung ứng dụng (sidebar + header): lấy HTML của `/zone-unavailable/<zone>` ở chính shell
 * (gọi qua loopback, kèm cookie để biết người dùng) rồi trả với status 503 tại URL hiện tại.
 * Lấy không được (shell quá tải, lỗi render) thì rơi về trang HTML tĩnh bên dưới.
 */
async function unavailable(zone: string, req: NextRequest) {
  try {
    const self = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
    const res = await fetch(new URL(`/zone-unavailable/${encodeURIComponent(zone)}`, self), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return new Response(await res.text(), {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "30" },
      });
    }
  } catch (err) {
    console.error(`[zone-proxy] không dựng được trang 503 trong khung cho ${zone}`, err);
  }
  return plainUnavailable(zone);
}

function plainUnavailable(zone: string) {
  const html =`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Module tạm thời không khả dụng</title>
<style>body{font-family:Inter,system-ui,sans-serif;max-width:440px;margin:96px auto;padding:32px;background:#fff;border:1px solid #e6e8ef;border-radius:12px;color:#1e2230}h1{font-size:20px;margin:0 0 12px}p{color:#6b7083;line-height:1.6}a{color:#056ee9}@media(max-width:520px){body{margin:24px 16px}}</style></head>
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
        signal: AbortSignal.timeout(ZONE_TIMEOUT_MS),
      } as RequestInit & { duplex: "half" });
    } catch (err) {
      console.error(`[zone-proxy] ${zone} không kết nối được: ${req.method} ${target}`, err);
      return unavailable(zone, req);
    }
    if (upstream.status >= 502 && upstream.status <= 504) {
      console.error(`[zone-proxy] ${zone} trả ${upstream.status}: ${req.method} ${target}`);
      return unavailable(zone, req);
    }

    const out = new Headers(upstream.headers);
    DROP_RESPONSE.forEach((h) => out.delete(h));
    const loc = out.get("location");
    if (loc?.startsWith(origin)) out.set("location", loc.replace(origin, req.nextUrl.origin));
    return new Response(upstream.body, { status: upstream.status, headers: out });
  };
}
