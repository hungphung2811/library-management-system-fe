// Mock của lms-api (đứng sau `vite preview` proxy /api)  để chạy E2E mà không cần BE. Chỉ cài đủ các endpoint FE đang gọi.
// Mô phỏng phân quyền động của BE (ADR-0003): khóa quyền là "Controller/method", quản trị viên là claim admin=true,
// token của tài khoản phải đổi mật khẩu không mang admin/permissions.
// File này giữ server, JWT và login/refresh/logout/password; endpoint nghiệp vụ nằm ở e2e/mock/*.mjs
// (hợp đồng mỗi module: `export function handle(ctx): boolean`, xem mock/common.mjs).
// Chạy: PORT=4201 node e2e/mock-gateway.mjs (playwright.config.ts tự chạy; cổng xem e2e/ports.ts)
import http from "node:http";
import { USERS } from "./mock/data.mjs";
import * as common from "./mock/common.mjs";
import * as shell from "./mock/shell.mjs";
import * as catalog from "./mock/catalog.mjs";
import * as circulation from "./mock/circulation.mjs";
import * as admin from "./mock/admin.mjs";
import * as platform from "./mock/platform.mjs";
import * as platformTenants from "./mock/platform-tenants.mjs";
import * as platformContracts from "./mock/platform-contracts.mjs";
import * as platformOrigins from "./mock/platform-origins.mjs";
import * as sales from "./mock/sales.mjs";
import * as salesContacts from "./mock/sales-contacts.mjs";
import * as catalogReference from "./mock/catalog-reference.mjs";
import * as imports from "./mock/imports.mjs";
import * as worksReports from "./mock/works-reports.mjs";
import * as salesBanners from "./mock/sales-banners.mjs";
import * as sessions from "./mock/sessions.mjs";
import * as applications from "./mock/applications.mjs";
import * as invoices from "./mock/invoices.mjs";
import * as shifts from "./mock/shifts.mjs";
import * as notifications from "./mock/notifications.mjs";

const PORT = Number(process.env.PORT ?? 4201);

// Tài khoản và điều khiển riêng cho e2e "Làm mới quyền" (ADR-0022). permuser không có khóa nào ban đầu; test đổi quyền qua
// POST /__test/user (mô phỏng admin gán role) và giả lập lỗi của /api/auth/refresh qua POST /__test/refresh.
USERS.permuser = {
  id: "permuser-id", roles: ["MEMBER"], permissions: [], password: "Permuser@12345",
  tenantId: USERS.admin.tenantId, tenants: [USERS.admin.tenantId],
};
const PERM_BASE = { roles: ["MEMBER"], permissions: [], admin: false };
/** username -> { mode: "superseded" | "revoked" | "disabled" | "locked" | "unavailable", count } (count lần đầu rồi trở lại bình thường). */
const REFRESH_FAULT = {};
const REFRESH_CALLS = {};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

// Thứ tự dispatch: common -> shell -> catalog -> circulation -> admin (nên /api/users/me rơi vào shell trước admin).
// platformTenants đứng đầu: chặn GET /api/users?tenantId= của platform admin trước khi common/admin kiểm khóa USER_SEARCH.
// platformContracts đứng trước platformTenants (nó trả 404 cho mọi /api/platform/** lạ) và nhận cả /api/contracts của tenant admin.
const MODULES = [invoices, shifts, notifications, applications, platformOrigins, platformContracts, platformTenants, common, shell, catalogReference, catalog, circulation, admin, platform, salesContacts, salesBanners, sessions, sales, imports, worksReports];

