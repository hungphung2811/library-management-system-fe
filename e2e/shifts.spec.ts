import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar, type UserKey } from "./helpers";

// Chốt ca thu ngân (ADR-0030 gói B): thanh ca trong POS, mở/đóng ca, chênh lệch vượt ngưỡng, quản lý ca /sales/shifts, cấu hình ca.
// Mock: e2e/mock/shifts.mjs. Mỗi test dùng một thu ngân riêng (mỗi người chỉ một ca mở) vì test chạy song song trên mock dùng chung.
// Tenant của shiftmgr/shiftc*: ngưỡng chênh lệch 5.000đ, cờ chặn bán tắt (không test nào đổi). Tenant của shiftflagm/shiftflagc: một test duy nhất đổi cấu hình.

const ISBN1 = "9786040000011";
const main = (page: Page) => page.getByRole("main");
const detail = (page: Page) => page.getByRole("dialog").filter({ has: page.getByTestId("shift-detail") });
const action = (page: Page) => page.getByRole("dialog").filter({ hasNot: page.getByTestId("shift-detail") }).last();

type Shift = { id: string; shiftNo: string; cashierUserId: string };
const hdr = async (request: APIRequestContext, user: UserKey) => bearer(await loginApi(request, user));

async function openApi(request: APIRequestContext, user: UserKey, openingFloat = 100000): Promise<Shift> {
  const res = await request.post("/api/sales/shifts", { headers: await hdr(request, user), data: { openingFloat, clientRequestId: crypto.randomUUID() } });
  expect(res.status()).toBe(201);
  return (await res.json()) as Shift;
}
const mockPay = (request: APIRequestContext, id: string, data: { method: string; amount: number; refund?: boolean; afterClose?: boolean }) =>
  request.post(`/api/sales/__mock/shifts/${id}/payments`, { data });

async function closeApi(request: APIRequestContext, user: UserKey, countedCash: number, varianceReason?: string) {
  return request.post("/api/sales/shifts/me/current/closing", { headers: await hdr(request, user), data: { countedCash, ...(varianceReason ? { varianceReason } : {}) } });
}

