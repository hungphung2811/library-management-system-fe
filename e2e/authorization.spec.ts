import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// Lưu ý: các test này dùng mã quyền cũ (ROLE_VIEW, BORROW_BOOK) đúng như code FE hiện tại.
// Khi FE chuyển sang khóa quyền động + claim admin của BE (ADR-0003) thì cập nhật mock và test cùng lúc.
test.describe("phân quyền theo claim permissions", () => {
  test("người có ROLE_VIEW thấy danh sách role lấy từ gateway", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");

    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "MEMBER" })).toBeVisible();
  });

  test("người không có ROLE_VIEW thấy cảnh báo và không có link Quản trị", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/admin");

    await expect(page.getByText("Cần quyền ROLE_VIEW")).toBeVisible();
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toHaveCount(0);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Quản trị" })).toHaveCount(0);
  });

  test("admin thấy link Quản trị trên thanh điều hướng, member thì không", async ({ page, browser }) => {
    await loginAs(page, "admin");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Quản trị" }).first()).toBeVisible();

    const memberCtx = await browser.newContext();
    const memberPage = await memberCtx.newPage();
    await loginAs(memberPage, "member");
    await memberPage.goto("/");
    await expect(memberPage.getByRole("navigation").getByRole("link", { name: "Quản trị" })).toHaveCount(0);
    await memberCtx.close();
  });

  test("trang mượn trả hiển thị đúng quyền của người dùng", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/circulation");
    await expect(page.getByText("Không có quyền")).toHaveCount(2);

    await loginAs(page, "admin");
    await page.goto("/circulation");
    await expect(page.getByText("Được phép")).toHaveCount(1); // chỉ BORROW_BOOK
    await expect(page.getByText("Không có quyền")).toHaveCount(1); // RETURN_BOOK
  });
});