function claimsOf(username) {
  const u = USERS[username];
  const must = !!u.mustChangePassword;
  return {
    sub: u.id,
    username,
    roles: u.roles,
    departmentId: "dept-1",
    tenantId: u.tenantId,
    ...(u.modules ? { modules: u.modules } : {}),
    // Token của tài khoản phải đổi mật khẩu không mang admin/permissions.
    permissions: must ? [] : u.permissions,
    ...(u.platformAdmin ? { platformAdmin: true } : {}),
    ...(must ? { mustChangePassword: true } : u.admin ? { admin: true } : {}),
  };
}
const jwtFor = (username) => `${b64({ alg: "none" })}.${b64(claimsOf(username))}.sig`;
const userFromToken = (header = "") => Object.keys(USERS).find((u) => header === `Bearer ${jwtFor(u)}`);
const tokens = (username) => ({
  accessToken: jwtFor(username),
  refreshToken: `rt-${username}`,
  tokenType: "Bearer",
  expiresIn: 900,
  mustChangePassword: !!USERS[username].mustChangePassword,
});
const mayCall = (username, key) => {
  const c = claimsOf(username);
  return c.admin === true || c.permissions.includes(key);
};

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const send = (status, body) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        // Developer Portal: BE luôn trả no-store (phản hồi tạo credential chứa secret).
        if (req.url.startsWith("/api/applications")) res.setHeader("Cache-Control", "no-store");
        res.end(body === undefined ? "" : JSON.stringify(body));
      };
      let body = {};
      // multipart (tải tệp Excel): không parse JSON; module import đọc `raw` để lấy tên tệp.
      if (!String(req.headers["content-type"] ?? "").startsWith("multipart/")) {
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return send(400, { code: "BAD_JSON", message: "Body không phải JSON" });
        }
      }
      // Trả tệp nhị phân (tải .xlsx): Content-Disposition như BE.
      const sendFile = (status, buf, filename, extra = {}) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Cache-Control", "no-store");
        for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
        res.end(buf);
      };
      // Trả văn bản (bản in hóa đơn HTML): BE đặt thêm CSP, nosniff và no-store.
      const sendText = (status, text, type = "text/html;charset=UTF-8") => {
        res.statusCode = status;
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.end(text);
      };
      const caller = userFromToken(req.headers.authorization);
      const url = new URL(req.url, "http://mock");

      if (req.method === "GET" && url.pathname === "/__health") return send(200, { ok: true });

      // Điều khiển cho e2e (chỉ mock). Đặt lại permuser: { reset: true }; đổi quyền: { patch: { permissions, roles, ... } }.
      if (req.method === "POST" && url.pathname === "/__test/user") {
        const u = USERS[body.username];
        if (!u) return send(404, { code: "NOT_FOUND", message: "Không có user" });
        if (body.reset) Object.assign(u, PERM_BASE, { permissions: [] });
        if (body.patch) Object.assign(u, body.patch);
        REFRESH_CALLS[body.username] = 0;
        delete REFRESH_FAULT[body.username];
        return send(204);
      }
      if (req.method === "POST" && url.pathname === "/__test/refresh") {
        REFRESH_FAULT[body.username] = { mode: body.mode, count: body.count ?? 1 };
        return send(204);
      }
      if (req.method === "GET" && url.pathname === "/__test/refresh-calls") {
        return send(200, { calls: REFRESH_CALLS[url.searchParams.get("username")] ?? 0 });
      }

      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        const u = USERS[body.username];
        if (u && u.password === body.password) return send(200, tokens(body.username));
        return send(401, { code: "BAD_CREDENTIALS", message: "Sai thông tin đăng nhập" });
      }
      if (req.method === "POST" && url.pathname === "/api/auth/refresh") {
        const name = String(body.refreshToken ?? "").replace(/^rt-/, "");
        REFRESH_CALLS[name] = (REFRESH_CALLS[name] ?? 0) + 1;
        const f = REFRESH_FAULT[name];
        if (f && f.count > 0) {
          f.count--;
          const errs = {
            superseded: [401, "REFRESH_TOKEN_SUPERSEDED", "Refresh token vừa được thay thế"],
            revoked: [401, "UNAUTHORIZED", "Refresh token không hợp lệ"],
            disabled: [403, "ACCOUNT_DISABLED", "Tài khoản bị vô hiệu"],
            locked: [423, "ACCOUNT_LOCKED", "Tài khoản bị khóa"],
            unavailable: [503, "DEPENDENCY_UNAVAILABLE", "Dịch vụ tạm thời không khả dụng"],
            throttled: [429, "TOO_MANY_REQUESTS", "Quá nhiều yêu cầu"],
          };
          const [st, code, message] = errs[f.mode];
          return send(st, { code, message });
        }
        return USERS[name]
          ? send(200, tokens(name))
          : send(401, { code: "BAD_REFRESH", message: "Refresh token không hợp lệ" });
      }
      if (req.method === "POST" && url.pathname === "/api/auth/logout") return send(204);

      // @AuthenticatedOnly: token của tài khoản phải đổi mật khẩu vẫn gọi được.
      if (req.method === "POST" && url.pathname === "/api/auth/password") {
        if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" });
        if (body.currentPassword !== USERS[caller].password) {
          return send(400, { code: "BAD_PASSWORD", message: "Mật khẩu hiện tại không đúng" });
        }
        if (String(body.newPassword ?? "").length < 8) {
          return send(400, { code: "VALIDATION", message: "Mật khẩu mới tối thiểu 8 ký tự" });
        }
        USERS[caller].password = body.newPassword;
        USERS[caller].mustChangePassword = false;
        return send(204);
      }

      // requireKey tự gửi 401 (chưa đăng nhập) hoặc 403 (thiếu khóa) rồi trả false.
      const requireKey = (key) => {
        if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" }), false;
        if (!mayCall(caller, key)) return send(403, { code: "FORBIDDEN", message: `Thiếu quyền: ${key}` }), false;
        return true;
      };
      const ctx = { method: req.method, url, body, caller, send, requireKey, tokens, raw, headers: req.headers, sendFile, sendText };
      for (const m of MODULES) if (m.handle(ctx)) return;
      send(404, { code: "NOT_FOUND", message: "Không có endpoint này trong mock" });
    });
  })
  .listen(PORT, () => console.log(`mock gateway :${PORT}`));
