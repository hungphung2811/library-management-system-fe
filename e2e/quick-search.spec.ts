import { expect, test, type Page } from "@playwright/test";
import { gotoAs } from "./helpers";

// Ô tìm nhanh ở header (Ctrl+K): khớp nhãn tiếng Việt (bỏ dấu) và từ khóa tiếng Anh/đồng nghĩa, chỉ trong các trang người dùng thấy.

const dialog = (page: Page) => page.getByRole("dialog", { name: "Tìm nhanh trang" });
const results = (page: Page) => dialog(page).getByRole("button");

async function openSearch(page: Page) {
  await page.getByRole("button", { name: "Tìm nhanh trang" }).click();
  await expect(dialog(page)).toBeVisible();
}

test.describe("ô tìm nhanh: đa ngôn ngữ", () => {
  test("gõ tiếng Anh 'users' ra mục Người dùng", async ({ page }) => {
    await gotoAs(page, "admin", "/");
    await openSearch(page);
    await dialog(page).getByRole("textbox").fill("users");
    await expect(results(page).first()).toContainText("Người dùng");
  });

  test("tiếng Việt có dấu và không dấu cùng ra kết quả", async ({ page }) => {
    await gotoAs(page, "admin", "/");
    await openSearch(page);
    const box = dialog(page).getByRole("textbox");
    await box.fill("người dùng");
    await expect(results(page).first()).toContainText("Người dùng");
    await box.fill("nguoi dung");
    await expect(results(page).first()).toContainText("Người dùng");
  });

  test("từ đồng nghĩa: 'account' ra Người dùng, 'permissions' ra Vai trò và quyền, 'fines' ra Phạt", async ({ page }) => {
    await gotoAs(page, "admin", "/");
    await openSearch(page);
    const box = dialog(page).getByRole("textbox");
    for (const [q, label] of [["account", "Người dùng"], ["permissions", "Vai trò và quyền"], ["fines", "Phạt"]] as const) {
      await box.fill(q);
      await expect(results(page).filter({ hasText: label }).first()).toBeVisible();
    }
  });

  test("nhiều từ không cần đúng thứ tự; nhãn khớp xếp trước từ khóa", async ({ page }) => {
    await gotoAs(page, "admin", "/");
    await openSearch(page);
    const box = dialog(page).getByRole("textbox");
    await box.fill("log audit");
    await expect(results(page).filter({ hasText: "Nhật ký hoạt động" }).first()).toBeVisible();
    await box.fill("phat");
    await expect(results(page).first()).toContainText("Phạt");
  });

  test("không có kết quả thì báo; chọn kết quả thì điều hướng đúng trang", async ({ page }) => {
    await gotoAs(page, "admin", "/");
    await openSearch(page);
    const box = dialog(page).getByRole("textbox");
    await box.fill("zzzkhongco");
    await expect(dialog(page).getByText("Không có trang nào khớp.")).toBeVisible();
    await box.fill("roles");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/admin\/roles/);
  });

  test("chỉ tìm trong các trang được thấy: độc giả gõ 'users' không ra Người dùng", async ({ page }) => {
    await gotoAs(page, "reader", "/");
    await openSearch(page);
    await dialog(page).getByRole("textbox").fill("users");
    await expect(dialog(page).getByText("Không có trang nào khớp.")).toBeVisible();
  });
});
