import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar } from "./helpers";

// Hợp đồng thuê dịch vụ (ADR-0012, F6). Mock: e2e/mock/platform-contracts.mjs. Mỗi test tạo đơn vị riêng.

let n = 0;
const uid = () => `${(Date.now() % 1e7).toString(36)}${process.env.TEST_PARALLEL_INDEX ?? 0}${++n}`;
const main = (page: Page) => page.getByRole("main");
const dmy = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

async function createTenant(page: Page) {
  const code = `ct-${uid()}`;
  const res = await page.request.post("/api/platform/tenants", {
    headers: bearer(await loginApi(page.request, "platform")),
    data: {
      code,
      name: `Đơn vị ${code}`,
      newAdmin: { username: `adm-${code}`, fullName: "Quản trị Test", email: `${code}@example.vn`, temporaryPassword: "Temp@12345" },
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; code: string; name: string };
}

async function pickDate(dlg: ReturnType<Page["getByRole"]>, label: string, text: string) {
  const input = dlg.getByLabel(label);
  await input.fill(text);
  await input.press("Enter");
}

test.describe("nền tảng: hợp đồng của đơn vị", () => {
  test("tạo nháp, kích hoạt, ghi thanh toán, đảo toàn phần", async ({ page }) => {
    const t = await createTenant(page);
    await gotoAs(page, "platform", `/platform/tenants/${t.id}?tab=contracts`);
    await expect(main(page).getByTestId("no-contract-warning")).toBeVisible();

    await main(page).getByRole("button", { name: "Tạo hợp đồng" }).click();
    const dlg = page.getByRole("dialog", { name: "Tạo hợp đồng nháp" });
    await dlg.getByLabel("Tên hợp đồng").fill("Gói thử nghiệm");
    await dlg.getByLabel("Mượn trả").check();
    await pickDate(dlg, "Ngày bắt đầu", dmy(-5));
    await pickDate(dlg, "Ngày kết thúc", dmy(60));
    await dlg.getByLabel("Tổng tiền (VND)").fill("1000000");
    await dlg.getByRole("button", { name: "Tạo nháp" }).click();

    await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]+$/);
    await expect(main(page).getByRole("heading", { name: "Gói thử nghiệm" })).toBeVisible();
    await expect(main(page).getByText("Nháp", { exact: true }).first()).toBeVisible();
    // Hợp đồng nháp chưa ghi thanh toán được.
    await expect(main(page).getByRole("button", { name: "Ghi thanh toán" })).toHaveCount(0);

    await main(page).getByRole("button", { name: "Kích hoạt" }).click();
    await page.getByRole("button", { name: "Kích hoạt" }).last().click();
    await expect(main(page).getByText("Hiệu lực: đang hiệu lực").first()).toBeVisible();

    await main(page).getByRole("button", { name: "Ghi thanh toán" }).click();
    const pay = page.getByRole("dialog", { name: "Ghi thanh toán" });
    await pay.getByLabel("Số tiền (VND)").fill("400000");
    await pay.getByLabel("Mã tham chiếu").fill("CK-TEST");
    await pay.getByRole("button", { name: "Ghi thanh toán" }).click();
    await expect(main(page).getByText("CK-TEST").first()).toBeVisible();
    await expect(main(page).getByTestId("sum-paid").filter({ hasText: "400.000" })).toBeVisible();
    await expect(main(page).getByTestId("sum-outstanding").filter({ hasText: "600.000" })).toBeVisible();

    await main(page).getByRole("button", { name: "Đảo", exact: true }).click();
    await page.getByRole("button", { name: "Đảo", exact: true }).last().click();
    await expect(main(page).getByText("Đã đảo").first()).toBeVisible();
    await expect(main(page).getByText("Dòng đảo").first()).toBeVisible();
    // Dòng đã đảo và dòng đảo không còn nút Đảo; tổng đã thu về 0.
    await expect(main(page).getByRole("button", { name: "Đảo", exact: true })).toHaveCount(0);
    await expect(main(page).getByTestId("sum-paid").filter({ hasText: /^Đã thu\s*0\s*₫/ })).toBeVisible();

    // Kích hoạt chồng thời gian bị chặn bằng thông điệp tiếng Việt.
    const second = await page.request.post(`/api/platform/tenants/${t.id}/contracts`, {
      headers: bearer(await loginApi(page.request, "platform")),
      data: { name: "Chồng", modules: ["LENDING"], startDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), endDate: new Date(Date.now() + 86_400_000 * 30).toISOString().slice(0, 10), totalAmount: 1 },
    });
    const sid = ((await second.json()) as { id: string }).id;
    await page.goto(`/platform/tenants/${t.id}/contracts/${sid}`);
    await main(page).getByRole("button", { name: "Kích hoạt" }).click();
    await page.getByRole("button", { name: "Kích hoạt" }).last().click();
    await expect(page.getByText("chồng với một hợp đồng đang hiệu lực khác")).toBeVisible();
  });

  test("hủy hợp đồng cần lý do và hiển thị lý do", async ({ page }) => {
    const t = await createTenant(page);
    const res = await page.request.post(`/api/platform/tenants/${t.id}/contracts`, {
      headers: bearer(await loginApi(page.request, "platform")),
      data: { name: "Sẽ hủy", modules: ["LENDING"], startDate: "2030-01-01", endDate: "2030-12-31", totalAmount: 0 },
    });
    const id = ((await res.json()) as { id: string }).id;
    await gotoAs(page, "platform", `/platform/tenants/${t.id}/contracts/${id}`);
    await main(page).getByRole("button", { name: "Hủy hợp đồng" }).click();
    const dlg = page.getByRole("dialog", { name: "Hủy hợp đồng" });
    await dlg.getByRole("button", { name: "Xác nhận hủy" }).click();
    await expect(dlg.getByText("Nhập lý do hủy")).toBeVisible();
    await dlg.getByLabel("Lý do hủy").fill("Khách đổi ý");
    await dlg.getByRole("button", { name: "Xác nhận hủy" }).click();
    await expect(main(page).getByText("Lý do hủy: Khách đổi ý")).toBeVisible();
    await expect(main(page).getByText("Đã hủy").first()).toBeVisible();
  });

  test("trang sắp hết hạn và nguyên nhân tạm ngưng", async ({ page }) => {
    await gotoAs(page, "platform", "/platform/contracts");
    await expect(sidebar(page).getByRole("link", { name: "Hợp đồng", exact: true })).toHaveAttribute("href", "/platform/contracts");
    await expect(main(page).getByRole("link", { name: "Thư viện trung tâm" })).toBeVisible();
    await expect(main(page).getByTestId("days-left").first()).toContainText("ngày");

    await page.goto("/platform/tenants?status=SUSPENDED");
    await expect(main(page).getByText("Tạm ngưng do hết hạn hợp đồng").first()).toBeVisible();
    await main(page).getByRole("link", { name: "Thư viện Ngưng" }).click();
    await expect(main(page).getByTestId("suspension-cause")).toContainText("tự được kích hoạt lại");
  });
});

