// Mock phiên đăng nhập thiết bị (ADR-0017): /api/auth/sessions[/{sessionId}|/revocation] theo docs/api/phien-da-thiet-bi.md.
// Chỉ cần đăng nhập (không có khóa). Chủ thể là người gọi; phiên được gieo lười cho từng tài khoản (3 phiên, phiên đầu là "current").
// Token mock không có claim `sid` nên phiên hiện tại là phiên đánh dấu current. Đặt lại: POST /api/auth/_mock/sessions.
const SESSIONS = new Map();
const uuid = () => crypto.randomUUID();
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const ahead = (min) => new Date(Date.now() + min * 60_000).toISOString();

const seed = () => [
  { sessionId: uuid(), channel: "STAFF", tenantId: "t1", tenantName: "Thư viện mẫu", deviceSummary: "Chrome trên Windows", ipAddress: "203.0.113.10", startedAt: ago(60), lastUsedAt: ago(1), expiresAt: ahead(60 * 24 * 7), current: true },
  { sessionId: uuid(), channel: "STAFF", tenantId: "t1", tenantName: "Thư viện mẫu", deviceSummary: "Safari trên iPhone", ipAddress: "203.0.113.22", startedAt: ago(600), lastUsedAt: ago(30), expiresAt: ahead(60 * 24 * 6), current: false },
  { sessionId: uuid(), channel: "STOREFRONT", tenantId: "t1", tenantName: "Thư viện mẫu", deviceSummary: null, ipAddress: null, startedAt: ago(2000), lastUsedAt: ago(900), expiresAt: ahead(60 * 24 * 3), current: false },
];
const of = (user) => {
  if (!SESSIONS.has(user)) SESSIONS.set(user, seed());
  return SESSIONS.get(user);
};

export function handle({ method, url, body, send, caller }) {
  const p = url.pathname;
  if (!p.startsWith("/api/auth/sessions") && p !== "/api/auth/_mock/sessions") return false;
  if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), true;
  const err = (status, code, message) => (send(status, { code, message, details: [], timestamp: new Date().toISOString() }), true);
  let m;
  if (p === "/api/auth/_mock/sessions" && method === "POST") return SESSIONS.set(caller, seed()), send(204), true;
  if (p === "/api/auth/sessions" && method === "GET") {
    return send(200, [...of(caller)].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))), true;
  }
  if (p === "/api/auth/sessions/revocation" && method === "POST") {
    if (typeof body.keepCurrent !== "boolean") return err(400, "VALIDATION_FAILED", "keepCurrent là bắt buộc");
    const list = of(caller);
    const kept = body.keepCurrent ? list.filter((s) => s.current) : [];
    SESSIONS.set(caller, kept);
    return send(200, { revokedSessions: list.length - kept.length }), true;
  }
  if ((m = p.match(/^\/api\/auth\/sessions\/([^/]+)$/)) && method === "DELETE") {
    const list = of(caller);
    const i = list.findIndex((s) => s.sessionId === m[1]);
    if (i < 0) return err(404, "SESSION_NOT_FOUND", "Không có phiên này");
    list.splice(i, 1);
    return send(204), true;
  }
  return false;
}
