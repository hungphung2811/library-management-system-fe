import { expect, test } from "@playwright/test";
import { USERS, loginAs, openLogin } from "./helpers";

// Tài khoản mustChangePassword: token không mang admin/permissions, FE phải buộc đổi mật khẩu trước.
test.describe("buộc đổi mật khẩu", () => {
  test("đăng nhập bằng form với mật khẩu tạm thì sang trang đổi mật khẩu", async ({ page }) => {
    await openLogin(page);
    await page.getByPlaceholder("Tên đăng nhập").fill(USERS.newbie.username);
    await page.getByPlaceholder("Mật khẩu").fill(USERS.newbie.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/change-password$/);
  });

  test("vào zone khi chưa đổi mật khẩu thì bị chuyển sang trang đổi mật khẩu", async ({ page }) => {
    await loginAs(page, "newbie");
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/change-password$/);
  });

  test("zone gọi thẳng cổng của nó cũng chuyển sang trang đổi mật khẩu của shell", async ({ page }) => {
    await loginAs(page, "newbie");
    await page.goto("http://localhost:3003/admin");

    await expect(page).toHaveURL("http://localhost:3000/change-password");
  });

  test("sai mật khẩu hiện tại thì hiện lỗi từ BE và vẫn ở trang đổi mật khẩu", async ({ page }) => {
    await loginAs(page, "newbie");
    await page.goto("/change-password");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Mật khẩu hiện tại").fill("sai-mat-khau");
    await page.getByPlaceholder("Mật khẩu mới", { exact: true }).fill("NewPass@12345");
    await page.getByPlaceholder("Nhập lại mật khẩu mới").fill("NewPass@12345");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();

    await expect(page.locator(".ant-alert-error")).toContainText("Mật khẩu hiện tại không đúng");
    await expect(page).toHaveURL(/\/change-password$/);
  });

  test("nhập lại mật khẩu mới không khớp thì báo lỗi ngay, không gọi BE", async ({ page }) => {
    await loginAs(page, "newbie");
    await page.goto("/change-password");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Mật khẩu hiện tại").fill(USERS.newbie.password);
    await page.getByPlaceholder("Mật khẩu mới", { exact: true }).fill("NewPass@12345");
    await page.getByPlaceholder("Nhập lại mật khẩu mới").fill("KhacHan@12345");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();

    await expect(page.getByText("Mật khẩu nhập lại không khớp")).toBeVisible();
  });

  test("đổi mật khẩu thành công thì phải đăng nhập lại, sau đó dùng được bình thường", async ({ page }) => {
    await loginAs(page, "newbie2");
    await page.goto("/change-password");
    await page.waitForLoadState("networkidle");
    await page.getByPlaceholder("Mật khẩu hiện tại").fill(USERS.newbie2.password);
    await page.getByPlaceholder("Mật khẩu mới", { exact: true }).fill("NewPass@12345");
    await page.getByPlaceholder("Nhập lại mật khẩu mới").fill("NewPass@12345");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page).toHaveURL(/\/login/);

    await openLogin(page);
    await page.getByPlaceholder("Tên đăng nhập").fill("newbie2");
    await page.getByPlaceholder("Mật khẩu").fill("NewPass@12345");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL("http://localhost:3000/");
    await page.goto("/circulation");
    await expect(page.getByRole("heading", { name: "Mượn trả sách" })).toBeVisible();
  });

  test("chưa đăng nhập thì không vào được trang đổi mật khẩu", async ({ page }) => {
    await page.goto("/change-password");
    await expect(page).toHaveURL(/\/login\?next=%2Fchange-password$/);
  });
});
