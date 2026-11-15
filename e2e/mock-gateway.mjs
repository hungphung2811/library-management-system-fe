// Mock của nginx + lms-api để chạy E2E mà không cần BE. Chỉ cài đủ các endpoint FE đang gọi.
// Mô phỏng phân quyền động của BE (ADR-0003): khóa quyền là "Controller/method", quản trị viên là claim admin=true,
// token của tài khoản phải đổi mật khẩu không mang admin/permissions.
// Chạy: PORT=8090 node e2e/mock-gateway.mjs
import http from "node:http";

const PORT = Number(process.env.PORT ?? 8090);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

const LIST_ROLES = "AccessControlController/listRoles";

// Trạng thái từng user; mustChangePassword đổi được qua POST /api/auth/password.
const USERS = {
  // Quản trị viên: chỉ có admin=true, KHÔNG có permission nào (bỏ qua kiểm khóa).
  admin: { id: "admin-id", roles: ["SUPER_ADMIN"], permissions: [], admin: true, password: "Admin@12345" },
  // Thủ thư: được gán khóa cụ thể, không phải admin.
  staff: {
    id: "staff-id",
    roles: ["LIBRARIAN"],
    permissions: [LIST_ROLES, "BorrowingController/borrow"],
    password: "Staff@12345",
  },
  member: { id: "member-id", roles: ["MEMBER"], permissions: [], password: "Member@12345" },
  // Hai tài khoản phải đổi mật khẩu (mật khẩu tạm). newbie2 dành cho test thực sự đổi mật khẩu.
  newbie: { id: "newbie-id", roles: ["MEMBER"], permissions: [], mustChangePassword: true, password: "Temp@12345" },
  newbie2: { id: "newbie2-id", roles: ["MEMBER"], permissions: [], mustChangePassword: true, password: "Temp@12345" },
};

function claimsOf(username) {
  const u = USERS[username];
  const must = !!u.mustChangePassword;
  return {
    sub: u.id,
    username,
    roles: u.roles,
    departmentId: "dept-1",
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
      const body = raw ? JSON.parse(raw) : {};
      const caller = userFromToken(req.headers.authorization);

      if (req.method === "POST" && req.url === "/api/auth/login") {
        const u = USERS[body.username];
        if (u && u.password === body.password) return send(200, tokens(body.username));
        return send(401, { code: "BAD_CREDENTIALS", message: "Sai thông tin đăng nhập" });
      }
      if (req.method === "POST" && req.url === "/api/auth/refresh") {
        const name = String(body.refreshToken ?? "").replace(/^rt-/, "");
        return USERS[name]
          ? send(200, tokens(name))
          : send(401, { code: "BAD_REFRESH", message: "Refresh token không hợp lệ" });
      }
      if (req.method === "POST" && req.url === "/api/auth/logout") return send(204);

      // @AuthenticatedOnly: token của tài khoản phải đổi mật khẩu vẫn gọi được.
      if (req.method === "POST" && req.url === "/api/auth/password") {
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

      if (req.method === "GET" && req.url === "/api/roles") {
        if (!caller) return send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" });
        if (!mayCall(caller, LIST_ROLES)) {
          return send(403, { code: "FORBIDDEN", message: `Thiếu quyền: ${LIST_ROLES}` });
        }
        return send(200, [
          { id: "1", name: "SUPER_ADMIN" },
          { id: "2", name: "MEMBER" },
        ]);
      }
      send(404, { code: "NOT_FOUND", message: "Không có endpoint này trong mock" });
    });
  })
  .listen(PORT, () => console.log(`mock gateway :${PORT}`));
