import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar, type UserKey } from "./helpers";

// Hóa đơn VAT nội bộ (ADR-0030 gói A): khối hóa đơn trong chi tiết đơn, danh sách /sales/invoices, cấu hình /sales/invoice-settings.
// Mock: e2e/mock/invoices.mjs (đơn dựng sẵn bằng POST /api/sales/_mock/orders của sales-online.mjs). Mock dùng chung 2 worker và test chạy song
// song: mỗi test dựng đơn riêng, không giả định số lượng hóa đơn. Tenant của invsetmgr/invsetview chỉ dùng cho màn cấu hình.

const main = (page: Page) => page.getByRole("main");
const detail = (page: Page) => page.getByRole("dialog").filter({ has: page.getByTestId("order-status") });
const action = (page: Page) => page.getByRole("dialog").filter({ hasNot: page.getByTestId("order-status") }).last();

type Order = { id: string; orderNo: string };
type Invoice = { id: string; invoiceNumber: string; status: string };

async function seedOrder(request: APIRequestContext, data: Record<string, unknown> = { status: "COMPLETED", paid: true }): Promise<Order> {
  const res = await request.post("/api/sales/_mock/orders", { data });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Order;
}
const hdr = async (request: APIRequestContext, user: UserKey) => bearer(await loginApi(request, user));

/** Xuất hóa đơn khách lẻ qua API (người mua mặc định). */
async function issueApi(request: APIRequestContext, order: Order, user: UserKey = "invmgr"): Promise<Invoice> {
  const res = await request.post(`/api/sales/orders/${order.id}/invoice`, { headers: await hdr(request, user), data: { clientRequestId: crypto.randomUUID() } });
  expect(res.status()).toBe(201);
  return (await res.json()) as Invoice;
}

const openOrder = async (page: Page, user: UserKey, o: Order) => {
  await gotoAs(page, user, `/sales/orders/${o.id}`);
  await expect(detail(page).getByTestId("order-status")).toBeVisible();
};
const panel = (page: Page) => detail(page).getByTestId("invoice-panel");

