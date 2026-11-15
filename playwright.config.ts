import { defineConfig, devices } from "@playwright/test";
import { PORTS, url } from "./e2e/ports";

/**
 * E2E chạy trên bản BUILD (next start), không phải dev, vì cần kiểm tra proxy giữa các zone.
 * Chạy: `npm run test:e2e` (build rồi test) hoặc `npm run test:e2e:only` khi đã build.
 * BE được thay bằng e2e/mock-gateway.mjs nên không cần docker.
 * Cổng mặc định 3000, 3003, 3100 và 8090 phải trống; không tái sử dụng server đang chạy để tránh gọi nhầm BE thật.
 * Dev server đang chiếm cổng đó thì đặt E2E_PORT_BASE=4000 (xem e2e/ports.ts).
 */
const env = {
  GATEWAY_URL: url(PORTS.gateway),
  SHELL_URL: url(PORTS.shell),
  ADMIN_URL: url(PORTS.admin),
  // Máy chạy cùng lúc 4 server + nhiều Chromium có thể làm SSR chậm hơn ngưỡng 10s mặc định của proxy.
  ZONE_TIMEOUT_MS: "30000",
};

const server = (command: string, port: number, extraEnv: Record<string, string> = {}, cwd?: string) => ({
  command,
  port,
  cwd,
  env: { ...env, ...extraEnv },
  reuseExistingServer: false,
  timeout: 120_000,
});

const start = (app: string, port: number, extraEnv: Record<string, string> = {}) =>
  server(`npx next start --port ${port}`, port, extraEnv, `apps/${app}`);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // 4 server Node + mỗi worker một Chromium khá nặng; quá nhiều worker làm SSR chậm và test flaky.
  workers: 2,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: url(PORTS.shell),
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    server("node e2e/mock-gateway.mjs", PORTS.gateway, { PORT: String(PORTS.gateway) }),
    start("admin", PORTS.admin),
    start("shell", PORTS.shell),
    // Shell thứ hai trỏ admin vào cổng không có ai nghe, để test "zone chết" mà các zone khác vẫn sống.
    start("shell", PORTS.shellDown, { ADMIN_URL: url(PORTS.dead) }),
  ],

});
