import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, type UserKey } from "./helpers";

// Bán hàng: thông tin mặt hàng (SKU, nhà cung cấp, giá nhập, vị trí kho, đặt lại, ngày nhập, ghi chú), ghi chú đơn, ghi chú khách ở POS.
// Mock: e2e/mock/sales.mjs. Tồn kho dùng chung các worker nên cả file chạy tuần tự và test tự đặt lại trạng thái mình sửa.

test.describe.configure({ mode: "serial" });

const BOOK1 = "b0000000-0000-4000-8000-000000000001";
const ISBN1 = "9786040000011";
const NAME1 = "Lập trình Java cơ bản";
const main = (page: Page) => page.getByRole("main");
const row = (page: Page, name: string) => main(page).getByRole("row").filter({ hasText: name });
const hdr = async (page: Page, user: UserKey) => bearer(await loginApi(page.request, user));
const dialog = (page: Page) => page.getByRole("dialog");

test.describe("tồn kho: chi tiết mặt hàng", () => {
  test("quản lý sửa 7 field: bảng hiện SKU (viết hoa), nhà cung cấp, vị trí, ngày nhập và cờ cần đặt lại", async ({ page }) => {
    await gotoAs(page, "salesmgr", "/sales/stock");
    await row(page, NAME1).getByRole("button", { name: "Chi tiết" }).click();
    const d = dialog(page);
    await expect(d.getByLabel("Giá nhập")).toBeVisible();
    await expect(d.getByLabel("Ghi chú nội bộ")).toBeVisible();
    await d.getByLabel("Mã SKU").fill("  jv-001 ");
    await d.getByLabel("Nhà cung cấp").fill("NXB Giáo dục");
    await d.getByLabel("Giá nhập").fill("85000");
    await d.getByLabel("Vị trí kho").fill("Kệ A2");
    await d.getByLabel("Số lượng cần đặt lại").fill("1000");
    await d.getByLabel("Ngày nhập gần nhất").fill("2026-11-05");
    await d.getByLabel("Ghi chú nội bộ").fill("Hàng dễ hỏng");
    await d.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu chi tiết mặt hàng.")).toBeVisible();
    const r = row(page, NAME1);
    await expect(r).toContainText("JV-001");
    await expect(r).toContainText("NXB Giáo dục");
    await expect(r).toContainText("Kệ A2");
    await expect(r).toContainText("05/11/2026");
    await expect(r.getByTestId("reorder-flag")).toContainText("Cần đặt lại");

    // Mở lại: đủ 7 field từ /details; lưu không đổi ngày thì không gửi lastRestockedAt (BE giữ).
    await r.getByRole("button", { name: "Chi tiết" }).click();
    await expect(dialog(page).getByLabel("Giá nhập")).toHaveValue("85.000");
    await expect(dialog(page).getByLabel("Ghi chú nội bộ")).toHaveValue("Hàng dễ hỏng");
    await expect(dialog(page).getByLabel("Ngày nhập gần nhất")).toHaveValue("2026-11-05");
    await dialog(page).getByLabel("Vị trí kho").fill("");
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    // Lần lưu thứ hai: toast của lần đầu có thể còn hiện, lấy toast mới nhất.
    await expect(page.getByText("Đã lưu chi tiết mặt hàng.").last()).toBeVisible();
    const h = await hdr(page, "salesmgr");
    const det = (await (await page.request.get(`/api/sales/stock-items/${BOOK1}/details`, { headers: h })).json()) as Record<string, unknown>;
    expect(det.binLocation).toBeNull();
    expect(det.lastRestockedAt).not.toBeNull();
    expect(det.costPrice).toBe(85000);
  });

  test("trùng SKU: 409 hiện thông báo tiếng Việt, hộp thoại giữ nguyên dữ liệu", async ({ page }) => {
    const h = await hdr(page, "salesmgr");
    const b2 = "b0000000-0000-4000-8000-000000000002";
    expect((await page.request.put(`/api/sales/stock-items/${b2}/details`, { headers: h, data: { sku: "DSA-77" } })).ok()).toBeTruthy();
    await gotoAs(page, "salesmgr", "/sales/stock");
    await row(page, NAME1).getByRole("button", { name: "Chi tiết" }).click();
    await dialog(page).getByLabel("Mã SKU").fill("dsa-77");
    await dialog(page).getByRole("button", { name: "Lưu" }).click();
    await expect(dialog(page).getByText("Mã SKU đã tồn tại")).toBeVisible();
    await expect(dialog(page).getByLabel("Mã SKU")).toHaveValue("dsa-77");
  });

  test("người chỉ có getDetails: xem được giá nhập và ghi chú nhưng không có nút Lưu; người không có getDetails không thấy hai ô đó", async ({ page }) => {
    await gotoAs(page, "stockview", "/sales/stock");
    await row(page, NAME1).getByRole("button", { name: "Chi tiết" }).click();
    await expect(dialog(page).getByLabel("Giá nhập")).toBeDisabled();
    await expect(dialog(page).getByLabel("Giá nhập")).toHaveValue("85.000");
    await expect(dialog(page).getByRole("button", { name: "Lưu" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await gotoAs(page, "stocklite", "/sales/stock");
    await row(page, NAME1).getByRole("button", { name: "Chi tiết" }).click();
    await expect(dialog(page).getByLabel("Mã SKU")).toHaveValue("JV-001");
    await expect(dialog(page).getByLabel("Giá nhập")).toHaveCount(0);
    await expect(dialog(page).getByLabel("Ghi chú nội bộ")).toHaveCount(0);
    await expect(dialog(page).getByRole("button", { name: "Lưu" })).toHaveCount(0);
    // BE cũng chặn đọc /details khi thiếu khóa
    const lite = await hdr(page, "stocklite");
    expect((await page.request.get(`/api/sales/stock-items/${BOOK1}/details`, { headers: lite })).status()).toBe(403);
  });

  test("đăng ký mặt hàng: form có các field mới; sai độ dài bị chặn ở BE (400)", async ({ page }) => {
    await gotoAs(page, "salesmgr", "/sales/stock");
    await main(page).getByRole("button", { name: "Đăng ký mặt hàng" }).click();
    const d = dialog(page);
    for (const l of ["Mã SKU", "Nhà cung cấp", "Giá nhập", "Vị trí kho", "Số lượng cần đặt lại", "Ngày nhập gần nhất", "Ghi chú nội bộ"]) {
      await expect(d.getByLabel(l)).toBeVisible();
    }
    const h = await hdr(page, "salesmgr");
    const res = await page.request.put(`/api/sales/stock-items/${BOOK1}/details`, { headers: h, data: { sku: "x".repeat(41) } });
    expect(res.status()).toBe(400);
    // dọn trạng thái dùng chung
    expect((await page.request.put(`/api/sales/stock-items/${BOOK1}/details`, { headers: h, data: {} })).ok()).toBeTruthy();
    expect((await page.request.put(`/api/sales/stock-items/b0000000-0000-4000-8000-000000000002/details`, { headers: h, data: {} })).ok()).toBeTruthy();
  });
});

test.describe("đơn: ghi chú", () => {
  async function seed(page: Page, data: Record<string, unknown>) {
    const res = await page.request.post("/api/sales/_mock/orders", { data });
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as { id: string; orderNo: string };
  }
  const detail = (page: Page) => page.getByRole("dialog").filter({ has: page.getByTestId("order-status") });

  test("chi tiết đơn hiện ghi chú của khách; quản lý lưu ghi chú nội bộ và ngày giao, lệch version thì 409 có nút tải lại", async ({ page }) => {
    const o = await seed(page, { fulfilment: "DELIVERY", customerNote: "Gọi trước khi giao" });
    await gotoAs(page, "salesmgr", `/sales/orders/${o.id}`);
    const d = detail(page);
    await expect(d.getByTestId("order-customer-note")).toHaveText("Gọi trước khi giao");
    const card = d.getByTestId("order-notes");
    await card.getByLabel("Ghi chú nội bộ").fill("Khách quen");
    await card.getByLabel("Ngày giao dự kiến").fill("2026-12-01");
    await card.getByRole("button", { name: "Lưu ghi chú" }).click();
    await expect(page.getByText("Đã lưu ghi chú.")).toBeVisible();
    await expect(d.getByTestId("order-expected-date")).toHaveText("01/12/2026");

    // Người khác sửa trước (version tăng) khi form đang mở giữ version cũ.
    const h = await hdr(page, "salesmgr");
    const cur = (await (await page.request.get(`/api/sales/orders/${o.id}/notes`, { headers: h })).json()) as { version: number };
    expect((await page.request.put(`/api/sales/orders/${o.id}/notes`, { headers: h, data: { staffNote: "Người khác sửa", version: cur.version } })).ok()).toBeTruthy();
    await card.getByLabel("Ghi chú nội bộ").fill("Tôi sửa muộn");
    await card.getByRole("button", { name: "Lưu ghi chú" }).click();
    await expect(card.getByText(/vừa được người khác thao tác/)).toBeVisible();
    await card.getByRole("button", { name: "Tải lại" }).click();
    await expect(card.getByLabel("Ghi chú nội bộ")).toHaveValue("Người khác sửa");
  });

  test("đơn nhận tại quầy: không nhập được ngày giao; chỉ có getNotes thì xem không sửa", async ({ page }) => {
    const o = await seed(page, { fulfilment: "PICKUP" });
    await gotoAs(page, "salesmgr", `/sales/orders/${o.id}`);
    const d = detail(page);
    await expect(d.getByTestId("order-notes").getByLabel("Ngày giao dự kiến")).toBeEnabled();
    const pos = await seed(page, { channel: "POS", status: "COMPLETED", fulfilment: "COUNTER" });
    await gotoAs(page, "salesmgr", `/sales/orders/${pos.id}`);
    await expect(detail(page).getByTestId("order-notes").getByLabel("Ngày giao dự kiến")).toBeDisabled();

    await gotoAs(page, "stockview", `/sales/orders/${o.id}`);
    const ro = detail(page).getByTestId("order-notes");
    await expect(ro).toContainText("Ngày giao dự kiến");
    await expect(ro.getByRole("button", { name: "Lưu ghi chú" })).toHaveCount(0);
  });

  test("POS: ô Ghi chú của khách được gửi lên và hiện ở chi tiết đơn", async ({ page }) => {
    await gotoAs(page, "salesmgr", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    await main(page).getByText("Tiền mặt", { exact: true }).click();
    await main(page).getByLabel("Ghi chú của khách (tùy chọn)").fill("Gói quà giúp");
    await main(page).getByRole("button", { name: "Thanh toán" }).click();
    await page.getByLabel("Tiền khách đưa").fill("200000");
    await page.getByRole("button", { name: "Xác nhận đã thu" }).click();
    await expect(main(page).getByTestId("pos-done")).toContainText("Đã bán đơn DH-");
    const h = await hdr(page, "salesmgr");
    const list = (await (await page.request.get("/api/sales/orders?page=0&size=5", { headers: h })).json()) as { items: { channel: string; customerNote: string | null }[] };
    expect(list.items.find((x) => x.channel === "POS")?.customerNote).toBe("Gói quà giúp");
  });
});
