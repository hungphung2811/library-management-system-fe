import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar } from "./helpers";

// Origin website theo tenant (ADR-0013). Mock: e2e/mock/platform-origins.mjs.
// Dữ liệu dùng chung giữa các worker: mỗi test tạo đơn vị và origin riêng (hậu tố duy nhất).

let n = 0;
const uid = () => `${(Date.now() % 1e7).toString(36)}${process.env.TEST_PARALLEL_INDEX ?? 0}${++n}`;
const main = (page: Page) => page.getByRole("main");
const table = (page: Page) => main(page).getByRole("table");

async function createTenantApi(page: Page, code = `o-${uid()}`) {
  const res = await page.request.post("/api/platform/tenants", {
    headers: bearer(await loginApi(page.request, "platform")),
    data: {
      code,
      name: `Đơn vị ${code}`,
      newAdmin: { username: `adm-${code}`, fullName: "Quản trị Test", email: `${code}@example.vn`, temporaryPassword: "Temp@12345" },
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string };
}

async function addOrigin(page: Page, value: string) {
  await main(page).getByRole("textbox", { name: "Địa chỉ origin" }).fill(value);
  await main(page).getByRole("button", { name: "Thêm origin" }).click();
}

test.describe("origin website: platform admin", () => {
  test("thêm, chuẩn hóa, tắt/bật và xóa origin; hiển thị đã dùng x/10 và ghi chú CORS", async ({ page }) => {
    const t = await createTenantApi(page);
    const host = `shop-${uid()}.example.vn`;
    await gotoAs(page, "platform", `/platform/tenants/${t.id}?tab=origins`);
    await expect(main(page).getByTestId("origin-note")).toContainText("chỉ kiểm soát CORS");
    await expect(main(page).getByTestId("origin-note")).toContainText("60 giây");
    await expect(main(page).getByTestId("origin-usage")).toHaveText("Đã dùng 0/10");

    await addOrigin(page, `  HTTPS://${host.toUpperCase()}/ `);
    const origin = `https://${host}`;
    await expect(table(page).getByText(origin)).toBeVisible();
    await expect(main(page).getByTestId("origin-usage")).toHaveText("Đã dùng 1/10");

    const sw = table(page).getByRole("switch", { name: `Bật origin ${origin}` });
    await expect(sw).toBeChecked();
    await sw.click();
    await expect(sw).not.toBeChecked();
    await expect(table(page).getByText("Đang tắt")).toBeVisible();
    await sw.click();
    await expect(sw).toBeChecked();

    await table(page).getByRole("button", { name: `Xóa origin ${origin}` }).click();
    await page.getByRole("button", { name: "Xóa", exact: true }).last().click();
    await expect(table(page).getByText(origin)).toHaveCount(0);
    await expect(main(page).getByTestId("origin-usage")).toHaveText("Đã dùng 0/10");
  });

  test("lỗi: FE chặn thiếu scheme; BE trả lý do chi tiết cho path, wildcard, http; trùng chính tenant", async ({ page }) => {
    const t = await createTenantApi(page);
    await gotoAs(page, "platform", `/platform/tenants/${t.id}?tab=origins`);

    await addOrigin(page, "shop.example.vn");
    await expect(main(page).getByTestId("origin-input-error")).toContainText("bắt đầu bằng https://");

    await addOrigin(page, `https://a-${uid()}.example.vn/duong-dan`);
    await expect(main(page).getByTestId("origin-error")).toContainText("không được có đường dẫn");
    await addOrigin(page, "https://*.example.vn");
    await expect(main(page).getByTestId("origin-error")).toContainText("wildcard");
    await addOrigin(page, `http://b-${uid()}.example.vn`);
    await expect(main(page).getByTestId("origin-error")).toContainText("Chỉ nhận https");

    const ok = `https://c-${uid()}.example.vn`;
    await addOrigin(page, ok);
    await expect(table(page).getByText(ok)).toBeVisible();
    await addOrigin(page, ok);
    await expect(main(page).getByTestId("origin-error")).toContainText("đã được khai báo");
  });

  test("trùng với tenant khác: báo đã được đơn vị khác dùng kèm lối tắt tới đơn vị đó", async ({ page }) => {
    const a = await createTenantApi(page);
    const b = await createTenantApi(page);
    const origin = `https://dup-${uid()}.example.vn`;
    await gotoAs(page, "platform", `/platform/tenants/${a.id}?tab=origins`);
    await addOrigin(page, origin);
    await expect(table(page).getByText(origin)).toBeVisible();

    await page.goto(`/platform/tenants/${b.id}?tab=origins`);
    await addOrigin(page, origin);
    await expect(main(page).getByTestId("origin-error")).toContainText("đã được đơn vị khác dùng");
    await main(page).getByRole("link", { name: "Mở đơn vị đang dùng" }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/tenants/${a.id}[?]tab=origins`));
    await expect(table(page).getByText(origin)).toBeVisible();
  });

  test("vượt giới hạn 10 origin: ô nhập bị khóa, API trả ORIGIN_LIMIT_EXCEEDED", async ({ page }) => {
    const t = await createTenantApi(page);
    const headers = bearer(await loginApi(page.request, "platform"));
    const base = `/api/platform/tenants/${t.id}/storefront-origins`;
    for (let i = 0; i < 10; i++) {
      const res = await page.request.post(base, { headers, data: { origin: `https://lim-${uid()}.example.vn` } });
      expect(res.status()).toBe(201);
    }
    const over = await page.request.post(base, { headers, data: { origin: `https://lim-${uid()}.example.vn` } });
    expect(over.status()).toBe(409);
    expect((await over.json()).code).toBe("ORIGIN_LIMIT_EXCEEDED");

    await gotoAs(page, "platform", `/platform/tenants/${t.id}?tab=origins`);
    await expect(main(page).getByTestId("origin-usage")).toHaveText("Đã dùng 10/10");
    await expect(main(page).getByRole("textbox", { name: "Địa chỉ origin" })).toBeDisabled();
    await expect(main(page).getByRole("button", { name: "Thêm origin" })).toBeDisabled();
  });
});

test.describe("origin website: tenant admin chỉ đọc", () => {
  test("tenant có SALES thấy mục Website, danh sách và không có thao tác ghi", async ({ page }) => {
    await gotoAs(page, "salesadmin", "/");
    await sidebar(page).getByRole("link", { name: "Website" }).click();
    await expect(page).toHaveURL(/\/admin\/storefront-origins/);
    await expect(table(page).getByText("https://shop.main.example.vn")).toBeVisible();
    await expect(table(page).getByText("https://old.main.example.vn")).toBeVisible();
    await expect(table(page).getByText("Đang bật")).toBeVisible();
    await expect(table(page).getByText("Đang tắt")).toBeVisible();
    await expect(main(page).getByTestId("origin-note")).toContainText("60 giây");
    await expect(main(page).getByText("liên hệ nhà cung cấp dịch vụ")).toBeVisible();
    await expect(main(page).getByRole("button")).toHaveCount(0);
    await expect(main(page).getByRole("switch")).toHaveCount(0);
    await expect(main(page).getByRole("textbox")).toHaveCount(0);
  });

  test("tenant không có SALES: ẩn mục nav; người thiếu khóa vào thẳng URL bị chặn", async ({ page }) => {
    await gotoAs(page, "admin", "/");
    await expect(sidebar(page).getByRole("link", { name: "Quản trị" }).or(sidebar(page).getByText("Quản trị")).first()).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Website" })).toHaveCount(0);
    await gotoAs(page, "seller", "/admin/storefront-origins");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Website" })).toHaveCount(0);
  });
});