test.describe("ca thu ngân: thanh ca trong POS", () => {
  test("chưa mở ca: cảnh báo và nút Mở ca; mở ca với tiền đầu ca thì thanh chuyển sang đang mở", async ({ page }) => {
    await gotoAs(page, "shiftc1", "/sales/pos");
    const bar = main(page).getByTestId("shift-bar");
    await expect(bar.getByTestId("shift-none")).toContainText("Bạn chưa mở ca");
    await bar.getByRole("button", { name: "Mở ca" }).click();
    const dlg = action(page);
    await dlg.getByLabel(/Tiền đầu ca/).fill("500000");
    await dlg.getByLabel("Quầy (tùy chọn)").fill("Quầy 1");
    await dlg.getByRole("button", { name: /Mở ca$/ }).click();
    await expect(bar.getByTestId("shift-open")).toContainText(/CA-\d{6}/);
    await expect(bar.getByTestId("shift-float")).toContainText("500.000");
    await expect(bar.getByTestId("shift-open")).toContainText("Quầy 1");
    await expect(bar.getByRole("button", { name: "Mở ca" })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "Đóng ca" })).toBeVisible();
  });

  test("mở ca khi đã có ca mở: BE trả SHIFT_ALREADY_OPEN; đóng ca khớp hiện kết quả chênh lệch bằng 0", async ({ page }) => {
    const sh = await openApi(page.request, "shiftc2", 200000);
    await mockPay(page.request, sh.id, { method: "CASH", amount: 300000 });
    await mockPay(page.request, sh.id, { method: "CARD", amount: 90000 });
    const again = await page.request.post("/api/sales/shifts", { headers: await hdr(page.request, "shiftc2"), data: { openingFloat: 0, clientRequestId: crypto.randomUUID() } });
    expect(again.status()).toBe(409);
    expect((await again.json()).code).toBe("SHIFT_ALREADY_OPEN");

    await gotoAs(page, "shiftc2", "/sales/pos");
    const bar = main(page).getByTestId("shift-bar");
    await expect(bar.getByTestId("shift-open")).toContainText(sh.shiftNo);
    await expect(bar.getByTestId("shift-open")).toContainText("500.000"); // tiền mặt dự kiến tạm tính (đầu ca + thu tiền mặt, thẻ không tính)
    await bar.getByRole("button", { name: "Đóng ca" }).click();
    const dlg = action(page);
    await expect(dlg.getByTestId("close-provisional")).toContainText("500.000");
    await dlg.getByLabel("Tiền mặt đếm thực tế").fill("500000");
    await expect(dlg.getByTestId("close-variance-preview")).toContainText("Khớp");
    await dlg.getByRole("button", { name: /Đóng ca$/ }).click();
    await expect(bar.getByTestId("shift-closed")).toContainText("Đã đóng ca " + sh.shiftNo);
    await expect(bar.getByTestId("shift-closed")).toContainText("dự kiến 500.000");
    await expect(bar.getByTestId("shift-none")).toBeVisible();
  });

  test("chênh lệch vượt ngưỡng: đóng không lý do bị BE chặn, ô lý do thành bắt buộc; sau đó ca chờ quản lý duyệt và quản lý duyệt được", async ({ page }) => {
    const sh = await openApi(page.request, "shiftc3", 100000);
    await gotoAs(page, "shiftc3", "/sales/pos");
    const bar = main(page).getByTestId("shift-bar");
    await bar.getByRole("button", { name: "Đóng ca" }).click();
    const dlg = action(page);
    await dlg.getByLabel("Tiền mặt đếm thực tế").fill("80000");
    await expect(dlg.getByTestId("close-variance-preview")).toContainText("Thiếu 20.000");
    await dlg.getByRole("button", { name: /Đóng ca$/ }).click();
    await expect(dlg).toContainText("bắt buộc nhập lý do chênh lệch");
    await dlg.getByRole("button", { name: /Đóng ca$/ }).click();
    await expect(dlg.getByText("Nhập lý do chênh lệch", { exact: true })).toBeVisible();
    await dlg.getByLabel("Lý do chênh lệch").fill("Trả nhầm tiền thối cho khách");
    await dlg.getByRole("button", { name: /Đóng ca$/ }).click();
    await expect(bar.getByTestId("shift-closed")).toContainText("chờ quản lý duyệt");

    await gotoAs(page, "shiftmgr", `/sales/shifts/${sh.id}`);
    const d = detail(page);
    await expect(d.getByTestId("shift-variance")).toContainText("Thiếu 20.000");
    await expect(d.getByTestId("shift-variance-status")).toHaveText("Chờ duyệt");
    await expect(d).toContainText("Trả nhầm tiền thối cho khách");
    await d.getByRole("button", { name: "Duyệt chênh lệch" }).click();
    await action(page).getByLabel("Ghi chú (tùy chọn)").fill("Đã kiểm camera");
    await action(page).getByRole("button", { name: /Duyệt$/ }).click();
    await expect(d.getByTestId("shift-variance-status")).toHaveText("Đã duyệt");
    await expect(d.getByRole("button", { name: "Duyệt chênh lệch" })).toHaveCount(0);
    await expect(d.getByTestId("shift-history")).toContainText("Duyệt chênh lệch");
  });

  test("còn lệnh thu tay đang chờ: đóng ca báo SHIFT_HAS_PENDING_PAYMENTS kèm số lệnh, xử lý xong đóng lại được", async ({ page }) => {
    const sh = await openApi(page.request, "shiftc4", 0);
    await page.request.post(`/api/sales/__mock/shifts/${sh.id}/pending`, { data: { count: 2 } });
    await gotoAs(page, "shiftc4", "/sales/pos");
    const bar = main(page).getByTestId("shift-bar");
    await bar.getByRole("button", { name: "Đóng ca" }).click();
    const dlg = action(page);
    await dlg.getByLabel("Tiền mặt đếm thực tế").fill("0");
    await dlg.getByRole("button", { name: /Đóng ca$/ }).click();
    await expect(dlg).toContainText("Còn lệnh thu tay đang chờ trong ca này");
    await expect(dlg).toContainText("Số lệnh thu tay đang chờ: 2");
    await page.request.post(`/api/sales/__mock/shifts/${sh.id}/pending`, { data: { count: 0 } });
    await dlg.getByRole("button", { name: /Đóng ca$/ }).click();
    await expect(bar.getByTestId("shift-closed")).toBeVisible();
  });

  test("người không có khóa ca không thấy thanh ca trong POS và không có mục Ca thu ngân", async ({ page }) => {
    await gotoAs(page, "seller", "/sales/pos");
    await expect(main(page).getByRole("heading", { name: "Bán tại quầy" })).toBeVisible();
    await expect(main(page).getByTestId("shift-bar")).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: "Ca thu ngân" })).toHaveCount(0);
  });
});

