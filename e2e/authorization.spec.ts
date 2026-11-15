import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// Phân quyền động của BE (ADR-0003): quản trị viên là claim admin=true (bỏ qua kiểm khóa),
// người khác cần khóa "Controller/method" trong claim permissions.
test.describe("phân quyền theo BE động", () => {
  test("quản trị viên (admin=true, không có permission nào) vẫn thấy danh sách role", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");

    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "MEMBER" })).toBeVisible();
  });

  test("người có khóa AccessControlController/listRoles thấy danh sách role", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/admin");

    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
  });

  test("người không có khóa thấy cảnh báo, không có danh sách và không có link Quản trị", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/admin");

    await expect(page.getByText("Cần quyền AccessControlController/listRoles")).toBeVisible();
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toHaveCount(0);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Quản trị" })).toHaveCount(0);
  });

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

  test("trang mượn trả: member không quyền nào, staff chỉ được mượn, admin được cả hai", async ({ page, browser }) => {
    const expectations = [
      ["member", 0, 2],
      ["staff", 1, 1], // có BorrowingController/borrow, không có returnCopy
      ["admin", 2, 0], // admin bỏ qua kiểm khóa
    ] as const;
    for (const [user, allowed, denied] of expectations) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await loginAs(p, user);
      await p.goto("/circulation");
      await expect(p.getByText("Được phép"), `${user}: được phép`).toHaveCount(allowed);
      await expect(p.getByText("Không có quyền"), `${user}: không có quyền`).toHaveCount(denied);
      await ctx.close();
    }
  });

  test("thanh điều hướng hiển thị username thay vì id người dùng", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/");
    await expect(page.getByRole("navigation").getByText("staff", { exact: true })).toBeVisible();
  });
});
