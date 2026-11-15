import { expect, test } from "@playwright/test";
import { USERS, loginAs, openLogin } from "./helpers";

test.describe("đăng nhập và đăng xuất", () => {
  test("chưa đăng nhập vào zone thì bị chuyển về /login kèm đường dẫn quay lại", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test("sai mật khẩu hiện thông báo lỗi và vẫn ở trang login", async ({ page }) => {
    await openLogin(page);
    await page.getByPlaceholder("Tên đăng nhập").fill(USERS.admin.username);
    await page.getByPlaceholder("Mật khẩu").fill("sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    // Không dùng getByRole("alert") trần: Next cũng có phần tử role=alert (route announcer).
    await expect(page.locator(".ant-alert-error")).toContainText("Sai thông tin đăng nhập");
    await expect(page).toHaveURL(/\/login/);
  });

  test("đăng nhập đúng thì quay lại trang đang định vào", async ({ page }) => {
    await openLogin(page, "?next=/admin");
    await page.getByPlaceholder("Tên đăng nhập").fill(USERS.admin.username);
    await page.getByPlaceholder("Mật khẩu").fill(USERS.admin.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Quản trị" })).toBeVisible();
  });

  test("đường dẫn next ngoài site bị bỏ qua (chống open redirect)", async ({ page }) => {
    await openLogin(page, "?next=//evil.example.com");
    await page.getByPlaceholder("Tên đăng nhập").fill(USERS.admin.username);
    await page.getByPlaceholder("Mật khẩu").fill(USERS.admin.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("đăng xuất xoá phiên: vào lại zone phải đăng nhập", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/");
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test("access token hết hạn nhưng còn refresh token thì tự làm mới", async ({ page }) => {
    await loginAs(page, "admin");
    await page.context().clearCookies({ name: "lms_at" });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Quản trị" })).toBeVisible();
  });
});
