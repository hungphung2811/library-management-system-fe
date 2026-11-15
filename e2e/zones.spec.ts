import { expect, test } from "@playwright/test";
import { ADMIN_DIRECT, SHELL, SHELL_ZONE_DOWN, loginAs } from "./helpers";

test.describe("độc lập giữa các zone", () => {
  test("zone gọi thẳng cổng của nó mà chưa đăng nhập thì chuyển về login của shell", async ({ page }) => {
    await page.goto(`${ADMIN_DIRECT}/admin`);
    await expect(page).toHaveURL(`${SHELL}/login?next=%2Fadmin`);
  });

  test("mỗi zone phục vụ được qua shell với asset tải thành công", async ({ page }) => {
    await loginAs(page, "admin");
    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("-static/") && !r.ok()) failed.push(`${r.status()} ${r.url()}`);
    });

    // Không kiểm tiêu đề cố định: zone đổi giao diện không làm hỏng test hạ tầng. Chỉ kiểm 200, có <main> và asset không lỗi.
    for (const path of ["/catalog", "/circulation", "/admin"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator("main"), path).toBeVisible();
    }
    expect(failed).toEqual([]);
  });

  test("một zone chết chỉ làm trang của nó trả 503, các phần khác vẫn chạy", async ({ page }) => {
    await loginAs(page, "admin", SHELL_ZONE_DOWN);

    const down = await page.goto(`${SHELL_ZONE_DOWN}/circulation`);
    expect(down?.status()).toBe(503);
    await expect(page.getByRole("heading", { name: /circulation.*không khả dụng/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Về trang chủ/ })).toBeVisible();

    const ok = await page.goto(`${SHELL_ZONE_DOWN}/catalog`);
    expect(ok?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();

    const home = await page.goto(`${SHELL_ZONE_DOWN}/`);
    expect(home?.status()).toBe(200);
  });
});
