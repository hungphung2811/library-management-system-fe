import { expect, test } from "@playwright/test";
import { gotoApp, loginAs, markSpa, readSpa, sidebar } from "./helpers";

// Sidebar là nơi duy nhất chứa điều hướng giữa các màn hình (apps/web/src/ui/ShellFrame.tsx); mọi nhóm mở sẵn.
test.describe("sidebar: mục con theo quyền và mục đang mở", () => {
  test("chỉ có MỘT thẻ <nav> trên trang", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/admin/users");
    await expect(page.locator("nav")).toHaveCount(1);
  });

  test("mục đang mở có aria-current; mọi nhóm mở sẵn", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/admin/roles");
    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: "Vai trò và quyền" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Người dùng" })).not.toHaveAttribute("aria-current", /.+/);
    for (const g of ["Quản trị", "Sách", "Mượn trả"]) {
      await expect(nav.getByRole("button", { name: g })).toHaveAttribute("aria-expanded", "true");
    }
  });

  test("trang chi tiết (/admin/users/{id}) vẫn đánh dấu mục Người dùng", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/admin/users/a0000000-0000-4000-8000-000000000001");
    await expect(sidebar(page).getByRole("link", { name: "Người dùng" })).toHaveAttribute("aria-current", "true");
  });

  test("bấm mục con đi đúng URL (không /admin/admin/...) và xuyên nhóm", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/");
    const nav = sidebar(page);
    await nav.getByRole("link", { name: "Phòng ban" }).click();
    await expect(page).toHaveURL(/\/admin\/departments$/);
    await expect(nav.getByRole("link", { name: "Phòng ban" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Tra mã vạch" }).click();
    await expect(page).toHaveURL(/\/catalog\/barcode$/);
    await expect(nav.getByRole("link", { name: "Tra mã vạch" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Danh sách sách" })).not.toHaveAttribute("aria-current", /.+/);
  });

  test("trang gốc của nhóm (/circulation) không đánh dấu mục con nào nhưng nhóm vẫn mở", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/circulation");
    const nav = sidebar(page);
    await expect(nav.getByRole("button", { name: "Mượn trả" })).toHaveAttribute("aria-expanded", "true");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  });

  test("nút nhóm thu gọn rồi mở lại", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/");
    const nav = sidebar(page);
    const group = nav.getByRole("button", { name: "Mượn trả" });
    await expect(group).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Nhận trả sách" })).toBeVisible();
    await group.click();
    await expect(group).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByRole("link", { name: "Nhận trả sách" })).toBeHidden();
    await group.click();
    await expect(nav.getByRole("link", { name: "Nhận trả sách" })).toBeVisible();
  });

  test("staff (listRoles + borrow): chỉ thấy mục con có quyền", async ({ page }) => {
    await loginAs(page, "staff");
    await gotoApp(page, "/admin/roles");
    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: "Vai trò và quyền" })).toBeVisible();
    for (const n of ["Người dùng", "Phòng ban", "Nhật ký hoạt động"]) {
      await expect(nav.getByRole("link", { name: n })).toHaveCount(0);
    }
    await expect(nav.getByRole("link", { name: "Lập phiếu mượn" })).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Tra phiếu mượn" })).toHaveCount(1); // any-of: có khóa borrow
    await expect(nav.getByRole("link", { name: "Nhận trả sách" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Sách" })).toHaveCount(0);
  });

  test("reader: không thấy Quản trị, chỉ Danh sách sách và Đặt trước", async ({ page }) => {
    await loginAs(page, "reader");
    await gotoApp(page, "/catalog");
    const nav = sidebar(page);
    await expect(nav.getByRole("button", { name: "Quản trị" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Danh sách sách" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Thêm sách" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Tra mã vạch" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Đặt trước" })).toHaveCount(1);
  });

  test("member: không thấy nhóm Sách, Quản trị; nhóm Mượn trả chỉ còn mục không cần khóa (Phiếu của tôi)", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/");
    const nav = sidebar(page);
    for (const n of ["Sách", "Quản trị"]) {
      await expect(nav.getByRole("button", { name: n })).toHaveCount(0);
    }
    // /api/borrowings/mine chỉ cần đăng nhập nên nhóm Mượn trả luôn hiện với mục "Phiếu của tôi" (nav-links.ts).
    await expect(nav.getByRole("button", { name: "Mượn trả" })).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Phiếu của tôi" })).toBeVisible();
    for (const n of ["Lập phiếu mượn", "Nhận trả sách", "Tra phiếu mượn", "Đặt trước", "Phạt"]) {
      await expect(nav.getByRole("link", { name: n, exact: true })).toHaveCount(0);
    }
    await expect(nav.getByRole("link", { name: "Trang chủ", exact: true })).toBeVisible();
  });

  test("platform admin không tenant: không thấy nhóm Mượn trả và Phiếu của tôi (tenantOnly)", async ({ page }) => {
    await loginAs(page, "platform");
    await gotoApp(page, "/");
    const nav = sidebar(page);
    await expect(nav.getByRole("button", { name: "Nền tảng SaaS" })).toHaveCount(1);
    await expect(nav.getByRole("button", { name: "Mượn trả" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Phiếu của tôi" })).toHaveCount(0);
  });

  test("nút thu gọn nằm trong sidebar cạnh logo; thu gọn rồi mở lại bằng nút trên thanh trên", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/");
    await sidebar(page).getByRole("button", { name: "Thu gọn menu" }).click();
    await expect(sidebar(page)).toBeHidden();
    await page.getByRole("button", { name: "Mở rộng menu" }).click();
    await expect(sidebar(page)).toBeVisible();
  });
});

// Mọi link là route của cùng SPA: bấm link không tải lại trang. `window.__spa` là dấu hiệu: mất đi nghĩa là trang đã tải lại.
test.describe("điều hướng phía client", () => {
  test("Sách -> Trang chủ bằng breadcrumb: không tải lại, sidebar vẫn thu gọn", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/catalog");
    await sidebar(page).getByRole("button", { name: "Thu gọn menu" }).click();
    await expect(sidebar(page)).toBeHidden();
    await markSpa(page);

    await page.getByRole("link", { name: "Trang chủ" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
    expect(await readSpa(page)).toBe(1);
    await expect(sidebar(page)).toBeHidden();
  });

  test("Sách -> Mượn trả -> Quản trị bằng sidebar: không tải lại, mục đang mở đổi theo", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/catalog");
    const nav = sidebar(page);
    await markSpa(page);

    await nav.getByRole("link", { name: "Lập phiếu mượn" }).click();
    await expect(page).toHaveURL(/\/circulation\/borrow$/);
    await expect(nav.getByRole("link", { name: "Lập phiếu mượn" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Phòng ban" }).click();
    await expect(page).toHaveURL(/\/admin\/departments$/);
    await expect(nav.getByRole("link", { name: "Phòng ban" })).toHaveAttribute("aria-current", "page");
    expect(await readSpa(page)).toBe(1);
  });

  test("Xem tất cả thông báo: chuyển phía client, popover đóng lại, khung giữ nguyên", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/catalog");
    await markSpa(page);

    await page.getByRole("button", { name: /^Thông báo/ }).click();
    await page.locator(".ant-popover").getByRole("link", { name: "Xem tất cả" }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible();
    expect(await readSpa(page)).toBe(1);
    await expect(page.locator(".ant-popover").getByRole("link", { name: "Xem tất cả" })).toBeHidden();
  });

  test("Hồ sơ của tôi từ trang admin: chuyển phía client, đúng /profile (không thành /admin/profile)", async ({ page }) => {
    await loginAs(page, "admin");
    await gotoApp(page, "/admin/users");
    await markSpa(page);

    await page.getByRole("button", { name: "Tài khoản của tôi" }).click();
    await page.getByRole("link", { name: "Hồ sơ của tôi" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "Hồ sơ của tôi" })).toBeVisible();
    expect(await readSpa(page)).toBe(1);
    await expect(page.getByRole("link", { name: "Hồ sơ của tôi", exact: true }).first()).toBeHidden(); // menu đã đóng
  });
});
