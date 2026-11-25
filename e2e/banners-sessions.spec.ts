import { expect, test, type Page } from "@playwright/test";
import { gotoAs, sidebar } from "./helpers";

// Banner cửa hàng, chính sách chống lạm dụng đặt hàng (sales) và thiết bị đăng nhập (Hồ sơ). Mock: sales-banners.mjs, sessions.mjs.
const main = (page: Page) => page.getByRole("main");
const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("banner cửa hàng", () => {
  test("quản lý tạo, sửa, xóa banner; nav hiện mục Banner cửa hàng", async ({ page }) => {
    const title = `Giảm giá ${uid()}`;
    await gotoAs(page, "salesmgr", "/sales/banners");
    await expect(sidebar(page).getByRole("link", { name: "Banner cửa hàng" })).toHaveAttribute("href", "/sales/banners");
    await main(page).getByRole("button", { name: "Thêm banner" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Tiêu đề").fill(title);
    await dlg.getByLabel("Đường dẫn liên kết").fill("https://evil.example");
    await dlg.getByRole("button", { name: "Tạo" }).click();
    await expect(dlg.getByText(/Đường dẫn không hợp lệ/)).toBeVisible();
    await dlg.getByLabel("Đường dẫn liên kết").fill("/books?sort=newest");
    await dlg.getByRole("button", { name: "Tạo" }).click();
    const row = main(page).getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Đang hiển thị");
    await expect(row).toContainText("/books?sort=newest");

    await row.getByRole("button", { name: "Sửa" }).click();
    await page.getByRole("dialog").getByLabel("Bật banner").click();
    await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
    await expect(row).toContainText("Đã tắt");

    await row.getByRole("button", { name: "Xóa" }).click();
    await page.getByRole("button", { name: "Xóa", exact: true }).last().click();
    await expect(main(page).getByRole("row").filter({ hasText: title })).toHaveCount(0);
  });

  test("tài khoản chỉ xem không thấy nút thêm/sửa/xóa; thu ngân bị chặn", async ({ page }) => {
    await gotoAs(page, "salesview", "/sales/banners");
    await expect(main(page).getByRole("button", { name: "Thêm banner" })).toHaveCount(0);
    await gotoAs(page, "cashier", "/");
    await expect(sidebar(page).getByRole("link", { name: "Banner cửa hàng" })).toHaveCount(0);
    await page.goto("/sales/banners");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });
});

test.describe("chính sách chống lạm dụng đặt hàng", () => {
  test("quản lý đọc, sửa và lưu; người chỉ xem không có nút lưu", async ({ page }) => {
    await gotoAs(page, "salesmgr", "/sales/settings");
    const card = page.getByTestId("abuse-policy");
    await expect(card).toContainText("Phiên bản");
    const input = card.getByLabel("Số đơn chờ tối đa mỗi khách");
    await input.fill("7");
    await card.getByRole("button", { name: "Lưu chính sách" }).click();
    await expect(page.getByText("Đã lưu chính sách chống lạm dụng.")).toBeVisible();
    await expect(card.getByLabel("Số đơn chờ tối đa mỗi khách")).toHaveValue("7");

    await gotoAs(page, "salesview", "/sales/settings");
    await expect(page.getByTestId("abuse-policy")).toBeVisible();
    await expect(page.getByTestId("abuse-policy").getByRole("button", { name: "Lưu chính sách" })).toHaveCount(0);
  });
});

test.describe("thiết bị đăng nhập", () => {
  test("liệt kê, thu hồi một phiên và đăng xuất các thiết bị khác", async ({ page }) => {
    await gotoAs(page, "member", "/profile");
    const box = page.getByTestId("device-sessions");
    await expect(box.getByText("Thiết bị này").first()).toBeVisible();
    await expect(box.getByText("Safari trên iPhone").first()).toBeVisible();
    await expect(box.getByText(/tối đa 15 phút/).first()).toBeVisible();

    await box.getByRole("row").filter({ hasText: "Safari trên iPhone" }).getByRole("button", { name: "Đăng xuất thiết bị" }).click();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).last().click();
    await expect(box.getByRole("row")).toHaveCount(3); // tiêu đề + 2 phiên còn lại

    await box.getByRole("button", { name: "Đăng xuất các thiết bị khác" }).click();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).last().click();
    await expect(page.getByText(/Đã đăng xuất \d+ thiết bị khác/)).toBeVisible();
    await expect(box.getByText("Thiết bị này").first()).toBeVisible();
    await expect(box.getByRole("row")).toHaveCount(2);
  });

  test("đăng xuất tất cả đưa về trang đăng nhập", async ({ page }) => {
    await gotoAs(page, "reader", "/profile");
    await page.getByTestId("device-sessions").getByRole("button", { name: "Đăng xuất tất cả" }).click();
    await page.getByRole("button", { name: "Đăng xuất tất cả", exact: true }).last().click();
    await expect(page).toHaveURL(/\/login/);
  });
});
