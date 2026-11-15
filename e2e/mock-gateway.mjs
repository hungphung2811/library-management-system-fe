// Mock của nginx + lms-api để chạy E2E mà không cần BE. Chỉ cài đủ các endpoint FE đang gọi.
// Mô phỏng phân quyền động của BE (ADR-0003): khóa quyền là "Controller/method", quản trị viên là claim admin=true,
// token của tài khoản phải đổi mật khẩu không mang admin/permissions.
// File này giữ server, JWT và login/refresh/logout/password; endpoint nghiệp vụ nằm ở e2e/mock/*.mjs
// (hợp đồng mỗi module: `export function handle(ctx): boolean`, xem mock/common.mjs).
// Chạy: PORT=8090 node e2e/mock-gateway.mjs
import http from "node:http";
import { USERS } from "./mock/data.mjs";
import * as common from "./mock/common.mjs";
import * as shell from "./mock/shell.mjs";
import * as catalog from "./mock/catalog.mjs";
import * as circulation from "./mock/circulation.mjs";
import * as admin from "./mock/admin.mjs";

const PORT = Number(process.env.PORT ?? 8090);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

// Thứ tự dispatch: common -> shell -> catalog -> circulation -> admin (nên /api/users/me rơi vào shell trước admin).
const MODULES = [common, shell, catalog, circulation, admin];

function claimsOf(username) {
  const u = USERS[username];
  const must = !!u.mustChangePassword;
  return {
    sub: u.id,
    username,
    roles: u.roles,
    departmentId: "dept-1",
    tenantId: u.tenantId,
    // Token của tài khoản phải đổi mật khẩu không mang admin/permissions.
    permissions: must ? [] : u.permissions,
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
        res.end(body === undefined ? "" : JSON.stringify(body));
      };
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return send(400, { code: "BAD_JSON", message: "Body không phải JSON" });
      }
      const caller = userFromToken(req.headers.authorization);
      const url = new URL(req.url, "http://mock");

      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        const u = USERS[body.username];
        if (u && u.password === body.password) return send(200, tokens(body.username));
        return send(401, { code: "BAD_CREDENTIALS", message: "Sai thông tin đăng nhập" });
      }
      if (req.method === "POST" && url.pathname === "/api/auth/refresh") {
        const name = String(body.refreshToken ?? "").replace(/^rt-/, "");
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
      const ctx = { method: req.method, url, body, caller, send, requireKey, tokens };
      for (const m of MODULES) if (m.handle(ctx)) return;
      send(404, { code: "NOT_FOUND", message: "Không có endpoint này trong mock" });
    });
  })
  .listen(PORT, () => console.log(`mock gateway :${PORT}`));
