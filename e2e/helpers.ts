import { expect, type Page } from "@playwright/test";

export const SHELL = "http://localhost:3000";
/** Shell thứ hai có zone catalog trỏ vào cổng chết. */
export const SHELL_CATALOG_DOWN = "http://localhost:3100";

export const USERS = {
  admin: { username: "admin", password: "Admin@12345" },
  member: { username: "member", password: "Member@12345" },
} as const;

/**
 * Mở trang login và đợi hydrate xong. Nếu bấm nút khi React chưa hydrate thì form gửi kiểu HTML thuần
 * (test sẽ flaky khi máy tải nặng); networkidle nghĩa là các chunk JS đã tải xong.
 */
export async function openLogin(page: Page, query = "") {
  await page.goto(`/login${query}`);
  await page.waitForLoadState("networkidle");
}

/** Đăng nhập bằng API (nhanh, không qua form) rồi cookie nằm sẵn trong context của page. */
export async function loginAs(page: Page, user: keyof typeof USERS, shell = SHELL) {
  const res = await page.request.post(`${shell}/api/session/login`, { data: USERS[user] });
  expect(res.ok(), `đăng nhập ${user} qua ${shell}`).toBeTruthy();
}