test.describe("ca thu ngân: quản lý ca /sales/shifts", () => {
  test("danh sách lọc theo thu ngân; chi tiết có báo cáo đủ 6 phương thức, phần phát sinh sau chốt; mở lại ca bắt buộc lý do", async ({ page }) => {
    const sh = await openApi(page.request, "shiftc6", 0);
    await mockPay(page.request, sh.id, { method: "CASH", amount: 1000 });
    await mockPay(page.request, sh.id, { method: "CARD", amount: 2000 });
    await mockPay(page.request, sh.id, { method: "CARD", amount: 500, afterClose: true });
    expect((await closeApi(page.request, "shiftc6", 1000)).ok()).toBeTruthy();

    await gotoAs(page, "shiftmgr", `/sales/shifts?cashierUserId=${sh.cashierUserId}`);
    await expect(sidebar(page).getByRole("link", { name: "Ca thu ngân" })).toHaveAttribute("href", "/sales/shifts");
    await expect(main(page).getByTestId("shift-settings")).toBeVisible();
    const row = main(page).getByRole("row", { name: new RegExp(sh.shiftNo) });
    await expect(row).toContainText("Đã đóng");
    await row.getByRole("link", { name: sh.shiftNo }).click();
    const d = detail(page);
    await expect(d.getByTestId("shift-expected")).toContainText("1.000");
    await expect(d.getByTestId("shift-variance")).toContainText("Khớp");
    const report = d.getByTestId("shift-report");
    for (const m of ["Tiền mặt", "Thẻ", "Chuyển khoản", "QR", "MoMo", "SePay"]) await expect(report.getByRole("row", { name: new RegExp(`^${m}`) })).toBeVisible();
    await expect(report.getByRole("row", { name: /^Thẻ/ })).toContainText("thu 500");

    await d.getByRole("button", { name: "Mở lại ca" }).click();
    await action(page).getByRole("button", { name: /Mở lại$/ }).click();
    await expect(action(page).getByText("Nhập lý do")).toBeVisible();
    await action(page).getByLabel("Lý do mở lại").fill("Thu ngân đếm nhầm tiền");
    await action(page).getByRole("button", { name: /Mở lại$/ }).click();
    await expect(d.getByText("Đã mở lại").first()).toBeVisible();
    await expect(d.getByTestId("shift-history")).toContainText("Thu ngân đếm nhầm tiền");
    await expect(d.getByRole("button", { name: "Mở lại ca" })).toHaveCount(0);
    await expect(d.getByRole("button", { name: "Đóng ca thay" })).toBeVisible();
  });

  test("quản lý đóng thay ca đang mở của thu ngân", async ({ page }) => {
    const sh = await openApi(page.request, "shiftc7", 50000);
    await gotoAs(page, "shiftmgr", `/sales/shifts/${sh.id}`);
    const d = detail(page);
    await expect(d.getByTestId("shift-provisional")).toContainText("50.000");
    await d.getByRole("button", { name: "Đóng ca thay" }).click();
    await action(page).getByLabel("Tiền mặt đếm thực tế").fill("50000");
    await action(page).getByRole("button", { name: /Đóng ca$/ }).click();
    await expect(d.getByTestId("shift-counted")).toContainText("50.000");
    await expect(d.getByRole("button", { name: "Mở lại ca" })).toBeVisible();
  });

  test("thu ngân chỉ có khóa của tôi: chỉ thấy ca của mình, không có cấu hình ca; ca của người khác ở endpoint của tôi là 404", async ({ page }) => {
    const sh = await openApi(page.request, "shiftc8", 10000);
    const other = await page.request.get(`/api/sales/shifts/me/${sh.id}`, { headers: await hdr(page.request, "shiftview") });
    expect(other.status()).toBe(404);
    await gotoAs(page, "shiftview", "/sales/shifts");
    await expect(main(page).getByTestId("shift-settings")).toHaveCount(0);
    await expect(main(page).getByText("Chưa có ca nào.")).toBeVisible();
    await gotoAs(page, "seller", "/sales/shifts");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });
});

