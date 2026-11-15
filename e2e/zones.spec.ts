import { expect, test } from "@playwright/test";
import { SHELL_CATALOG_DOWN, loginAs } from "./helpers";

test.describe("độc lập giữa các zone", () => {
  test("zone gọi thẳng cổng của nó mà chưa đăng nhập thì chuyển về login của shell", async ({ page }) => {
    await page.goto("http://localhost:3003/admin");
    await expect(page).toHaveURL("http://localhost:3000/login?next=%2Fadmin");
  });

  test("mỗi zone phục vụ được qua shell với asset tải thành công", async ({ page }) => {
    await loginAs(page, "admin");
    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("-static/") && !r.ok()) failed.push(`${r.status()} ${r.url()}`);
    });

    for (const [path, heading] of [
      ["/catalog", "Danh mục sách"],
      ["/circulation", "Mượn trả sách"],
      ["/admin", "Quản trị"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    expect(failed).toEqual([]);
  });

  test("một zone chết chỉ làm trang của nó trả 503, các phần khác vẫn chạy", async ({ page }) => {
    await loginAs(page, "admin", SHELL_CATALOG_DOWN);

    const down = await page.goto(`${SHELL_CATALOG_DOWN}/catalog`);
    expect(down?.status()).toBe(503);
    await expect(page.getByRole("heading", { name: /catalog.*không khả dụng/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Về trang chủ/ })).toBeVisible();

    const ok = await page.goto(`${SHELL_CATALOG_DOWN}/circulation`);
    expect(ok?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Mượn trả sách" })).toBeVisible();

    const home = await page.goto(`${SHELL_CATALOG_DOWN}/`);
    expect(home?.status()).toBe(200);
  });
});
