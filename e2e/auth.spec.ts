import { expect, test } from "@playwright/test";
import { USERS, WEB, REFRESH_KEY, gotoApp, hasRefreshToken, loginAs, logoutViaMenu, openLogin, submitLogin } from "./helpers";

test.describe("đăng nhập và đăng xuất", () => {
  test("chưa đăng nhập vào trang bảo vệ thì bị chuyển về /login kèm đường dẫn quay lại", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test("đường dẫn quay lại giữ cả query string", async ({ page }) => {
    await page.goto("/catalog?keyword=java");
    await expect(page).toHaveURL(/\/login\?next=%2Fcatalog%3Fkeyword%3Djava$/);
  });

  test("sai mật khẩu hiện thông báo lỗi của BE và vẫn ở trang login", async ({ page }) => {
    await openLogin(page);
    await submitLogin(page, USERS.admin.username, "sai-mat-khau");

    await expect(page.locator(".ant-alert-error")).toContainText("Sai thông tin đăng nhập");
    await expect(page).toHaveURL(/\/login/);
    expect(await hasRefreshToken(page)).toBe(false);
  });

  test("để trống thì báo lỗi ngay trên form, không gọi BE", async ({ page }) => {
    await openLogin(page);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByText("Nhập tên đăng nhập")).toBeVisible();
    await expect(page.getByText("Nhập mật khẩu").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("đăng nhập đúng thì quay lại trang đang định vào và lưu refresh token", async ({ page }) => {
    await openLogin(page, "?next=/admin");
    await submitLogin(page, USERS.admin.username, USERS.admin.password);

    // Khớp URL đầy đủ: /\/admin$/ khớp cả "/login?next=/admin" (URL ban đầu) nên test đọc localStorage trước khi login xong.
    await expect(page).toHaveURL(`${WEB}/admin`);
    await expect(page.getByRole("main")).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), REFRESH_KEY)).toBe("rt-admin");
  });

  test("đường dẫn next ngoài site bị bỏ qua (chống open redirect)", async ({ page }) => {
    await openLogin(page, "?next=//evil.example.com");
    await submitLogin(page, USERS.admin.username, USERS.admin.password);

    await expect(page).toHaveURL(`${WEB}/`);
  });

  test("mở /login khi đã đăng nhập thì vào thẳng trang định tới", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/login?next=/catalog");
    await expect(page).toHaveURL(`${WEB}/catalog`); // khớp đầy đủ: /\/catalog$/ khớp cả "/login?next=/catalog"
  });

  test("đăng xuất từ menu người dùng xoá phiên: vào lại trang bảo vệ phải đăng nhập", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/");
    await logoutViaMenu(page);
    await expect(page).toHaveURL(/\/login$/);
    expect(await hasRefreshToken(page)).toBe(false);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test("tải lại trang (mất access token trong bộ nhớ) vẫn giữ phiên nhờ refresh token", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/admin");
    await page.reload();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("refresh token bị BE từ chối thì xoá phiên và về /login", async ({ page }) => {
    await loginAs(page, "admin");
    await page.evaluate((k) => localStorage.setItem(k, "rt-khong-ton-tai"), REFRESH_KEY);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    expect(await hasRefreshToken(page)).toBe(false);
  });

  test("access token hết hạn giữa phiên (API trả 401) thì tự làm mới rồi gọi lại", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/");
    let first = true;
    let refreshes = 0;
    page.on("request", (r) => r.url().endsWith("/api/auth/refresh") && refreshes++);
    // Lần gọi /api/me/tenants đầu tiên bị giả lập 401 (token hết hạn), lần sau đi qua mock thật.
    await page.route("**/api/me/tenants", async (route) => {
      if (first) {
        first = false;
        return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHENTICATED", message: "Hết hạn" }) });
      }
      return route.continue();
    });
    await page.goto("/profile"); // tải lại: boot refresh (1), /api/me/tenants 401 -> refresh (2) -> gọi lại
    await expect(page.getByRole("heading", { name: "Hồ sơ của tôi" })).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    expect(refreshes).toBeGreaterThanOrEqual(2);
  });
});
