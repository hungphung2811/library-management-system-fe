import { expect, test, type Locator } from "@playwright/test";
import { SHELL_ZONE_DOWN, loginAs } from "./helpers";

/** Mở nhóm cha; bấm lại đến khi aria-expanded=true (nút bấm trước khi hydrate xong thì không có tác dụng). */
async function openGroup(nav: Locator, name: string) {
  const btn = nav.getByRole("button", { name });
  await expect(async () => {
    if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
  }).toPass();
}

// Sidebar là nơi duy nhất chứa điều hướng giữa các màn hình (packages/ui ShellFrame).
test.describe("sidebar: mục con theo quyền và mục đang mở", () => {
  test("chỉ có MỘT thẻ <nav> trên trang zone", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    await expect(page.locator("nav")).toHaveCount(1);
  });

  test("mục đang mở có aria-current, nhóm cha tự mở khi đang ở trong zone", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/roles");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("button", { name: "Quản trị" })).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Vai trò và quyền" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Người dùng" })).not.toHaveAttribute("aria-current", /.+/);
    // Nhóm không phải zone hiện tại thì thu gọn
    await expect(nav.getByRole("button", { name: "Sách" })).toHaveAttribute("aria-expanded", "false");
  });

  test("trang chi tiết (/admin/users/{id}) vẫn đánh dấu mục Người dùng", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    const first = page.getByRole("main").getByRole("link").first();
    await first.click();
    await page.waitForURL(/\/admin\/users\/[^/]+$/);
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Người dùng" })).toHaveAttribute("aria-current", "true");
  });

  test("bấm mục con đi đúng URL (không /admin/admin/...) và xuyên zone", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await openGroup(nav, "Quản trị");
    await nav.getByRole("link", { name: "Phòng ban" }).click();
    await expect(page).toHaveURL(/\/admin\/departments$/);
    await expect(nav.getByRole("link", { name: "Phòng ban" })).toHaveAttribute("aria-current", "page");

    await openGroup(nav, "Sách");
    await nav.getByRole("link", { name: "Tra mã vạch" }).click();
    await expect(page).toHaveURL(/\/catalog\/barcode$/);
    await expect(nav.getByRole("link", { name: "Tra mã vạch" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Danh sách sách" })).not.toHaveAttribute("aria-current", /.+/);
  });

  test("nhóm mở/thu gọn bằng nút cha", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/");
    const nav = page.getByRole("navigation");
    const group = nav.getByRole("button", { name: "Mượn trả" });
    await expect(group).toHaveAttribute("aria-expanded", "false");
    await expect(nav.getByRole("link", { name: "Nhận trả sách" })).toBeHidden();
    await openGroup(nav, "Mượn trả");
    await expect(nav.getByRole("link", { name: "Nhận trả sách" })).toBeVisible();
  });

  test("staff (listRoles + borrow): chỉ thấy mục con có quyền", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/admin/roles");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Vai trò và quyền" })).toBeVisible();
    for (const n of ["Người dùng", "Phòng ban", "Nhật ký hoạt động"]) {
      await expect(nav.getByRole("link", { name: n })).toHaveCount(0);
    }
    await openGroup(nav, "Mượn trả");
    await expect(nav.getByRole("link", { name: "Lập phiếu mượn" })).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Nhận trả sách" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Sách" })).toHaveCount(0);
  });

  test("reader: không thấy Quản trị, chỉ Danh sách sách và Đặt trước", async ({ page }) => {
    await loginAs(page, "reader");
    await page.goto("/catalog");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("button", { name: "Quản trị" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Danh sách sách" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Thêm sách" })).toHaveCount(0);
    await openGroup(nav, "Mượn trả");
    await expect(nav.getByRole("link", { name: "Đặt trước" })).toHaveCount(1);
  });

  test("member: không thấy nhóm Sách, Mượn trả, Quản trị", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/");
    const nav = page.getByRole("navigation");
    for (const n of ["Sách", "Mượn trả", "Quản trị"]) {
      await expect(nav.getByRole("button", { name: n })).toHaveCount(0);
    }
  });

  test("nút thu gọn nằm trong sidebar cạnh logo; thu gọn rồi mở lại bằng nút trên thanh trên", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/");
    await page.getByRole("navigation").getByRole("button", { name: "Thu gọn menu" }).click();
    await expect(page.getByRole("navigation")).toBeHidden();
    await page.getByRole("button", { name: "Mở rộng menu" }).click();
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("trang 503 của zone admin vẫn có sidebar, nhóm Quản trị được mở", async ({ page }) => {
    await loginAs(page, "admin", SHELL_ZONE_DOWN);
    const res = await page.goto(`${SHELL_ZONE_DOWN}/admin`);
    expect(res?.status()).toBe(503);
    await expect(page.locator("nav")).toHaveCount(1);
    await expect(page.getByRole("navigation").getByRole("button", { name: "Quản trị" })).toHaveAttribute("aria-expanded", "true");
  });
});
