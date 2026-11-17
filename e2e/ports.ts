/**
 * Cổng của bộ server E2E (2 server: mock gateway và app web phục vụ bản build qua `vite preview`).
 * Nền mặc định 4200, tránh 3000/3003/3100 (dev server) và 8085-8090 (BE thật, mock cũ). Mỗi bộ chiếm base và base + 1.
 * Chạy song song nhiều bộ test thì mỗi bộ một E2E_PORT_BASE khác nhau, cách nhau từ 2 trở lên (ví dụ 4200, 4300, 4400, 4500).
 */
const base = Number(process.env.E2E_PORT_BASE ?? 4200);

export const PORTS = {
  /** App web (vite preview) = baseURL của test. */
  web: base,
  /** Mock gateway (thay lms-api); vite preview proxy /api về đây. */
  gateway: base + 1,
};

export const url = (port: number) => `http://localhost:${port}`;
