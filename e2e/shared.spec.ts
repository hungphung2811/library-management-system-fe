import { expect, test } from "@playwright/test";
import { SHELL, loginAs } from "./helpers";

// Hạ tầng dùng chung của pha 0: BFF, làm mới phiên dạng JSON, chuyển đơn vị, chuông + menu người dùng.
test.describe("BFF và session dùng chung", () => {
  test("BFF không có cookie thì trả 401", async ({ request }) => {
    const res = await request.get(`${SHELL}/api/bff/books`);
    expect(res.status()).toBe(401);
  });

  test("BFF gắn Bearer và mã hóa lại từng đoạn đường dẫn (barcode chứa ? và #)", async ({ page }) => {
    await loginAs(page, "librarian");
    const ok = await page.request.get(`${SHELL}/api/bff/book-copies/by-barcode/TV00010001`);
    expect(ok.status()).toBe(200);
    expect((await ok.json()).barcode).toBe("TV00010001");

    // Nếu không mã hóa lại thì "?" biến thành query và "#" thành fragment, mock sẽ trả sách/bản sao khác hoặc 404 khác.
    const odd = await page.request.get(`${SHELL}/api/bff/book-copies/by-barcode/${encodeURIComponent("BC?x#y")}`);
    expect(odd.status()).toBe(404);
    expect((await odd.json()).code).toBe("NOT_FOUND");
  });

  test("POST /api/session/refresh: 204 và cookie mới khi còn refresh token, 401 khi không", async ({ page, request }) => {
    const anon = await request.post(`${SHELL}/api/session/refresh`);
    expect(anon.status()).toBe(401);

    await loginAs(page, "admin");
    await page.context().clearCookies({ name: "lms_at" });
    const res = await page.request.post(`${SHELL}/api/session/refresh`);
    expect(res.status()).toBe(204);
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === "lms_at")).toBeTruthy();
  });

  test("GET /api/session/refresh vẫn chống open redirect", async ({ page }) => {
    await loginAs(page, "admin");
    const res = await page.request.get(`${SHELL}/api/session/refresh?next=//evil.example.com`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`${SHELL}/`);
  });

  test("switch-tenant: tenantId sai dạng trả 400, không đăng nhập trả 401", async ({ page, request }) => {
    const anon = await request.post(`${SHELL}/api/session/switch-tenant`, { data: { tenantId: "11111111-1111-4111-8111-111111111111" } });
    expect(anon.status()).toBe(401);

    await loginAs(page, "member");
    const bad = await page.request.post(`${SHELL}/api/session/switch-tenant`, { data: { tenantId: "khong-phai-uuid" } });
    expect(bad.status()).toBe(400);
  });

  test("switch-tenant: người không thuộc đơn vị bị 403 và nhận lại lỗi của BE", async ({ page }) => {
    await loginAs(page, "member");
    const res = await page.request.post(`${SHELL}/api/session/switch-tenant`, {
      data: { tenantId: "22222222-2222-4222-8222-222222222222" },
    });
    expect(res.status()).toBe(403);
  });

  test("switch-tenant: chuyển thành công đặt cookie mới mang tenantId mới (rồi chuyển lại)", async ({ page }) => {
    const A = "11111111-1111-4111-8111-111111111111";
    const B = "22222222-2222-4222-8222-222222222222";
    const claim = async () => {
      const at = (await page.context().cookies()).find((c) => c.name === "lms_at")!.value;
      return JSON.parse(Buffer.from(at.split(".")[1], "base64url").toString()).tenantId as string;
    };
    await loginAs(page, "multi");
    try {
      const res = await page.request.post(`${SHELL}/api/session/switch-tenant`, { data: { tenantId: B } });
      expect(res.status()).toBe(200);
      expect(await claim()).toBe(B);
    } finally {
      // Trả mock về đơn vị gốc để các test khác dùng user multi không bị ảnh hưởng.
      await page.request.post(`${SHELL}/api/session/switch-tenant`, { data: { tenantId: A } });
    }
    expect(await claim()).toBe(A);
  });
});

test.describe("khung dùng chung: chuông và menu người dùng", () => {
  test("chuông thông báo hiện số chưa đọc và mở được danh sách", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/");
    const bell = page.getByRole("button", { name: /^Thông báo, \d+ chưa đọc$/ });
    await expect(bell).toHaveAccessibleName("Thông báo, 1 chưa đọc");
    await bell.click();
    await expect(page.locator(".ant-popover").getByText("Sách bạn đặt trước đã sẵn sàng nhận.")).toBeVisible();
    await expect(page.locator(".ant-popover").getByRole("link", { name: "Xem tất cả" })).toHaveAttribute("href", "/notifications");
    // Mở popover cập nhật mốc "đã xem lần cuối" nên số chưa đọc về 0.
    await expect(bell).toHaveAccessibleName("Thông báo, 0 chưa đọc");
  });

  test("menu người dùng có Hồ sơ, Đổi mật khẩu, Đăng xuất và không có Chuyển đơn vị khi chỉ có một đơn vị", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/");
    await page.getByRole("button", { name: "Tài khoản của tôi" }).click();
    await expect(page.getByRole("link", { name: "Hồ sơ của tôi" })).toHaveAttribute("href", "/profile");
    await expect(page.getByRole("link", { name: "Đổi mật khẩu" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Đăng xuất" }).last()).toBeVisible();
    await expect(page.getByRole("button", { name: "Chuyển đơn vị" })).toHaveCount(0);
  });

  test("người thuộc hai đơn vị thấy Chuyển đơn vị và tên đơn vị hiện tại trong menu", async ({ page }) => {
    await loginAs(page, "multi");
    await page.goto("/");
    await page.getByRole("button", { name: "Tài khoản của tôi" }).click();
    await expect(page.getByRole("button", { name: "Chuyển đơn vị" })).toBeVisible();
    await expect(page.getByText(/^Đơn vị: /)).toBeVisible();
  });
});
