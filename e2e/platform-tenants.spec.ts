import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar } from "./helpers";

// Quản trị đơn vị và tổ chức của platform admin (G7). Mock: e2e/mock/platform-tenants.mjs.
// Dữ liệu dùng chung giữa các worker: mỗi test tạo bản ghi riêng (hậu tố duy nhất), không giả định tổng số.

let n = 0;
const uid = () => `${(Date.now() % 1e7).toString(36)}${process.env.TEST_PARALLEL_INDEX ?? 0}${++n}`;
const main = (page: Page) => page.getByRole("main");
// Trang chi tiết nằm trong modal (danh sách ở nền): locator chi tiết scope vào dialog đầu tiên (form con mở sau nên đứng sau).
const detail = (page: Page) => page.getByRole("dialog").first();

async function platformHeaders(page: Page) {
  return bearer(await loginApi(page.request, "platform"));
}

async function createTenantApi(page: Page, code = `t-${uid()}`, extra: Record<string, unknown> = {}) {
  const res = await page.request.post("/api/platform/tenants", {
    headers: await platformHeaders(page),
    data: {
      code,
      name: `Đơn vị ${code}`,
      newAdmin: { username: `adm-${code}`, fullName: "Quản trị Test", email: `${code}@example.vn`, temporaryPassword: "Temp@12345" },
      ...extra,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; code: string; name: string };
}

test.describe("nền tảng: quyền vào Đơn vị và Tổ chức", () => {
  test("platform admin thấy mục trên sidebar, tenant admin thì không và bị chặn khi vào thẳng URL", async ({ page }) => {
    await gotoAs(page, "platform", "/");
    await expect(sidebar(page).getByRole("link", { name: "Đơn vị (tenant)" })).toHaveAttribute("href", "/platform/tenants");
    await expect(sidebar(page).getByRole("link", { name: "Tổ chức" })).toHaveAttribute("href", "/platform/organizations");
    await gotoAs(page, "admin", "/platform/tenants");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Đơn vị (tenant)" })).toHaveCount(0);
  });
});

test.describe("nền tảng: danh sách đơn vị", () => {
  test("lọc theo từ khóa, trạng thái, tổ chức; chip, đếm, xóa bộ lọc; bộ lọc nằm trên URL", async ({ page }) => {
    await gotoAs(page, "platform", "/platform/tenants");
    await expect(main(page).getByRole("link", { name: "Thư viện Seed" })).toBeVisible();

    await main(page).getByRole("searchbox").fill("seed-lib");
    await expect(page).toHaveURL(/q=seed-lib/);
    await expect(main(page).getByTestId("tenant-count")).toHaveText("1 đơn vị");
    await expect(main(page).getByRole("link", { name: "Thư viện Seed" })).toBeVisible();
    await expect(main(page).getByRole("searchbox")).toHaveValue("seed-lib"); // giá trị lọc hiện trong ô, không có chip

    await main(page).getByRole("button", { name: "Xóa bộ lọc" }).first().click();
    await expect(page).not.toHaveURL(/q=/);

    await page.goto("/platform/tenants?status=SUSPENDED");
    await expect(main(page).getByRole("link", { name: "Thư viện Ngưng" })).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Thư viện Seed" })).toHaveCount(0);
    await expect(main(page).getByText("Tạm ngưng").first()).toBeVisible();

    await page.goto("/platform/tenants?q=khong-ton-tai-xyz");
    await expect(main(page).getByText("Không có đơn vị khớp bộ lọc.")).toBeVisible();
  });

  test("phân trang và đổi kích thước trang giữ bộ lọc", async ({ page }) => {
    await gotoAs(page, "platform", "/platform/tenants?q=bulk-");
    await expect(main(page).getByTestId("tenant-count")).toHaveText("24 đơn vị");
    await expect(main(page).getByRole("link", { name: /Đơn vị hàng loạt/ })).toHaveCount(20);
    await main(page).getByRole("listitem", { name: "2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/q=bulk-/);
    await expect(main(page).getByRole("link", { name: /Đơn vị hàng loạt/ })).toHaveCount(4);
  });
});

test.describe("nền tảng: tạo và quản lý đơn vị", () => {
  test("tạo đơn vị với module SALES và quản trị viên mới, chuyển sang trang chi tiết", async ({ page }) => {
    const code = `t-${uid()}`;
    await gotoAs(page, "platform", "/platform/tenants");
    await main(page).getByRole("button", { name: "Tạo đơn vị" }).click();
    const dlg = page.getByRole("dialog", { name: "Tạo đơn vị" });
    await dlg.getByLabel("Mã đơn vị").fill(code);
    await dlg.getByLabel("Tên đơn vị").fill(`Thư viện ${code}`);
    await dlg.getByLabel("Bán hàng").check();
    await dlg.getByLabel("Tên đăng nhập quản trị").fill(`adm-${code}`);
    await dlg.getByLabel("Họ tên quản trị").fill("Quản trị Mới");
    await dlg.getByLabel("Email quản trị").fill(`${code}@example.vn`);
    await dlg.getByLabel("Mật khẩu tạm").fill("Temp@12345");
    await dlg.getByRole("button", { name: "Tạo" }).click();
    await expect(page).toHaveURL(/\/platform\/tenants\/[0-9a-f-]+$/);
    await expect(page.getByRole("dialog").getByRole("heading", { name: `Thư viện ${code}` })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("dialog").getByText("Bán hàng").first()).toBeVisible();
  });

  test("mã trùng hiện thông báo tiếng Việt và giữ dữ liệu đã nhập", async ({ page }) => {
    await gotoAs(page, "platform", "/platform/tenants");
    await main(page).getByRole("button", { name: "Tạo đơn vị" }).click();
    const dlg = page.getByRole("dialog", { name: "Tạo đơn vị" });
    await dlg.getByLabel("Mã đơn vị").fill("seed-lib");
    await dlg.getByLabel("Tên đơn vị").fill("Trùng mã");
    await dlg.getByLabel("Tên đăng nhập quản trị").fill(`adm-${uid()}`);
    await dlg.getByLabel("Họ tên quản trị").fill("Quản trị");
    await dlg.getByLabel("Email quản trị").fill("x@example.vn");
    await dlg.getByLabel("Mật khẩu tạm").fill("Temp@12345");
    await dlg.getByRole("button", { name: "Tạo" }).click();
    await expect(dlg.getByText("Mã đơn vị này đã được dùng")).toBeVisible();
    await expect(dlg.getByLabel("Tên đơn vị")).toHaveValue("Trùng mã");
  });

  test("bật SALES, tắt LENDING, không tắt được module cuối", async ({ page }) => {
    const t = await createTenantApi(page);
    await gotoAs(page, "platform", `/platform/tenants/${t.id}`);
    const lending = detail(page).getByRole("switch", { name: "Module Mượn trả" });
    const sales = detail(page).getByRole("switch", { name: "Module Bán hàng" });
    await expect(lending).toBeChecked();
    await expect(sales).not.toBeChecked();
    await sales.click();
    await expect(sales).toBeChecked();
    await lending.click();
    await expect(lending).not.toBeChecked();
    // Chỉ còn SALES: công tắc cuối bị khóa ở UI, BE trả 409 nếu gọi thẳng.
    await expect(sales).toBeDisabled();
    const res = await page.request.delete(`/api/platform/tenants/${t.id}/modules/SALES`, { headers: await platformHeaders(page) });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe("TENANT_MODULE_REQUIRED");
  });

  test("tạm ngưng rồi kích hoạt lại", async ({ page }) => {
    const t = await createTenantApi(page);
    await gotoAs(page, "platform", `/platform/tenants/${t.id}`);
    await detail(page).getByRole("button", { name: "Tạm ngưng" }).click();
    await page.getByRole("button", { name: "Tạm ngưng" }).last().click();
    await expect(detail(page).getByRole("button", { name: "Kích hoạt" })).toBeVisible();
    await detail(page).getByRole("button", { name: "Kích hoạt" }).click();
    await page.getByRole("button", { name: "Kích hoạt" }).last().click();
    await expect(detail(page).getByRole("button", { name: "Tạm ngưng" })).toBeVisible();
  });

  test("sửa tên đơn vị", async ({ page }) => {
    const t = await createTenantApi(page);
    await gotoAs(page, "platform", `/platform/tenants/${t.id}`);
    await detail(page).getByRole("button", { name: "Sửa thông tin" }).click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin đơn vị" });
    await dlg.getByLabel("Tên đơn vị").fill(`Tên mới ${t.code}`);
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(detail(page).getByRole("heading", { name: `Tên mới ${t.code}` })).toBeVisible();
  });

  test("thêm và gỡ quản trị viên", async ({ page }) => {
    const t = await createTenantApi(page);
    await gotoAs(page, "platform", `/platform/tenants/${t.id}?tab=admins`);
    const extra = `adm2-${uid()}`;
    await detail(page).getByRole("button", { name: "Thêm quản trị viên" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm quản trị viên" });
    await dlg.getByLabel("Tên đăng nhập").fill(extra);
    await dlg.getByLabel("Họ tên").fill("Quản trị Hai");
    await dlg.getByLabel("Email").fill(`${extra}@example.vn`);
    await dlg.getByLabel("Mật khẩu tạm").fill("Temp@12345");
    await dlg.getByRole("button", { name: "Thêm" }).click();
    const row = detail(page).getByRole("row", { name: new RegExp(extra) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Gỡ" }).click();
    await page.getByRole("button", { name: "Gỡ" }).last().click();
    await expect(detail(page).getByRole("row", { name: new RegExp(extra) })).toHaveCount(0);
  });

  test("chi tiết đơn vị mở dạng modal trên danh sách, đóng bằng X quay về danh sách", async ({ page }) => {
    const t = await createTenantApi(page);
    await gotoAs(page, "platform", `/platform/tenants/${t.id}`);
    const dlg = detail(page);
    await expect(dlg.getByRole("heading", { name: `Đơn vị ${t.code}` })).toBeVisible();
    await expect(main(page).getByRole("heading", { name: "Đơn vị (tenant)" }).or(main(page).getByTestId("tenant-count")).first()).toBeVisible();
    await dlg.locator(".ant-modal-close").click();
    await expect(page).toHaveURL(/\/platform\/tenants$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("đơn vị không tồn tại hiện trang không tìm thấy", async ({ page }) => {
    await gotoAs(page, "platform", "/platform/tenants/a0000000-0000-4000-8000-999999999999");
    await expect(detail(page).getByText("Không tìm thấy đơn vị")).toBeVisible();
  });
});

test.describe("nền tảng: tổ chức", () => {
  test("thêm, đổi tên và tìm tổ chức", async ({ page }) => {
    const name = `Tổ chức ${uid()}`;
    await gotoAs(page, "platform", "/platform/organizations");
    await main(page).getByRole("button", { name: "Thêm tổ chức" }).click();
    let dlg = page.getByRole("dialog", { name: "Thêm tổ chức" });
    await dlg.getByLabel("Tên tổ chức").fill(name);
    await dlg.getByRole("button", { name: "Tạo" }).click();
    await expect(main(page).getByRole("cell", { name })).toBeVisible();

    await main(page).getByRole("searchbox").fill(name);
    await expect(main(page).getByTestId("org-count")).toContainText("1 /");
    await main(page).getByRole("button", { name: "Đổi tên" }).click();
    dlg = page.getByRole("dialog", { name: "Đổi tên tổ chức" });
    await dlg.getByLabel("Tên tổ chức").fill(`${name} (mới)`);
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(main(page).getByRole("cell", { name: `${name} (mới)` })).toBeVisible();
  });
});
