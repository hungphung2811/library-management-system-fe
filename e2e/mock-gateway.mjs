// Mock của API Gateway/nginx để chạy E2E mà không cần BE. Chỉ cài đủ các endpoint FE đang gọi.
// Chạy: PORT=8090 node e2e/mock-gateway.mjs
import http from "node:http";

const PORT = Number(process.env.PORT ?? 8090);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

// Mỗi user có JWT khác nhau để test phân quyền.
const USERS = {
  admin: { sub: "admin-id", roles: ["SUPER_ADMIN"], permissions: ["ROLE_VIEW", "BORROW_BOOK"] },
  member: { sub: "member-id", roles: ["MEMBER"], permissions: [] },
};
const PASSWORDS = { admin: "Admin@12345", member: "Member@12345" };

const jwtFor = (u) => `${b64({ alg: "none" })}.${b64(USERS[u])}.sig`;
const userFromToken = (header = "") =>
  Object.keys(USERS).find((u) => header === `Bearer ${jwtFor(u)}`);
const tokens = (u) => ({
  accessToken: jwtFor(u),
  refreshToken: `rt-${u}`,
  tokenType: "Bearer",
  expiresIn: 900,
  mustChangePassword: false,
});

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

      if (req.method === "POST" && req.url === "/api/auth/login") {
        if (PASSWORDS[body.username] && PASSWORDS[body.username] === body.password) {
          return send(200, tokens(body.username));
        }
        return send(401, { code: "BAD_CREDENTIALS", message: "Sai thông tin đăng nhập" });
      }
      if (req.method === "POST" && req.url === "/api/auth/refresh") {
        const u = String(body.refreshToken ?? "").replace(/^rt-/, "");
        return USERS[u]
          ? send(200, tokens(u))
          : send(401, { code: "BAD_REFRESH", message: "Refresh token không hợp lệ" });
      }
      if (req.method === "POST" && req.url === "/api/auth/logout") return send(204);

      if (req.method === "GET" && req.url === "/api/roles") {
        return userFromToken(req.headers.authorization)
          ? send(200, [
              { id: "1", name: "SUPER_ADMIN" },
              { id: "2", name: "MEMBER" },
            ])
          : send(401, { code: "UNAUTHENTICATED", message: "Chưa đăng nhập" });
      }
      send(404, { code: "NOT_FOUND", message: "Không có endpoint này trong mock" });
    });
  })
  .listen(PORT, () => console.log(`mock gateway :${PORT}`));
