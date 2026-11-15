import { defineConfig, devices } from "@playwright/test";

/**
 * E2E chạy trên bản BUILD (next start), không phải dev, vì cần kiểm tra proxy giữa các zone.
 * Chạy: `npm run test:e2e` (build rồi test) hoặc `npm run test:e2e:only` khi đã build.
 * BE được thay bằng e2e/mock-gateway.mjs (cổng 8090) nên không cần docker.
 * Cổng 3000-3003, 3100 và 8090 phải trống; không tái sử dụng server đang chạy để tránh gọi nhầm BE thật.
 */
const env = {
  GATEWAY_URL: "http://localhost:8090",
  SHELL_URL: "http://localhost:3000",
  // Máy chạy cùng lúc 6 server + nhiều Chromium có thể làm SSR chậm hơn ngưỡng 10s mặc định của proxy.
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

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // 6 server Node + mỗi worker một Chromium khá nặng; quá nhiều worker làm SSR chậm và test flaky.
  workers: 2,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    server("node e2e/mock-gateway.mjs", 8090, { PORT: "8090" }),
    server("npm run start -w @mfe/catalog", 3001),
    server("npm run start -w @mfe/circulation", 3002),
    server("npm run start -w @mfe/admin", 3003),
    server("npm run start -w @mfe/shell", 3000),
    // Shell thứ hai trỏ catalog vào cổng không có ai nghe, để test "zone chết" mà các zone khác vẫn sống.
    server("npx next start --port 3100", 3100, { CATALOG_URL: "http://localhost:3999" }, "apps/shell"),
  ],
});
