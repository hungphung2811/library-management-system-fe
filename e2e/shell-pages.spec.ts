import { expect, test } from "@playwright/test";
import { gotoApp, loginAs } from "./helpers";

// Trang nền của SPA: /profile, /notifications, trang chủ (lối tắt theo quyền), tiêu đề tab và 404. Dữ liệu mock: e2e/mock/shell.mjs.
// Mỗi test tự dùng người dùng riêng; `librarian` chỉ dùng cho test hủy liên kết (mock không tự khôi phục, chạy một lần).

test.describe("/profile", () => {
  test("chưa đăng nhập thì chuyển về login kèm đường dẫn quay lại", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  });

  test("độc giả thấy tài khoản, thẻ thư viện và trạng thái liên kết; không có nút Liên kết", async ({ page }) => {
    await loginAs(page, "reader");
    await gotoApp(page, "/profile");

    await expect(page.getByRole("heading", { name: "Hồ sơ của tôi" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByText("Đỗ Thị Mai Anh").first()).toBeVisible();
    await expect(main.getByText("maianh.do@outlook.com").first()).toBeVisible();
    await expect(main.getByText("READER", { exact: true })).toBeVisible();
    await expect(main.getByText("Muốn đổi thông tin, liên hệ quản trị viên.")).toBeVisible();
    await expect(main.getByRole("link", { name: "Đổi mật khẩu" })).toHaveAttribute("href", "/change-password");

    await expect(page.getByTestId("card-no")).toHaveText("TV26-000512");
    await expect(main.getByText("Sinh viên")).toBeVisible();
    await expect(main.getByText("31/12/2030")).toBeVisible();
    await expect(main.getByText("Thẻ hợp lệ")).toBeVisible();

    const google = page.getByTestId("external-google");
    await expect(google).toContainText("Đã liên kết");
    await expect(google).toContainText("maianh.do@gmail.com");
    await expect(page.getByTestId("external-microsoft")).toContainText("Chưa liên kết");
    // Cố ý ẩn: luồng liên kết OIDC cần cookie do BE đặt.
    await expect(main.getByRole("button", { name: /^Liên kết/ })).toHaveCount(0);
    await expect(main.getByRole("button", { name: /Hủy liên kết/ })).toHaveCount(1);
  });

  test("hiện thông tin cá nhân (SĐT, ngày sinh dd/MM/yyyy, giới tính, địa chỉ) và khoa/lớp/mã SV của độc giả", async ({ page }) => {
    await loginAs(page, "reader");
    await gotoApp(page, "/profile");
    const main = page.getByRole("main");
    await expect(main.getByText("0987 654 321")).toBeVisible();
    await expect(main.getByText("03/11/2002")).toBeVisible();
    await expect(main.getByText("Nữ", { exact: true })).toBeVisible();
    await expect(main.getByText("45 Lê Lợi, Quận 1, TP.HCM")).toBeVisible();
    await expect(main.getByText("Khoa Ngữ văn")).toBeVisible();
    await expect(main.getByText("K20-NV1")).toBeVisible();
    await expect(main.getByText("SV20-01234")).toBeVisible();
    await expect(main.getByText("01/09/2020")).toBeVisible();
    // Avatar chữ cái đầu của họ tên (Đỗ Thị Mai Anh) khi chưa có ảnh.
    await expect(main.locator(".ant-avatar", { hasText: "Đ" })).toBeVisible();
  });

  test("người không có thông tin cá nhân: không hiện dòng SĐT, ngày sinh, giới tính", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/profile");
    const main = page.getByRole("main");
    await expect(main.getByText("khoi.tran@outlook.com").first()).toBeVisible();
    for (const label of ["Số điện thoại", "Ngày sinh", "Giới tính", "Địa chỉ"]) {
      await expect(main.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  test("người không có hồ sơ độc giả: ẩn thẻ thư viện và không báo lỗi", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/profile");
    const main = page.getByRole("main");
    await expect(main.getByText("khoi.tran@outlook.com").first()).toBeVisible();
    await expect(main.getByText("Thẻ thư viện", { exact: true })).toHaveCount(0);
    await expect(page.locator(".ant-alert-error")).toHaveCount(0);
    await expect(page.getByTestId("external-google")).toContainText("Chưa liên kết");
  });

  test("hủy liên kết: xác nhận rồi cập nhật trạng thái và giữ nguyên sau khi tải lại", async ({ page }) => {
    await loginAs(page, "librarian");
    await gotoApp(page, "/profile");
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

  test("liệt kê mới nhất trước, đếm chưa đọc và lọc Chưa đọc", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/notifications");
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
    await expect(page).toHaveURL(/filter=unread/);
  });

  test("Đánh dấu đã đọc gọi BE, số chưa đọc ở trang và chuông về 0 và giữ sau khi tải lại", async ({ page }) => {
    // multi2: người dùng riêng cho việc đổi trạng thái đã đọc (mặc định 1 chưa đọc).
    await loginAs(page, "multi2");
    await gotoApp(page, "/notifications");
    await expect(page.getByText("Chưa đọc (1)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thông báo, 1 chưa đọc" })).toBeVisible();

    const read = page.waitForRequest((r) => r.method() === "POST" && /\/api\/notifications\/[^/]+\/read$/.test(r.url()));
    await page.getByRole("button", { name: /^Đánh dấu đã đọc: Sách bạn đặt trước/ }).click();
    await read;
    await expect(page.getByText("Chưa đọc (0)")).toBeVisible();
    await expect(page.getByText("Tất cả (2)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thông báo, 0 chưa đọc" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Đọc hết" })).toBeDisabled();

    await page.reload();
    await expect(page.getByText("Chưa đọc (0)")).toBeVisible();
    await page.getByText("Chưa đọc (0)").click();
    await expect(page.getByText("Không có thông báo chưa đọc.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thông báo, 0 chưa đọc" })).toBeVisible();
  });

  test("danh sách rỗng hiện thông báo trống", async ({ page }) => {
    await loginAs(page, "staff");
    await gotoApp(page, "/notifications");
    await expect(page.getByText("Bạn chưa có thông báo nào.").first()).toBeVisible();
  });

  test("phân trang 20 mục mỗi trang", async ({ page }) => {
    await loginAs(page, "reader");
    await gotoApp(page, "/notifications");
    const items = page.getByTestId("notification-item");
    await expect(items).toHaveCount(20);
    await page.locator(".ant-pagination-item-2").click();
    await expect(items).toHaveCount(4);
  });

  test("lỗi tải thông báo: chuông báo không tải được, trang vẫn hiện khung", async ({ page }) => {
    await loginAs(page, "member");
    // Chuông gọi /me/unread-count, trang chủ gọi /me: cùng trả 503.
    await page.route(/\/api\/notifications\/me/, (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "UNAVAILABLE", message: "Dịch vụ không khả dụng" }) }),
    );
    await gotoApp(page, "/");
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
    await expect(page.getByTestId("recent-notification")).toHaveCount(0);
    const bell = page.getByRole("button", { name: "Thông báo, 0 chưa đọc" });
    await expect(bell).toBeVisible();
    // Lỗi chỉ được xác định sau vài lần thử lại của truy vấn nên tooltip chưa có lúc đầu: rê chuột lại cho tới khi hiện.
    await expect(async () => {
      await page.mouse.move(0, 0);
      await bell.hover();
      await expect(page.locator(".ant-tooltip").getByText("Không tải được thông báo")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 30_000 });
  });
});

test.describe("trang chủ: lối tắt theo quyền", () => {
  test("người không có khóa nghiệp vụ chỉ thấy lối tắt cá nhân và thông báo gần đây", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/");
    const main = page.getByRole("main");
    // "Phiếu của tôi" (/circulation/mine) chỉ cần đăng nhập nên phân hệ Mượn trả hiện cho mọi người; Sách và Quản trị thì không.
    for (const href of ["/catalog", "/admin"]) {
      await expect(main.locator(`a[href="${href}"]`)).toHaveCount(0);
    }
    for (const href of ["/circulation/borrow", "/circulation/return", "/circulation/fines"]) {
      await expect(main.locator(`a[href="${href}"]`)).toHaveCount(0);
    }
    await expect(main.locator('a[href="/profile"]')).toBeVisible();
    await expect(main.locator('a[href="/change-password"]')).toBeVisible();
    await expect(page.getByTestId("recent-notification")).toHaveCount(2);
    await expect(main.getByRole("link", { name: "Xem tất cả thông báo" })).toHaveAttribute("href", "/notifications");
  });

  test("thủ thư kiểu cũ thấy Mượn trả và Quản trị, không thấy Sách", async ({ page }) => {
    await loginAs(page, "staff");
    await gotoApp(page, "/");
    const main = page.getByRole("main");
    await expect(main.locator('a[href="/circulation"]').first()).toBeVisible();
    await expect(main.locator('a[href="/admin"]')).toBeVisible();
    await expect(main.locator('a[href="/catalog"]')).toHaveCount(0);
  });

  test("quản trị viên thấy đủ lối tắt phân hệ", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/");
    const main = page.getByRole("main");
    for (const href of ["/catalog", "/circulation", "/admin"]) {
      await expect(main.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
    await expect(main.getByText("Quản trị viên (toàn quyền)")).toBeVisible();
  });
});

test.describe("tiêu đề tab và 404 trong khung", () => {
  test("tiêu đề tab lấy từ handle.title của route kèm hậu tố", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/circulation");
    await expect(page).toHaveTitle("Mượn trả - Quản lý thư viện");
    await page.goto("/catalog");
    await expect(page).toHaveTitle("Sách - Quản lý thư viện");
    await page.goto("/");
    await expect(page).toHaveTitle("Tổng quan - Quản lý thư viện");
  });

  test("URL lạ ở cấp gốc hiện trang 404 trong khung (có sidebar)", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/khong-co-trang-nay");
    await expect(page.getByText("Không tìm thấy trang")).toBeVisible();
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByRole("link", { name: "Về trang chủ", exact: true })).toBeVisible();
  });

  test("URL lạ dưới /circulation và /admin hiện trang 404 trong khung", async ({ page }) => {
    await loginAs(page, "admin");
    for (const path of ["/circulation/xyz-khong-co", "/admin/xyz-khong-co"]) {
      await gotoApp(page, path);
      await expect(page.getByText("Không tìm thấy trang"), path).toBeVisible();
      await expect(page.locator("aside"), path).toBeVisible();
    }
  });

  test("URL lạ khi chưa đăng nhập thì về login (không lộ 404 của khung)", async ({ page }) => {
    await page.goto("/khong-co-trang-nay");
    await expect(page).toHaveURL(/\/login\?next=%2Fkhong-co-trang-nay$/);
  });
});