test.describe("hóa đơn: khối trong chi tiết đơn", () => {
  test("đơn đã hoàn tất và thu tiền: cảnh báo hóa đơn nội bộ, xuất cho khách lẻ rồi xem bản in trong iframe sandbox", async ({ page }) => {
    const o = await seedOrder(page.request);
    await openOrder(page, "invcashier", o);
    await expect(panel(page).getByTestId("invoice-notice")).toContainText("Hóa đơn nội bộ, không thay thế hóa đơn điện tử");
    await expect(panel(page).getByTestId("invoice-none")).toBeVisible();
    await panel(page).getByRole("button", { name: "Xuất hóa đơn" }).click();
    await expect(action(page).getByText("Hóa đơn nội bộ, chưa có giá trị pháp lý")).toBeVisible();
    await action(page).getByText("Khách lẻ, không lấy hóa đơn").click();
    await action(page).getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(panel(page).getByTestId("invoice-number")).toHaveText(/^\d{8}$/);
    await expect(panel(page).getByText("Đã phát hành")).toBeVisible();
    // Thu ngân không có khóa hủy/thay thế.
    await expect(panel(page).getByRole("button", { name: "Hủy hóa đơn" })).toHaveCount(0);
    await expect(panel(page).getByRole("button", { name: "Thay thế hóa đơn" })).toHaveCount(0);

    await panel(page).getByRole("button", { name: "Xem và in" }).click();
    const view = page.getByTestId("invoice-view");
    await expect(view.getByTestId("invoice-notice")).toContainText("Hóa đơn nội bộ, không thay thế hóa đơn điện tử");
    const frame = view.getByTestId("invoice-print-frame");
    await expect(frame).toHaveAttribute("sandbox", /allow-modals/);
    await expect(frame).not.toHaveAttribute("sandbox", /allow-scripts/);
    await expect(page.frameLocator('[data-testid="invoice-print-frame"]').getByRole("heading", { name: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" })).toBeVisible();
    await expect(view.getByRole("button", { name: "In hóa đơn" })).toBeVisible();
  });

  test("bản in có script độc hại không chạy được (sandbox không allow-scripts), không đụng DOM của ứng dụng", async ({ page }) => {
    const o = await seedOrder(page.request);
    await openOrder(page, "invmgr", o);
    await panel(page).getByRole("button", { name: "Xuất hóa đơn" }).click();
    await action(page).getByLabel("Tên người mua").fill("XSS_PROBE Nguyễn");
    await action(page).getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(panel(page).getByTestId("invoice-number")).toBeVisible();
    await panel(page).getByRole("button", { name: "Xem và in" }).click();
    await expect(page.frameLocator('[data-testid="invoice-print-frame"]').getByText("XSS_PROBE")).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.body.getAttribute("data-pwned"))).toBeNull();
    expect(await page.title()).not.toBe("PWNED");
  });

  test("xuất cho người mua có MST: kiểm định dạng MST, bắt buộc đơn vị và địa chỉ, rồi xuất được", async ({ page }) => {
    const o = await seedOrder(page.request);
    await openOrder(page, "invmgr", o);
    await panel(page).getByRole("button", { name: "Xuất hóa đơn" }).click();
    const dlg = action(page);
    await dlg.getByLabel("Tên người mua").fill("Trần Văn B");
    await dlg.getByLabel("Mã số thuế").fill("123");
    await dlg.getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(dlg.getByText("Mã số thuế chưa đúng định dạng")).toBeVisible();
    await dlg.getByLabel("Mã số thuế").fill("0123456789-001");
    await dlg.getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(dlg.getByText("Có mã số thuế thì phải nhập tên đơn vị")).toBeVisible();
    await expect(dlg.getByText("Có mã số thuế thì phải nhập địa chỉ")).toBeVisible();
    await dlg.getByLabel("Tên đơn vị").fill("Công ty TNHH B");
    await dlg.getByLabel("Địa chỉ", { exact: true }).fill("2 Hai Bà Trưng, Hà Nội");
    await dlg.getByLabel("Email nhận hóa đơn (tùy chọn)").fill("b@example.com");
    await dlg.getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(panel(page).getByTestId("invoice-number")).toBeVisible();
    await expect(panel(page)).toContainText("Công ty TNHH B (MST 0123456789-001)");
    await expect(panel(page).getByTestId("invoice-request")).toContainText("Đã xuất");
  });

  test("MST 12 chữ số được chấp nhận; MST 11 chữ số bị từ chối ở form", async ({ page }) => {
    const o = await seedOrder(page.request);
    await openOrder(page, "invmgr", o);
    await panel(page).getByRole("button", { name: "Xuất hóa đơn" }).click();
    const dlg = action(page);
    await dlg.getByLabel("Tên đơn vị").fill("Cá nhân KD");
    await dlg.getByLabel("Địa chỉ", { exact: true }).fill("Đà Nẵng");
    await dlg.getByLabel("Mã số thuế").fill("12345678901");
    await dlg.getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(dlg.getByText("Mã số thuế chưa đúng định dạng")).toBeVisible();
    await dlg.getByLabel("Mã số thuế").fill("012345678901");
    await dlg.getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(panel(page).getByTestId("invoice-number")).toBeVisible();
  });

  test("đơn chưa hoàn tất hoặc chưa thu tiền: không có nút Xuất hóa đơn, chỉ có lời giải thích", async ({ page }) => {
    const o = await seedOrder(page.request, { status: "CONFIRMED", paid: false });
    await openOrder(page, "invmgr", o);
    await expect(panel(page)).toContainText("Chỉ xuất được hóa đơn khi đơn đã hoàn tất và đã thu tiền");
    await expect(panel(page).getByRole("button", { name: "Xuất hóa đơn" })).toHaveCount(0);
  });

  test("tenant chưa cấu hình người bán: xuất hóa đơn báo lỗi tiếng Việt, không tạo hóa đơn", async ({ page }) => {
    const o = await seedOrder(page.request);
    await openOrder(page, "invnoset", o);
    await panel(page).getByRole("button", { name: "Xuất hóa đơn" }).click();
    await action(page).getByText("Khách lẻ, không lấy hóa đơn").click();
    await action(page).getByRole("button", { name: /Xuất hóa đơn$/ }).click();
    await expect(action(page)).toContainText("Chưa cấu hình đủ thông tin người bán");
    await expect(panel(page).getByTestId("invoice-number")).toHaveCount(0);
  });

  test("hủy hóa đơn: bắt buộc lý do; sau khi hủy hiện trong danh sách đã hủy và xuất lại được", async ({ page }) => {
    const o = await seedOrder(page.request);
    const inv = await issueApi(page.request, o);
    await openOrder(page, "invmgr", o);
    await expect(panel(page).getByTestId("invoice-number")).toHaveText(inv.invoiceNumber);
    await panel(page).getByRole("button", { name: "Hủy hóa đơn" }).click();
    const dlg = action(page);
    await dlg.getByRole("button", { name: /Hủy hóa đơn$/ }).click();
    await expect(dlg.getByText("Nhập lý do")).toBeVisible();
    await dlg.getByLabel("Lý do hủy").fill("Nhập sai thông tin người mua");
    await dlg.getByRole("button", { name: /Hủy hóa đơn$/ }).click();
    await expect(panel(page).getByTestId("invoice-cancelled")).toContainText(inv.invoiceNumber);
    await expect(panel(page).getByTestId("invoice-none")).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Xuất hóa đơn" })).toBeVisible();
  });

  test("thay thế hóa đơn: bắt buộc lý do, đổi người mua, hóa đơn mới có số khác và bản cũ chuyển sang đã hủy", async ({ page }) => {
    const o = await seedOrder(page.request);
    const inv = await issueApi(page.request, o);
    await openOrder(page, "invmgr", o);
    await panel(page).getByRole("button", { name: "Thay thế hóa đơn" }).click();
    const dlg = action(page);
    await dlg.getByLabel("Tên người mua").fill("Lê Thị C");
    await dlg.getByRole("button", { name: /Thay thế$/ }).click();
    await expect(dlg.getByText("Nhập lý do")).toBeVisible();
    await dlg.getByLabel("Lý do thay thế").fill("Sai tên người mua");
    await dlg.getByRole("button", { name: /Thay thế$/ }).click();
    await expect(panel(page).getByTestId("invoice-cancelled")).toContainText(inv.invoiceNumber);
    await expect(panel(page).getByText("Hóa đơn thay thế").first()).toBeVisible();
    await expect(panel(page).getByTestId("invoice-number")).not.toHaveText(inv.invoiceNumber);
    await expect(panel(page)).toContainText("Lê Thị C");
  });

  test("hóa đơn điều chỉnh do trả hàng được liệt kê; hóa đơn gốc không hủy hoặc thay thế được nữa", async ({ page }) => {
    const o = await seedOrder(page.request);
    const inv = await issueApi(page.request, o);
    const adj = await page.request.post(`/api/sales/__mock/invoices/${inv.id}/adjustment`, { data: { amount: 25000 } });
    expect(adj.status()).toBe(201);
    const adjNo = ((await adj.json()) as Invoice).invoiceNumber;
    await openOrder(page, "invmgr", o);
    await expect(panel(page).getByTestId("invoice-adjustments")).toContainText(adjNo);
    await expect(panel(page).getByTestId("invoice-adjustments")).toContainText("Điều chỉnh giảm");
    await expect(panel(page).getByRole("button", { name: "Hủy hóa đơn" })).toBeDisabled();
    await expect(panel(page).getByRole("button", { name: "Thay thế hóa đơn" })).toBeDisabled();
    await expect(panel(page)).toContainText("đã có hóa đơn điều chỉnh");
  });

  test("người không có khóa hóa đơn không thấy khối hóa đơn; người chỉ có khóa xuất thấy nút xuất nhưng không có hủy/thay thế", async ({ page }) => {
    const o = await seedOrder(page.request);
    await openOrder(page, "invnone", o);
    await expect(detail(page).getByTestId("invoice-panel")).toHaveCount(0);
    const o2 = await seedOrder(page.request);
    await openOrder(page, "invissuer", o2);
    await expect(panel(page).getByRole("button", { name: "Xuất hóa đơn" })).toBeVisible();
    await expect(panel(page).getByRole("button", { name: "Hủy hóa đơn" })).toHaveCount(0);
  });
});

test.describe("hóa đơn: danh sách /sales/invoices", () => {
  test("sidebar có mục Hóa đơn; lọc theo số đơn và trạng thái; xem hóa đơn mở bản in", async ({ page }) => {
    const o = await seedOrder(page.request);
    const inv = await issueApi(page.request, o);
    const o2 = await seedOrder(page.request);
    const inv2 = await issueApi(page.request, o2);
    const cancel = await page.request.post(`/api/sales/invoices/${inv2.id}/cancellation`, { headers: await hdr(page.request, "invmgr"), data: { reason: "Hủy thử" } });
    expect(cancel.ok()).toBeTruthy();

    await gotoAs(page, "invmgr", "/sales/invoices");
    await expect(sidebar(page).getByRole("link", { name: "Hóa đơn", exact: true })).toHaveAttribute("href", "/sales/invoices");
    await expect(main(page).getByText("Hóa đơn nội bộ, không thay thế hóa đơn điện tử").first()).toBeVisible();
    await gotoAs(page, "invmgr", `/sales/invoices?keyword=${o.orderNo}`);
    const row = main(page).getByRole("row", { name: new RegExp(inv.invoiceNumber) });
    await expect(row).toContainText("Đã phát hành");
    await expect(row).toContainText(o.orderNo);
    await row.getByRole("button", { name: inv.invoiceNumber }).click();
    await expect(page.getByTestId("invoice-view")).toBeVisible();
    await expect(page.frameLocator('[data-testid="invoice-print-frame"]').getByRole("heading", { name: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" })).toBeVisible();
    await page.keyboard.press("Escape");

    await gotoAs(page, "invmgr", `/sales/invoices?keyword=${o2.orderNo}&status=CANCELLED`);
    await expect(main(page).getByRole("row", { name: new RegExp(inv2.invoiceNumber) })).toContainText("Đã hủy");
    await gotoAs(page, "invmgr", `/sales/invoices?keyword=${o2.orderNo}&status=ISSUED`);
    await expect(main(page).getByText("Chưa có hóa đơn nào.")).toBeVisible();
  });

  test("từ khóa không khớp hiện trạng thái rỗng; người không có khóa thấy trang không có quyền", async ({ page }) => {
    await gotoAs(page, "invmgr", "/sales/invoices?keyword=KHONG-CO-DON-NAO-ZZZ");
    await expect(main(page).getByText("Chưa có hóa đơn nào.")).toBeVisible();
    await expect(main(page).getByText("Thử đổi hoặc bỏ bộ lọc.")).toBeVisible();
    await gotoAs(page, "invnone", "/sales/invoices");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Hóa đơn", exact: true })).toHaveCount(0);
  });
});

test.describe("hóa đơn: cấu hình /sales/invoice-settings", () => {
  test("chưa cấu hình: có cảnh báo; nhập sai MST bị chặn; lưu thành công thì mất cảnh báo", async ({ page }) => {
    await gotoAs(page, "invsetmgr", "/sales/invoice-settings");
    await expect(sidebar(page).getByRole("link", { name: "Cấu hình hóa đơn" })).toHaveAttribute("href", "/sales/invoice-settings");
    await expect(main(page).getByTestId("invoice-settings-incomplete")).toBeVisible();
    await main(page).getByLabel("Tên pháp lý người bán").fill("Công ty Sách Mẫu");
    await main(page).getByLabel("Mã số thuế người bán").fill("12345");
    await main(page).getByLabel("Địa chỉ người bán").fill("10 Nguyễn Huệ, TP.HCM");
    await main(page).getByLabel("Mẫu số").fill("1");
    await main(page).getByLabel("Ký hiệu hóa đơn").fill("C26TBB");
    await main(page).getByRole("button", { name: "Lưu cấu hình" }).click();
    await expect(main(page).getByText("Mã số thuế chưa đúng định dạng")).toBeVisible();
    await main(page).getByLabel("Mã số thuế người bán").fill("0312345678-002");
    await main(page).getByRole("button", { name: "Lưu cấu hình" }).click();
    await expect(page.getByText("Đã lưu cấu hình hóa đơn.")).toBeVisible();
    await expect(main(page).getByTestId("invoice-settings-incomplete")).toHaveCount(0);
    await expect(main(page)).toContainText("Phiên bản 1");
  });

  test("chỉ có khóa xem: các ô bị khóa và không có nút lưu", async ({ page }) => {
    await gotoAs(page, "invsetview", "/sales/invoice-settings");
    await expect(main(page).getByLabel("Tên pháp lý người bán")).toBeDisabled();
    await expect(main(page).getByRole("button", { name: "Lưu cấu hình" })).toHaveCount(0);
  });
});
