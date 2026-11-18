import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { GATEWAY, gotoAs, hasRefreshToken, openUserMenu, sidebar } from "./helpers";

// Nút "Làm mới quyền" ở menu người dùng (ADR-0022): dùng lại POST /api/auth/refresh, so claim cũ/mới, bỏ cache, cooldown 30 giây.
// Mock (e2e/mock-gateway.mjs) có tài khoản `permuser` và điều khiển /__test/*: đổi quyền (mô phỏng admin gán role) và giả lập
// lỗi của /api/auth/refresh. Cả file chạy tuần tự vì dùng chung một tài khoản và trạng thái mock.

test.describe.configure({ mode: "serial" });

const BARCODE = "BookCopyController/getByBarcode";

const resetUser = (request: APIRequestContext) =>
  request.post(`${GATEWAY}/__test/user`, { data: { username: "permuser", reset: true } });
const setPermissions = (request: APIRequestContext, permissions: string[], roles = ["MEMBER"]) =>
  request.post(`${GATEWAY}/__test/user`, { data: { username: "permuser", patch: { permissions, roles } } });
const fault = (request: APIRequestContext, mode: string, count = 1) =>
  request.post(`${GATEWAY}/__test/refresh`, { data: { username: "permuser", mode, count } });
const refreshCalls = async (request: APIRequestContext) =>
  ((await (await request.get(`${GATEWAY}/__test/refresh-calls?username=permuser`)).json()) as { calls: number }).calls;

const menuItem = (page: Page) => page.getByRole("button", { name: /^(Làm mới quyền|Đang làm mới quyền)/ });
async function clickRefresh(page: Page) {
  await openUserMenu(page);
  await menuItem(page).click();
}

test.describe("Làm mới quyền", () => {
  test.beforeEach(async ({ request }) => {
    await resetUser(request);
  });

  test("gán thêm quyền rồi bấm nút: sidebar có mục mới, báo Đã cập nhật quyền, không bị đăng xuất", async ({ page, request }) => {
    await gotoAs(page, "permuser");
    await expect(sidebar(page).getByRole("link", { name: "Tra mã vạch" })).toHaveCount(0);

    await setPermissions(request, [BARCODE], ["MEMBER", "CLERK"]); // quản trị viên vừa gán thêm role
    await clickRefresh(page);

    await expect(page.getByText("Đã cập nhật quyền.")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Tra mã vạch" })).toBeVisible();
    expect(await hasRefreshToken(page)).toBe(true);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("quyền không đổi: báo Quyền không thay đổi", async ({ page }) => {
    await gotoAs(page, "permuser");
    await clickRefresh(page);
    await expect(page.getByText("Quyền không thay đổi.")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Tra mã vạch" })).toHaveCount(0);
  });

  test("cooldown: sau khi bấm, nút bị vô hiệu hóa và hiện thời gian chờ; không gọi refresh thêm", async ({ page, request }) => {
    await gotoAs(page, "permuser");
    await clickRefresh(page);
    await expect(page.getByText("Quyền không thay đổi.")).toBeVisible();
    const calls = await refreshCalls(request);

    await openUserMenu(page);
    const item = page.getByRole("button", { name: /^Làm mới quyền \(chờ \d+s\)$/ });
    await expect(item).toBeVisible();
    await expect(item).toBeDisabled();
    await item.click({ force: true });
    expect(await refreshCalls(request)).toBe(calls);
  });

  test("REFRESH_TOKEN_SUPERSEDED một lần: tự thử lại, không đăng xuất", async ({ page, request }) => {
    await gotoAs(page, "permuser");
    const before = await refreshCalls(request);
    await fault(request, "superseded", 1);
    await clickRefresh(page);
    await expect(page.getByText("Quyền không thay đổi.")).toBeVisible();
    expect(await refreshCalls(request)).toBe(before + 2);
    expect(await hasRefreshToken(page)).toBe(true);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("REFRESH_TOKEN_SUPERSEDED liên tục: báo thử lại sau, vẫn giữ phiên (không đăng xuất)", async ({ page, request }) => {
    await gotoAs(page, "permuser");
    await fault(request, "superseded", 50);
    await clickRefresh(page);
    await expect(page.getByText("Phiên vừa được làm mới ở nơi khác, vui lòng thử lại sau vài giây.")).toBeVisible();
    expect(await hasRefreshToken(page)).toBe(true);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(sidebar(page)).toBeVisible();
  });

  for (const mode of ["unavailable", "throttled"]) {
    test(`lỗi tạm thời (${mode === "unavailable" ? "503" : "429"}): báo lỗi thân thiện, không xóa phiên`, async ({ page, request }) => {
      await gotoAs(page, "permuser");
      await fault(request, mode, 1);
      await clickRefresh(page);
      await expect(page.getByText(/Chưa làm mới được quyền/)).toBeVisible();
      expect(await hasRefreshToken(page)).toBe(true);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(sidebar(page)).toBeVisible();
    });
  }

  test("refresh token bị thu hồi (401 khác): về trang đăng nhập và xóa phiên", async ({ page, request }) => {
    await gotoAs(page, "permuser");
    await fault(request, "revoked", 1);
    await clickRefresh(page);
    await expect(page).toHaveURL(/\/login/);
    expect(await hasRefreshToken(page)).toBe(false);
  });

  test("tài khoản bị vô hiệu hóa (403 ACCOUNT_DISABLED) hoặc khóa (423): về trang đăng nhập", async ({ page, request }) => {
    for (const mode of ["disabled", "locked"]) {
      await gotoAs(page, "permuser");
      await fault(request, mode, 1);
      await clickRefresh(page);
      await expect(page).toHaveURL(/\/login/);
      expect(await hasRefreshToken(page)).toBe(false);
    }
  });

  test("platform admin đang làm việc thay đơn vị: bấm nút vẫn giữ lựa chọn đơn vị", async ({ page }) => {
    await gotoAs(page, "platform");
    await page.getByRole("combobox", { name: "Đơn vị đang làm việc" }).click();
    await page.locator(".ant-select-item-option").first().click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("lms_act_tenant"))).toMatch(/^[0-9a-f-]{36}$/i);
    const chosen = await page.evaluate(() => localStorage.getItem("lms_act_tenant"));
    await expect(sidebar(page)).toBeVisible();

    await clickRefresh(page);
    await expect(page.getByText("Quyền không thay đổi.")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("lms_act_tenant"))).toBe(chosen);
    await expect(sidebar(page).getByRole("button", { name: "Sách" })).toHaveCount(1);
  });
});
