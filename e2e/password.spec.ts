import { expect, test, type Page } from "@playwright/test";
import { USERS, WEB, loginAs, openLogin, submitLogin } from "./helpers";

/** Mở /change-password (ngoài khung ứng dụng) và đợi form sẵn sàng. */
async function openChangePassword(page: Page) {
  await page.goto("/change-password");
  await page.waitForLoadState("networkidle");
  await expect(page.getByPlaceholder("Mật khẩu hiện tại")).toBeVisible();
}

async function fillPasswords(page: Page, current: string, next: string, confirm: string) {
  await page.getByPlaceholder("Mật khẩu hiện tại").fill(current);
  await page.getByPlaceholder("Mật khẩu mới", { exact: true }).fill(next);
  await page.getByPlaceholder("Nhập lại mật khẩu mới").fill(confirm);
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
}

// Tài khoản mustChangePassword: token không mang admin/permissions, FE phải buộc đổi mật khẩu trước.
test.describe("buộc đổi mật khẩu", () => {
  test("đăng nhập bằng form với mật khẩu tạm thì sang trang đổi mật khẩu", async ({ page }) => {
    await openLogin(page);
    await submitLogin(page, USERS.newbie.username, USERS.newbie.password);

    await expect(page).toHaveURL(/\/change-password$/);
  });

  test("vào trang bảo vệ khi chưa đổi mật khẩu thì bị chuyển sang trang đổi mật khẩu", async ({ page }) => {
    await loginAs(page, "newbie");
    for (const path of ["/admin", "/circulation", "/"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/change-password$/);
    }
  });

  test("sai mật khẩu hiện tại thì hiện lỗi từ BE và vẫn ở trang đổi mật khẩu", async ({ page }) => {
    await loginAs(page, "newbie");
    await openChangePassword(page);
    await fillPasswords(page, "sai-mat-khau", "NewPass@12345", "NewPass@12345");

    await expect(page.locator(".ant-alert-error")).toContainText("Mật khẩu hiện tại không đúng");
    await expect(page).toHaveURL(/\/change-password$/);
  });

  test("nhập lại mật khẩu mới không khớp thì báo lỗi ngay, không gọi BE", async ({ page }) => {
    await loginAs(page, "newbie");
    await openChangePassword(page);
    let calls = 0;
    page.on("request", (r) => r.url().endsWith("/api/auth/password") && calls++);
    await fillPasswords(page, USERS.newbie.password, "NewPass@12345", "KhacHan@12345");

    await expect(page.getByText("Mật khẩu nhập lại không khớp")).toBeVisible();
    expect(calls).toBe(0);
  });

  test("mật khẩu mới ngắn hơn 8 ký tự bị chặn ở form", async ({ page }) => {
    await loginAs(page, "newbie");
    await openChangePassword(page);
    await fillPasswords(page, USERS.newbie.password, "Ab@1", "Ab@1");
    await expect(page.getByText("Mật khẩu mới tối thiểu 8 ký tự")).toBeVisible();
  });

  test("đổi mật khẩu thành công thì phải đăng nhập lại, sau đó dùng được bình thường", async ({ page }) => {
    await loginAs(page, "newbie2");
    await openChangePassword(page);
    await fillPasswords(page, USERS.newbie2.password, "NewPass@12345", "NewPass@12345");
    await expect(page).toHaveURL(/\/login\?changed=1$/);
    await expect(page.getByText("Đổi mật khẩu thành công, vui lòng đăng nhập lại.")).toBeVisible();

    await submitLogin(page, "newbie2", "NewPass@12345");
    await expect(page).toHaveURL(`${WEB}/`);
    await page.goto("/circulation");
    await expect(page).toHaveURL(/\/circulation$/); // đã có phiên đầy đủ nên không bị đẩy về /change-password
  });

  test("chưa đăng nhập thì không vào được trang đổi mật khẩu", async ({ page }) => {
    await page.goto("/change-password");
    await expect(page).toHaveURL(/\/login\?next=%2Fchange-password$/);
  });

  test("người đã đổi mật khẩu vào /change-password từ menu vẫn có form (không ép mustChange)", async ({ page }) => {
    await loginAs(page, "member");
    await openChangePassword(page);
    await expect(page).toHaveURL(/\/change-password$/);
  });
});