test.describe("ca thu ngân: cấu hình ca và cờ chặn bán", () => {
  test("bật cờ chặn bán: POS báo SHIFT_NOT_OPEN kèm nút Mở ca, mở ca xong bán được; ngưỡng chênh lệch lưu được", async ({ page }) => {
    const mgr = await hdr(page.request, "shiftflagm");
    const cur = async () => (await (await page.request.get("/api/sales/shift-settings", { headers: mgr })).json()) as { version: number };
    try {
      await gotoAs(page, "shiftflagm", "/sales/shifts");
      const card = main(page).getByTestId("shift-settings");
      await expect(card).toBeVisible();
      await card.getByRole("switch", { name: "Bắt buộc mở ca mới được bán" }).click();
      await card.getByLabel("Ngưỡng chênh lệch tiền mặt khi đóng ca").fill("2000");
      await card.getByRole("button", { name: "Lưu cấu hình ca" }).click();
      await expect(page.getByText("Đã lưu cấu hình ca.")).toBeVisible();
      await expect(card).toContainText(/Phiên bản [1-9]/);

      // API: bán khi chưa mở ca bị chặn đúng mã.
      const blocked = await page.request.post("/api/sales/pos-orders", {
        headers: await hdr(page.request, "shiftflagc"),
        data: { lines: [{ titleId: "b0000000-0000-4000-8000-000000000001", quantity: 1 }], paymentMethod: "CASH", clientRequestId: crypto.randomUUID() },
      });
      expect(blocked.status()).toBe(409);
      expect((await blocked.json()).code).toBe("SHIFT_NOT_OPEN");

      await gotoAs(page, "shiftflagc", "/sales/pos");
      const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
      await scan.fill(ISBN1);
      await scan.press("Enter");
      await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
      await main(page).getByRole("button", { name: "Thanh toán" }).click();
      const alert = main(page).getByTestId("shift-not-open");
      await expect(alert).toContainText("Bạn chưa mở ca");
      await alert.getByRole("button", { name: "Mở ca" }).click();
      await action(page).getByLabel(/Tiền đầu ca/).fill("100000");
      await action(page).getByRole("button", { name: /Mở ca$/ }).click();
      await expect(main(page).getByTestId("shift-open")).toBeVisible();
      await main(page).getByRole("button", { name: "Thanh toán" }).click();
      await expect(page.getByTestId("manual-panel")).toBeVisible();
    } finally {
      // Trả cấu hình về mặc định để lần chạy sau (và test khác dùng chung tenant) không bị chặn.
      const v = await cur();
      await page.request.put("/api/sales/shift-settings", { headers: mgr, data: { requireOpenShiftForPos: false, varianceThreshold: 0, version: v.version } });
    }
  });
});
