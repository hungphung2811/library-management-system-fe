import { expect, test, type Page } from "@playwright/test";
import { gotoApp, loginAs, sidebar } from "./helpers";

// Platform admin làm việc thay một đơn vị (ADR-0016 ở BE): chọn đơn vị trên thanh trên thì mọi lời gọi /api/** gửi
// X-Tenant-Id (trừ đăng nhập và vùng nền tảng), sidebar có menu nghiệp vụ của đơn vị kèm khu Nền tảng SaaS.
// Mock không có GET /api/menus/me nên sidebar rơi về DEFAULT_NAV_LINKS theo session hiệu lực (admin của đơn vị).

const picker = (page: Page) => page.getByRole("combobox", { name: "Đơn vị đang làm việc" });

async function chonDonViDauTien(page: Page) {
  await picker(page).click();
  const option = page.locator(".ant-select-item-option").first();
  await expect(option).toBeVisible();
  await option.click();
  // id đơn vị đã chọn nằm ở localStorage (khóa lms_act_tenant)
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lms_act_tenant"))).toMatch(/^[0-9a-f-]{36}$/i);
  return (await page.evaluate(() => localStorage.getItem("lms_act_tenant"))) ?? "";
}

test.describe("platform admin làm việc thay đơn vị", () => {
  test("chưa chọn đơn vị: chỉ có khu Nền tảng SaaS, không có nhóm nghiệp vụ", async ({ page }) => {
    await loginAs(page, "platform");
    await gotoApp(page, "/");
    const nav = sidebar(page);
    await expect(picker(page)).toBeVisible();
    await expect(nav.getByRole("button", { name: "Nền tảng SaaS" })).toHaveCount(1);
    await expect(nav.getByRole("button", { name: "Sách" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Quản trị" })).toHaveCount(0);
  });

  test("chọn đơn vị: sidebar có nhóm nghiệp vụ và vẫn giữ Nền tảng SaaS; xóa lựa chọn thì quay lại như cũ", async ({ page }) => {
    await loginAs(page, "platform");
    await gotoApp(page, "/");
    const nav = sidebar(page);

    await chonDonViDauTien(page);
    for (const g of ["Sách", "Mượn trả", "Quản trị", "Nền tảng SaaS"]) {
      await expect(nav.getByRole("button", { name: g })).toHaveCount(1);
    }

    // Xóa lựa chọn bằng nút clear của antd Select
    await page.locator(".ant-select-clear").click({ force: true });
    await expect(nav.getByRole("button", { name: "Sách" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Nền tảng SaaS" })).toHaveCount(1);
  });

  test("chọn đơn vị khi đang ở một trang: tải lại và giữ nguyên đường dẫn kèm query", async ({ page }) => {
    await loginAs(page, "platform");
    await gotoApp(page, "/platform/tenants?q=abc");
    const reloaded = page.waitForEvent("load");
    await chonDonViDauTien(page);
    await reloaded;
    await expect(page).toHaveURL(/\/platform\/tenants\?q=abc$/);
    await expect(sidebar(page).getByRole("button", { name: "Sách" })).toHaveCount(1);
  });

  test("gửi X-Tenant-Id cho API của đơn vị, không gửi cho /api/platform/** và /api/auth/**", async ({ page }) => {
    await loginAs(page, "platform");
    await gotoApp(page, "/");
    const seen: { url: string; tenant: string | undefined }[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/")) seen.push({ url: u.pathname, tenant: r.headers()["x-tenant-id"] });
    });

    const tenantId = await chonDonViDauTien(page);
    expect(tenantId).toMatch(/^[0-9a-f-]{36}$/i);
    // Tải lại: lựa chọn phải còn (localStorage) và header vẫn được gửi cho API của đơn vị
    const usersRequest = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/users");
    await page.goto("/admin/users");
    expect((await usersRequest).headers()["x-tenant-id"]).toBe(tenantId);
    await expect(sidebar(page).getByRole("button", { name: "Quản trị" })).toBeVisible();

    const tenantApis = seen.filter((s) => !s.url.startsWith("/api/platform/") && !s.url.startsWith("/api/auth/"));
    expect(tenantApis.length).toBeGreaterThan(0);
    expect(seen.filter((s) => s.url.startsWith("/api/platform/") && s.tenant !== undefined)).toEqual([]);
    expect(seen.filter((s) => s.url.startsWith("/api/auth/") && s.tenant !== undefined)).toEqual([]);
  });

  test("tài khoản không phải platform admin: không có ô chọn đơn vị làm việc thay và không gửi X-Tenant-Id", async ({ page }) => {
    await loginAs(page, "admin");
    const headers: (string | undefined)[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/")) headers.push(r.headers()["x-tenant-id"]);
    });
    // Dù localStorage còn giá trị lạ, người dùng thường không được gắn header
    await page.addInitScript(() => localStorage.setItem("lms_act_tenant", "00000000-0000-0000-0000-0000000000d1"));
    await gotoApp(page, "/admin/users");
    await expect(picker(page)).toHaveCount(0);
    expect(headers.filter((h) => h !== undefined)).toEqual([]);
  });
});