test.describe("tenant admin: hợp đồng chỉ đọc", () => {
  test("hiện hợp đồng hiện tại, tổng tiền, banner còn <=30 ngày; không lộ ghi chú nội bộ", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/contract");
    await expect(main(page).getByRole("heading", { name: "Hợp đồng dịch vụ" })).toBeVisible();
    await expect(main(page).getByText("Gói chuẩn 2026").first()).toBeVisible();
    await expect(main(page).getByTestId("expiring-banner")).toBeVisible();
    await expect(main(page).getByText("12.000.000").first()).toBeVisible();
    await expect(main(page).getByText("Ghi chú nội bộ")).toHaveCount(0);
    await expect(main(page).getByText("Gói 2025").first()).toBeVisible(); // lịch sử
    await expect(main(page).getByRole("button")).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: "Hợp đồng", exact: true })).toHaveAttribute("href", "/admin/contract");
  });

  test("đơn vị chưa có hợp đồng: trạng thái rỗng thân thiện, không phải lỗi", async ({ page }) => {
    await gotoAs(page, "nocontract", "/admin/contract");
    await expect(main(page).getByTestId("no-current-contract")).toBeVisible();
    await expect(main(page).getByText("Chưa có hợp đồng nào.")).toBeVisible();
  });

  test("người không có khóa: ẩn mục nav và bị chặn khi vào thẳng", async ({ page }) => {
    await gotoAs(page, "staff", "/admin/contract");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Hợp đồng", exact: true })).toHaveCount(0);
  });
});
