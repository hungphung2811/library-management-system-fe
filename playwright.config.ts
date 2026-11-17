import { defineConfig, devices } from "@playwright/test";
import { PORTS, url } from "./e2e/ports";

/**
 * E2E chạy trên bản BUILD tĩnh của apps/web (`vite preview` phục vụ apps/web/dist), BE được thay bằng e2e/mock-gateway.mjs.
 * `vite preview` proxy /api -> mock gateway qua VITE_API_TARGET (xem apps/web/vite.config.ts), nên trình duyệt chỉ gọi cùng origin
 * giống production. Không cần docker, không cần BE.
 * Chạy: `npm run test:e2e` (build web rồi test) hoặc `npm run test:e2e:only` khi đã build; một file: `npx playwright test e2e/auth.spec.ts`.
 * Cổng mặc định 4200-4201 phải trống (không tái sử dụng server đang chạy, tránh gọi nhầm BE thật);
 * đổi bằng E2E_PORT_BASE (xem e2e/ports.ts). Sửa code apps/web thì phải build lại (`npm run build -w @lms/web`).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: `playwright-report/${PORTS.web}` }]],
  // Mỗi bộ cổng một thư mục kết quả, để chạy song song không xóa trace của nhau.
  outputDir: `test-results/${PORTS.web}`,
  use: {
    baseURL: url(PORTS.web),
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mock-gateway.mjs",
      url: `${url(PORTS.gateway)}/__health`,
      env: { PORT: String(PORTS.gateway) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run preview -w @lms/web -- --port ${PORTS.web} --strictPort`,
      url: url(PORTS.web),
      env: { VITE_API_TARGET: url(PORTS.gateway) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
