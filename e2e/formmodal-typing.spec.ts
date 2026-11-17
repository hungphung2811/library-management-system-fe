import { expect, test, type Page } from "@playwright/test";
import { gotoAs } from "./helpers";

// FormModal "gõ ngay khi mở": bấm nút mở rồi gõ liền, KHÔNG chờ hộp thoại ổn định. Từng thấy trên BE thật mất vài ký tự đầu
// vì ô chưa được focus. FormModal phải focus ô đầu ngay khi ô xuất hiện và không reset form đè lên chữ đang gõ.

const TEXT = "abcdefghij";
const SEED_USER = "a0000000-0000-4000-8000-000000000001";

async function typeRightAway(page: Page) {
  await page.keyboard.type(TEXT, { delay: 10 });
  await page.waitForTimeout(1000);
}

test.describe("FormModal: gõ ngay khi mở không mất chữ", () => {
  test("/admin/users: Thêm người dùng, gõ ngay vào ô Tên đăng nhập", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    await typeRightAway(page);
    await expect(page.getByRole("dialog").getByLabel("Tên đăng nhập")).toHaveValue(TEXT);
  });

  test("/admin/roles: Thêm vai trò, gõ ngay vào ô Tên vai trò", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    await typeRightAway(page);
    await expect(page.getByRole("dialog").getByLabel("Tên vai trò")).toHaveValue(TEXT);
  });

  test("chi tiết sách: Thêm bản sao, gõ ngay vào ô Mã vạch", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog?q=" + encodeURIComponent("Cấu trúc dữ liệu và giải thuật"));
    await page.getByRole("table").getByRole("link", { name: "Cấu trúc dữ liệu và giải thuật" }).first().click();
    await expect(page).toHaveURL(/\/catalog\/books\/[^/]+$/);
    await page.getByRole("button", { name: /Thêm bản sao/ }).click();
    await typeRightAway(page);
    await expect(page.getByRole("dialog").getByLabel("Mã vạch")).toHaveValue(TEXT);
  });

  test("Sửa người dùng: ô có sẵn giá trị gốc; gõ dở rồi Hủy, mở lại về giá trị gốc", async ({ page }) => {
    await gotoAs(page, "admin", `/admin/users/${SEED_USER}`);
    await page.getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin người dùng" });
    await expect(dlg.getByLabel("Họ tên")).toHaveValue("Lê Văn Hùng");
    await page.waitForTimeout(500);
    await expect(dlg.getByLabel("Họ tên")).toHaveValue("Lê Văn Hùng");
    await dlg.getByLabel("Họ tên").fill("Tên gõ dở");
    await dlg.getByRole("button", { name: "Hủy" }).click();
    await expect(dlg).toBeHidden();
    await page.getByRole("button", { name: "Sửa" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("dialog").getByLabel("Họ tên")).toHaveValue("Lê Văn Hùng");
    await expect(page.getByRole("dialog").getByLabel("Email")).toHaveValue("hung.le@gmail.com");
  });
});
