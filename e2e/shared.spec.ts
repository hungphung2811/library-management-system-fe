import { expect, test, type Page } from "@playwright/test";
import { TENANT_A, TENANT_B, bearer, claimsOf, gotoApp, loginApi, loginAs, openUserMenu, sidebar } from "./helpers";

// Hạ tầng dùng chung: API gọi thẳng qua proxy (không còn BFF), làm mới phiên, chuyển đơn vị, chuông và menu người dùng.
test.describe("API qua proxy /api (không còn BFF)", () => {
  test("gọi API nghiệp vụ không có Bearer thì trả 401", async ({ request }) => {
    const res = await request.get("/api/books");
    expect(res.status()).toBe(401);
  });

  test("gắn Bearer gọi được và giữ nguyên đoạn đường dẫn đã mã hóa (barcode chứa ? và #)", async ({ request }) => {
    const t = await loginApi(request, "librarian");
    const ok = await request.get("/api/book-copies/by-barcode/TV00010001", { headers: bearer(t) });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).barcode).toBe("TV00010001");

    // Nếu proxy giải mã "%3F"/"%23" thì "?" thành query và "#" thành fragment, mock sẽ trả 404 khác hoặc sai bản ghi.
    const odd = await request.get(`/api/book-copies/by-barcode/${encodeURIComponent("BC?x#y")}`, { headers: bearer(t) });
    expect(odd.status()).toBe(404);
    expect((await odd.json()).code).toBe("NOT_FOUND");
  });

  test("thiếu khóa quyền thì BE trả 403 kèm tên khóa", async ({ request }) => {
    const t = await loginApi(request, "member");
    const res = await request.get("/api/books", { headers: bearer(t) });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toContain("TitleController/search");
  });

  test("token của tài khoản phải đổi mật khẩu không mang admin/permissions", async ({ request }) => {
    const t = await loginApi(request, "newbie");
    expect(t.mustChangePassword).toBe(true);
    const c = claimsOf(t.accessToken);
    expect(c.mustChangePassword).toBe(true);
    expect(c.admin).toBeUndefined();
    expect(c.permissions).toEqual([]);
  });

  test("admin có claim admin=true và tenantId", async ({ request }) => {
    const c = claimsOf((await loginApi(request, "admin")).accessToken);
    expect(c.admin).toBe(true);
    expect(c.tenantId).toBe(TENANT_A);
  });
});

test.describe("làm mới phiên: POST /api/auth/refresh", () => {
  test("có refresh token hợp lệ thì trả token mới, token lạ thì 401", async ({ request }) => {
    const t = await loginApi(request, "admin");
    const ok = await request.post("/api/auth/refresh", { data: { refreshToken: t.refreshToken } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).accessToken).toBeTruthy();

    const bad = await request.post("/api/auth/refresh", { data: { refreshToken: "rt-khong-co" } });
    expect(bad.status()).toBe(401);
  });
});

test.describe("chuyển đơn vị: POST /api/auth/switch-tenant (API)", () => {
  test("không có Bearer trả 401", async ({ request }) => {
    const res = await request.post("/api/auth/switch-tenant", { data: { tenantId: TENANT_A, refreshToken: "rt-member" } });
    expect(res.status()).toBe(401);
  });

  test("người không thuộc đơn vị bị 403", async ({ request }) => {
    const t = await loginApi(request, "member");
    const res = await request.post("/api/auth/switch-tenant", {
      headers: bearer(t),
      data: { tenantId: TENANT_B, refreshToken: t.refreshToken },
    });
    expect(res.status()).toBe(403);
  });

  test("thiếu refreshToken thì bị từ chối", async ({ request }) => {
    const t = await loginApi(request, "multi");
    const res = await request.post("/api/auth/switch-tenant", { headers: bearer(t), data: { tenantId: TENANT_A } });
    expect(res.status()).toBe(403);
  });

  test("chuyển thành công trả token mang tenantId mới (rồi chuyển lại)", async ({ request }) => {
    const t = await loginApi(request, "multi");
    try {
      const res = await request.post("/api/auth/switch-tenant", {
        headers: bearer(t),
        data: { tenantId: TENANT_B, refreshToken: t.refreshToken },
      });
      expect(res.status()).toBe(200);
      expect(claimsOf((await res.json()).accessToken).tenantId).toBe(TENANT_B);
    } finally {
      // Trả mock về đơn vị gốc để các test khác dùng user multi không bị ảnh hưởng.
      // Token cũ mang tenantId cũ nên mock không còn nhận; đăng nhập lại để lấy token hợp lệ.
      const t2 = await loginApi(request, "multi");
      const back = await request.post("/api/auth/switch-tenant", {
        headers: bearer(t2),
        data: { tenantId: TENANT_A, refreshToken: t2.refreshToken },
      });
      expect(claimsOf((await back.json()).accessToken).tenantId).toBe(TENANT_A);
    }
  });

  test("/api/me/tenants trả các đơn vị của người dùng", async ({ request }) => {
    const t = await loginApi(request, "member");
    const one = await (await request.get("/api/me/tenants", { headers: bearer(t) })).json();
    expect(one).toHaveLength(1);
    const t2 = await loginApi(request, "multi");
    const two = await (await request.get("/api/me/tenants", { headers: bearer(t2) })).json();
    expect(two).toHaveLength(2);
  });
});

