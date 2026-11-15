import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// Trang của shell: /profile, /notifications và lối tắt theo quyền ở trang chủ. Dữ liệu mock nằm ở e2e/mock/shell.mjs.
// Mỗi test tự dùng người dùng riêng; `librarian` chỉ dùng cho test hủy liên kết (mock không tự khôi phục, chạy một lần).

test.describe("/profile", () => {
  test("chưa đăng nhập thì chuyển về login kèm đường dẫn quay lại", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  });

  test("độc giả thấy tài khoản, thẻ thư viện và trạng thái liên kết; không có nút Liên kết", async ({ page }) => {
    await loginAs(page, "reader");
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Hồ sơ của tôi" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByText("Độc Giả Mẫu")).toBeVisible();
    await expect(main.getByText("reader@example.test")).toBeVisible();
    await expect(main.getByText("READER", { exact: true })).toBeVisible();
    await expect(main.getByText("Muốn đổi thông tin, liên hệ quản trị viên.")).toBeVisible();
    await expect(main.getByRole("link", { name: "Đổi mật khẩu" })).toHaveAttribute("href", "/change-password");

    await expect(page.getByTestId("card-no")).toHaveText("RD-READER-01");
    await expect(main.getByText("Sinh viên")).toBeVisible();
    await expect(main.getByText("31/12/2030")).toBeVisible();
    await expect(main.getByText("Thẻ hợp lệ")).toBeVisible();

    const google = page.getByTestId("external-google");
    await expect(google).toContainText("Đã liên kết");
    await expect(google).toContainText("reader@gmail.test");
    await expect(page.getByTestId("external-microsoft")).toContainText("Chưa liên kết");
    // Cố ý ẩn: luồng liên kết OIDC cần cookie mà BFF không chuyển tiếp.
    await expect(main.getByRole("button", { name: /^Liên kết/ })).toHaveCount(0);
    await expect(main.getByRole("button", { name: /Hủy liên kết/ })).toHaveCount(1);
  });

  test("người không có hồ sơ độc giả: ẩn thẻ thư viện và không báo lỗi", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/profile");
    const main = page.getByRole("main");
    await expect(main.getByText("member@example.test")).toBeVisible();
    await expect(main.getByText("Thẻ thư viện", { exact: true })).toHaveCount(0);
    await expect(page.locator(".ant-alert-error")).toHaveCount(0);
    await expect(page.getByTestId("external-google")).toContainText("Chưa liên kết");
  });

  test("hủy liên kết: xác nhận rồi cập nhật trạng thái và giữ nguyên sau khi tải lại", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    const google = page.getByTestId("external-google");
    await expect(google).toContainText("Đã liên kết");

    await google.getByRole("button", { name: "Hủy liên kết Google" }).click();
    await expect(page.getByText("Hủy liên kết với «Google»?")).toBeVisible();
    await page.locator(".ant-popover").getByRole("button", { name: "Hủy liên kết", exact: true }).click();

    await expect(google).toContainText("Chưa liên kết");
    await expect(page.getByText("Đã hủy liên kết với Google.")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("external-google")).toContainText("Chưa liên kết");
  });
});

test.describe("/notifications", () => {
  test("chưa đăng nhập thì chuyển về login kèm đường dẫn quay lại", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page).toHaveURL(/\/login\?next=%2Fnotifications$/);
  });

  test("liệt kê mới nhất trước, đếm chưa đọc, lọc, và ghi mốc đã xem để lần sau về 0", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();

    const items = page.getByTestId("notification-item");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText("Sách bạn đặt trước đã sẵn sàng nhận.");
    await expect(items.first()).toContainText("Chưa đọc");
    await expect(items.nth(1)).toContainText("Phiếu mượn của bạn sắp đến hạn trả.");
    await expect(page.getByText("Chưa đọc (1)")).toBeVisible();

    await page.getByText("Chưa đọc (1)").click();
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Sách bạn đặt trước đã sẵn sàng nhận.");

    // Trang đã ghi mốc "đã xem lần cuối" (cùng khóa với chuông) nên lần tải sau không còn mục chưa đọc.
    await page.reload();
    await expect(page.getByText("Chưa đọc (0)")).toBeVisible();
    await expect(page.getByText("Tất cả (2)")).toBeVisible();
    await page.getByText("Chưa đọc (0)").click();
    await expect(page.getByText("Không có thông báo chưa đọc.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thông báo, 0 chưa đọc" })).toBeVisible();
  });

  test("danh sách rỗng hiện thông báo trống", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/notifications");
    await expect(page.getByText("Bạn chưa có thông báo nào.")).toBeVisible();
  });

  test("phân trang 20 mục mỗi trang", async ({ page }) => {
    await loginAs(page, "reader");
    await page.goto("/notifications");
    const items = page.getByTestId("notification-item");
    await expect(items).toHaveCount(20);
    await page.locator(".ant-pagination-item-2").click();
    await expect(items).toHaveCount(4);
  });
});

test.describe("trang chủ: lối tắt theo quyền", () => {
  test("người không có khóa nghiệp vụ chỉ thấy lối tắt cá nhân và thông báo gần đây", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/");
    const main = page.getByRole("main");
    for (const href of ["/catalog", "/circulation", "/admin"]) {
      await expect(main.locator(`a[href="${href}"]`)).toHaveCount(0);
    }
    await expect(main.locator('a[href="/profile"]')).toBeVisible();
    await expect(main.locator('a[href="/change-password"]')).toBeVisible();
    await expect(page.getByTestId("recent-notification")).toHaveCount(2);
    await expect(main.getByRole("link", { name: "Xem tất cả thông báo" })).toHaveAttribute("href", "/notifications");
  });

  test("thủ thư kiểu cũ thấy Mượn trả và Quản trị, không thấy Sách; quản trị viên thấy đủ", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main.locator('a[href="/circulation"]').first()).toBeVisible();
    await expect(main.locator('a[href="/admin"]')).toBeVisible();
    await expect(main.locator('a[href="/catalog"]')).toHaveCount(0);

    await loginAs(page, "admin");
    await page.goto("/");
    for (const href of ["/catalog", "/circulation", "/admin"]) {
      await expect(main.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });
});

test.describe("route gộp trong shell: tiêu đề tab và 404 trong khung", () => {
  test("tiêu đề tab lấy từ metadata của đoạn cộng template ở root layout", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/circulation");
    await expect(page).toHaveTitle("Mượn trả - Quản lý thư viện");
    await page.goto("/catalog");
    await expect(page).toHaveTitle("Sách - Quản lý thư viện");
  });

  test("URL lạ dưới /circulation trả 404 nhưng vẫn có sidebar", async ({ page }) => {
    await loginAs(page, "admin");
    const res = await page.goto("/circulation/xyz-khong-co");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
    await expect(page.locator("aside")).toBeVisible();
  });
});
