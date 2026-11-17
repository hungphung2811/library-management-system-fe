import { expect, test, type Page } from "@playwright/test";
import { gotoAs, sidebar } from "./helpers";

// Wizard "Triển khai khách mới" (/platform/onboarding). Mock: platform-tenants, platform-contracts, platform-origins.
// Dữ liệu dùng chung giữa các worker: mỗi test dùng mã đơn vị riêng (hậu tố duy nhất).

let n = 0;
const uid = () => `${(Date.now() % 1e7).toString(36)}${process.env.TEST_PARALLEL_INDEX ?? 0}${++n}`;
const main = (page: Page) => page.getByRole("main");
const dmy = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const next = (page: Page) => main(page).getByRole("button", { name: "Tiếp tục" }).click();

async function fillTenant(page: Page, code: string) {
  await main(page).getByLabel("Mã đơn vị").fill(code);
  await main(page).getByLabel("Tên đơn vị").fill(`Khách ${code}`);
  await next(page);
}

async function fillAdmin(page: Page, code: string, modules: string[]) {
  for (const m of ["Mượn trả", "Bán hàng"]) {
    const box = main(page).getByLabel(m, { exact: true });
    if (modules.includes(m)) await box.check();
    else await box.uncheck();
  }
  await main(page).getByLabel("Tên đăng nhập quản trị").fill(`adm-${code}`);
  await main(page).getByLabel("Họ tên quản trị").fill("Quản trị Khách");
  await main(page).getByLabel("Email quản trị").fill(`${code}@example.vn`);
  await main(page).getByLabel("Mật khẩu tạm").fill("Temp@12345");
  await next(page);
}

async function fillContract(page: Page, name: string) {
  await main(page).getByLabel("Tên hợp đồng").fill(name);
  for (const [label, text] of [["Ngày bắt đầu", dmy(-1)], ["Ngày kết thúc", dmy(365)]] as const) {
    const input = main(page).getByLabel(label);
    await input.fill(text);
    await input.press("Enter");
  }
  await main(page).getByLabel("Tổng tiền (VND)").fill("12000000");
  await next(page);
}

test.describe("nền tảng: wizard triển khai khách mới", () => {
  test("mục sidebar chỉ platform admin thấy; tenant admin bị chặn khi vào thẳng URL", async ({ page }) => {
    await gotoAs(page, "platform", "/");
    await expect(sidebar(page).getByRole("link", { name: "Triển khai khách mới" })).toHaveAttribute("href", "/platform/onboarding");
    await gotoAs(page, "admin", "/platform/onboarding");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("đi hết 5 bước: tạo đơn vị, hợp đồng, kích hoạt và origin rồi hiện kết quả", async ({ page }) => {
    const code = `ob-${uid()}`;
    await gotoAs(page, "platform", "/platform/onboarding");
    await expect(main(page).getByRole("heading", { name: "Triển khai khách mới" })).toBeVisible();

    await fillTenant(page, code);
    await fillAdmin(page, code, ["Mượn trả", "Bán hàng"]);
    await fillContract(page, `HĐ ${code}`);
    await main(page).getByLabel("Origin website (mỗi dòng một địa chỉ)").fill(`https://${code}.example.vn`);
    await next(page);

    const review = main(page).getByTestId("onboarding-review");
    await expect(review).toContainText(`Khách ${code}`);
    await expect(review).toContainText("kích hoạt ngay");
    await main(page).getByRole("button", { name: "Triển khai" }).click();

    await expect(main(page).getByText(`Đã triển khai Khách ${code}`)).toBeVisible();
    await main(page).getByRole("link", { name: "Mở đơn vị" }).click();
    await expect(page).toHaveURL(/\/platform\/tenants\/[0-9a-f-]+$/);
  });

  test("không chọn Bán hàng thì bước Website báo bỏ qua; có thể bỏ hợp đồng", async ({ page }) => {
    const code = `ob-${uid()}`;
    await gotoAs(page, "platform", "/platform/onboarding");
    await fillTenant(page, code);
    await fillAdmin(page, code, ["Mượn trả"]);
    await main(page).getByLabel("Tạo hợp đồng cho đơn vị này").uncheck();
    await expect(main(page).getByText("Không tạo hợp đồng")).toBeVisible();
    await next(page);
    await expect(main(page).getByText("Chỉ cần khai báo website khi đơn vị bật module Bán hàng")).toBeVisible();
    await next(page);
    await expect(main(page).getByTestId("onboarding-review")).toContainText("Không tạo");
    await main(page).getByRole("button", { name: "Triển khai" }).click();
    await expect(main(page).getByText(`Đã triển khai Khách ${code}`)).toBeVisible();
    await expect(main(page).getByRole("link", { name: "Mở hợp đồng" })).toHaveCount(0);
  });

  test("bước 1 báo lỗi khi thiếu mã đơn vị và không cho đi tiếp", async ({ page }) => {
    await gotoAs(page, "platform", "/platform/onboarding");
    await next(page);
    await expect(main(page).getByText("Nhập mã đơn vị")).toBeVisible();
    await expect(main(page).getByLabel("Mã đơn vị")).toBeVisible();
  });
});