// multi2 (mock dùng chung, đổi đơn vị là đổi trạng thái): chạy lần lượt và luôn trả về đơn vị A.
test.describe("chuyển đơn vị qua giao diện", () => {
  test.describe.configure({ mode: "serial" });

  const restoreA = async (page: Page) => {
    const t = await loginApi(page.request, "multi2");
    await page.request.post("/api/auth/switch-tenant", { headers: bearer(t), data: { tenantId: TENANT_A, refreshToken: t.refreshToken } });
  };

  test("người một đơn vị: header chỉ hiện tên đơn vị, không bấm được", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/");
    await expect(page.getByLabel("Đơn vị làm việc: Thư viện trung tâm")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Đơn vị làm việc/ })).toHaveCount(0);
  });

  test("bộ chọn ở header: chọn đơn vị khác thì tải lại trình duyệt, giữ nguyên đường dẫn và đổi tên đơn vị", async ({ page }) => {
    await restoreA(page);
    await loginAs(page, "multi2");
    await gotoApp(page, "/catalog");
    try {
      await page.getByRole("button", { name: "Đơn vị làm việc: Thư viện trung tâm" }).click();
      const reloaded = page.waitForEvent("load");
      await page.getByRole("menuitem", { name: /Thư viện cơ sở 2/ }).click();
      await reloaded;
      await expect(page).toHaveURL(/\/catalog$/);
      await expect(page.getByRole("button", { name: "Đơn vị làm việc: Thư viện cơ sở 2" })).toBeVisible();
      // Tải lại tiếp: refresh token cấp token mới thuộc đơn vị B.
      await page.reload();
      await expect(page.getByRole("button", { name: "Đơn vị làm việc: Thư viện cơ sở 2" })).toBeVisible();
    } finally {
      await restoreA(page);
    }
  });

  test("menu người dùng: Chuyển đơn vị mở hộp thoại, chọn rồi Chuyển", async ({ page }) => {
    await restoreA(page);
    await loginAs(page, "multi2");
    await gotoApp(page, "/");
    try {
      await openUserMenu(page);
      await expect(page.getByText(/^Đơn vị: Thư viện trung tâm$/)).toBeVisible();
      await page.getByRole("button", { name: "Chuyển đơn vị" }).click();
      const dialog = page.getByRole("dialog", { name: "Chọn đơn vị làm việc" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Đang làm việc")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Chuyển" })).toBeDisabled();
      await dialog.getByText("Thư viện cơ sở 2").click();
      const reloaded = page.waitForEvent("load");
      await dialog.getByRole("button", { name: "Chuyển" }).click();
      await reloaded;
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("button", { name: "Đơn vị làm việc: Thư viện cơ sở 2" })).toBeVisible();
    } finally {
      await restoreA(page);
    }
  });
});

test.describe("khung dùng chung: chuông và menu người dùng", () => {
  test("chuông thông báo hiện số chưa đọc, mở danh sách, bấm một mục thì gọi BE đánh dấu đã đọc và số giảm", async ({ page }) => {
    // `multi` (mặc định 1 chưa đọc, không test nào khác đọc thông báo của họ): bấm mục làm đổi trạng thái mock theo người.
    await loginAs(page, "multi");
    await gotoApp(page, "/");
    const bell = page.getByRole("button", { name: /^Thông báo, \d+ chưa đọc$/ });
    await expect(bell).toHaveAccessibleName("Thông báo, 1 chưa đọc");
    await bell.click();
    const pop = page.locator(".ant-popover");
    await expect(pop.getByText("Sách bạn đặt trước đã sẵn sàng nhận.")).toBeVisible();
    await expect(pop.getByRole("link", { name: "Xem tất cả" })).toHaveAttribute("href", "/notifications");
    // Mở popover KHÔNG tự đánh dấu đã đọc (không còn mốc "đã xem lần cuối").
    await expect(bell).toHaveAccessibleName("Thông báo, 1 chưa đọc");
    await expect(pop.getByRole("button", { name: "Đọc hết" })).toBeEnabled();

    const read = page.waitForRequest((r) => r.method() === "POST" && /\/api\/notifications\/[^/]+\/read$/.test(r.url()));
    await pop.getByTestId("bell-item").filter({ hasText: "Sách bạn đặt trước đã sẵn sàng nhận." }).click();
    await read;
    await expect(bell).toHaveAccessibleName("Thông báo, 0 chưa đọc");
    await expect(pop.getByRole("button", { name: "Đọc hết" })).toBeDisabled();
    // Số lấy từ BE nên giữ nguyên sau khi tải lại.
    await page.reload();
    await expect(page.getByRole("button", { name: "Thông báo, 0 chưa đọc" })).toBeVisible();
  });

  test("menu người dùng có Hồ sơ, Đổi mật khẩu, Đăng xuất và không có Chuyển đơn vị khi chỉ có một đơn vị", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/");
    await openUserMenu(page);
    await expect(page.getByRole("link", { name: "Hồ sơ của tôi" })).toHaveAttribute("href", "/profile");
    await expect(page.locator(".ant-dropdown").getByRole("link", { name: "Đổi mật khẩu" })).toHaveAttribute("href", "/change-password");
    await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Chuyển đơn vị" })).toHaveCount(0);
  });

  test("người thuộc hai đơn vị thấy Chuyển đơn vị và tên đơn vị hiện tại trong menu", async ({ page }) => {
    await loginAs(page, "multi");
    await gotoApp(page, "/");
    await openUserMenu(page);
    await expect(page.getByRole("button", { name: "Chuyển đơn vị" })).toBeVisible();
    await expect(page.getByText(/^Đơn vị: /)).toBeVisible();
  });

  test("sidebar không còn khối người dùng/đăng xuất (chuyển sang menu ở header)", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/");
    await expect(sidebar(page).getByRole("button", { name: "Đăng xuất" })).toHaveCount(0);
    await expect(sidebar(page).getByText("member", { exact: true })).toHaveCount(0);
  });
});
