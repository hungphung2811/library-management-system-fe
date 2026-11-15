import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// Chỉ còn test thanh điều hướng (người làm shell sở hữu). Test nội dung trang /admin và /circulation
// đã chuyển sang admin.spec.ts và circulation.spec.ts.
test.describe("phân quyền: thanh điều hướng", () => {
  test("link Quản trị hiện với admin và người có khóa, ẩn với người không có", async ({ page, browser }) => {
    for (const [user, visible] of [["admin", 1], ["staff", 1], ["member", 0]] as const) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await loginAs(p, user);
      await p.goto("/");
      await expect(p.getByRole("navigation").getByRole("link", { name: "Quản trị" }), `user ${user}`).toHaveCount(visible);
      await ctx.close();
    }
  });

  test("link Mượn trả hiện khi có ít nhất một khóa nghiệp vụ (any-of), ẩn với member", async ({ browser }) => {
    for (const [user, visible] of [["admin", 1], ["staff", 1], ["reader", 1], ["member", 0]] as const) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await loginAs(p, user);
      await p.goto("/");
      await expect(p.getByRole("navigation").getByRole("link", { name: "Mượn trả" }), `user ${user}`).toHaveCount(visible);
      await ctx.close();
    }
  });

  test("thanh điều hướng hiển thị username thay vì id người dùng", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/");
    await expect(page.getByRole("navigation").getByText("staff", { exact: true })).toBeVisible();
  });
});
