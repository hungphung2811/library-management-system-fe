import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar, type UserKey } from "./helpers";

// Module bán hàng pha 2 (nhân viên): đơn online, thao tác đơn, trả hàng (trong hạn, quá hạn), hoàn tiền, nhật ký, ma trận khóa.
// Mock: e2e/mock/sales-online.mjs. Khách đặt hàng qua customer-api (ngoài FE nhân viên) nên đơn được dựng bằng POST /api/sales/_mock/orders.
// Mock dùng chung 2 worker: mỗi test dựng đơn riêng và chỉ kiểm theo đơn đó, không giả định tồn/đếm tuyệt đối.

const ISBN1 = "9786040000011";
const BOOK1 = "b0000000-0000-4000-8000-000000000001";
const main = (page: Page) => page.getByRole("main");

type Order = { id: string; orderNo: string; version: number; status: string; paymentStatus: string; grandTotal: number };
type Seed = Partial<{
  channel: string;
  fulfilment: string;
  paymentMethod: string;
  quantity: number;
  status: string;
  paid: boolean;
  ageHours: number;
  completedAgoDays: number;
}>;

async function seed(request: APIRequestContext, data: Seed = {}): Promise<Order> {
  const res = await request.post("/api/sales/_mock/orders", { data });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Order;
}

async function hdr(request: APIRequestContext, user: UserKey) {
  return bearer(await loginApi(request, user));
}

// Chi tiết đơn là modal (giữ URL, danh sách ở nền): phân biệt modal chi tiết với hộp thoại thao tác lồng bên trong.
const detail = (page: Page) => page.getByRole("dialog").filter({ has: page.getByTestId("order-status") });
const actionDialog = (page: Page) => page.getByRole("dialog").filter({ hasNot: page.getByTestId("order-status") });
const statusOf = (page: Page) => detail(page).getByTestId("order-status");
const openOrder = async (page: Page, user: UserKey, o: Order) => {
  await gotoAs(page, user, `/sales/orders/${o.id}`);
  await expect(detail(page).getByTestId("order-status")).toBeVisible();
};

test.describe("bán hàng pha 2: nav và ma trận khóa", () => {
  test("quản lý thấy Hoàn tiền và Nhật ký; thu ngân không thấy và vào thẳng URL bị chặn", async ({ page }) => {
    await gotoAs(page, "salesmgr", "/");
    await expect(sidebar(page).getByRole("link", { name: "Hoàn tiền" })).toHaveAttribute("href", "/sales/refunds");
    await expect(sidebar(page).getByRole("link", { name: "Nhật ký" })).toHaveAttribute("href", "/sales/audit");
    await gotoAs(page, "cashier", "/");
    await expect(sidebar(page).getByRole("link", { name: "Đơn hàng" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Hoàn tiền" })).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: "Nhật ký" })).toHaveCount(0);
    await page.goto("/sales/refunds");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await page.goto("/sales/audit");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("thu ngân không thấy Hủy đơn, Áp giảm giá, Trả quá hạn; quản lý thấy", async ({ page }) => {
    const pending = await seed(page.request);
    await openOrder(page, "cashier", pending);
    await expect(detail(page).getByRole("button", { name: "Xác nhận đơn" })).toBeVisible();
    await expect(detail(page).getByRole("button", { name: "Hủy đơn" })).toHaveCount(0);
    await expect(detail(page).getByRole("button", { name: "Áp giảm giá" })).toHaveCount(0);
    await openOrder(page, "salesmgr", pending);
    await expect(detail(page).getByRole("button", { name: "Hủy đơn" })).toBeVisible();
    await expect(detail(page).getByRole("button", { name: "Áp giảm giá" })).toBeVisible();

    const late = await seed(page.request, { status: "COMPLETED", paid: true, completedAgoDays: 30 });
    await openOrder(page, "cashier", late);
    await detail(page).getByRole("button", { name: "Tạo phiếu trả" }).click();
    const dlg = actionDialog(page);
    await dlg.getByLabel(/Số lượng trả/).fill("1");
    await dlg.getByLabel("Lý do trả hàng").fill("Khách đổi ý");
    await dlg.getByRole("button", { name: "Tạo phiếu trả" }).click();
    await expect(dlg.getByText("Đơn đã quá hạn trả hàng.", { exact: true })).toBeVisible();
    await expect(dlg.getByText(/Hạn trả hàng \d+ ngày, đã quá \d+ ngày/)).toBeVisible();
    await expect(dlg.getByRole("button", { name: "Trả quá hạn (quản lý cho phép)" })).toHaveCount(0);
    await expect(dlg.getByText(/Chỉ quản lý được phép cho trả quá hạn/)).toBeVisible();
  });

  test("người xem đơn không có khóa getContact thấy thông tin đã che; admin xem đầy đủ kèm địa chỉ", async ({ page }) => {
    const o = await seed(page.request);
    await openOrder(page, "salesmgr", o);
    const c = detail(page).getByTestId("order-contact");
    await expect(c).toContainText("N*** V*** K***");
    await expect(c).toContainText("***, Quận 1, TP Hồ Chí Minh");
    await expect(c).not.toContainText("12 Lê Lợi");
    await expect(c.getByRole("button", { name: "Xem thông tin đầy đủ" })).toHaveCount(0);
    await openOrder(page, "salesadmin", o);
    await detail(page).getByRole("button", { name: "Xem thông tin đầy đủ" }).click();
    await expect(detail(page).getByTestId("order-contact")).toContainText("12 Lê Lợi, Quận 1, TP Hồ Chí Minh");
  });
});

test.describe("bán hàng pha 2: đơn online", () => {
  test("danh sách lọc theo kênh và 'chưa thu quá X giờ'; không có hủy tự động", async ({ page }) => {
    const old = await seed(page.request, { ageHours: 30 });
    const fresh = await seed(page.request, { ageHours: 1 });
    await gotoAs(page, "salesmgr", `/sales/orders?q=${old.orderNo}`);
    await expect(main(page).getByRole("link", { name: old.orderNo })).toBeVisible();
    await expect(main(page).getByText("Chờ xác nhận").first()).toBeVisible();
    await expect(main(page).getByText("Chưa thu").first()).toBeVisible();

    await page.goto(`/sales/orders?q=${old.orderNo}&overdue=24`);
    await expect(main(page).getByRole("link", { name: old.orderNo })).toBeVisible();
    await expect(main(page).getByTestId("overdue-hint")).toContainText("không tự hủy");
    await page.goto(`/sales/orders?q=${fresh.orderNo}&overdue=24`);
    await expect(main(page).getByText("Không có đơn hàng nào.")).toBeVisible();

    // Bộ lọc kênh: đơn online không hiện ở kênh "Tại quầy".
    await page.goto(`/sales/orders?q=${fresh.orderNo}&channel=POS`);
    await expect(main(page).getByText("Không có đơn hàng nào.")).toBeVisible();
    await page.goto(`/sales/orders?q=${fresh.orderNo}&channel=ONLINE`);
    await expect(main(page).getByRole("link", { name: fresh.orderNo })).toBeVisible();
  });

  test("luồng giao hàng: xác nhận kèm phí ship, giảm giá, giao, thu tiền rồi hoàn tất", async ({ page }) => {
    const o = await seed(page.request, { fulfilment: "DELIVERY", paymentMethod: "BANK_TRANSFER" });
    await openOrder(page, "salesmgr", o);
    await expect(statusOf(page)).toHaveText("Chờ xác nhận");
    await expect(detail(page).getByTestId("order-payment")).toContainText("Chưa thu");

    // Áp giảm giá 10% cả đơn (chỉ khi có khóa).
    await detail(page).getByRole("button", { name: "Áp giảm giá" }).click();
    const dd = actionDialog(page);
    await dd.getByLabel("Giảm giá cả đơn: loại").click();
    await page.getByTitle("%", { exact: true }).click();
    await dd.getByLabel("Giảm giá cả đơn: giá trị").fill("10");
    await dd.getByRole("button", { name: "Áp giảm giá" }).click();
    await expect(dd).toBeHidden();
    await expect(detail(page).getByText("-12.000")).toBeVisible();

    // Xác nhận kèm phí ship 25.000.
    await detail(page).getByRole("button", { name: "Xác nhận đơn" }).click();
    const cd = actionDialog(page);
    await cd.getByLabel("Phí vận chuyển (đồng)").fill("25000");
    await cd.getByRole("button", { name: "Xác nhận đơn" }).click();
    await expect(cd).toBeHidden();
    await expect(statusOf(page)).toHaveText("Đã xác nhận");
    await expect(detail(page).getByText("Phí vận chuyển")).toBeVisible();
    await expect(detail(page).getByText("25.000").first()).toBeVisible();

    // Giao hàng khi chưa thu: không thể hoàn tất.
    await detail(page).getByRole("button", { name: "Đang giao" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Đang giao" }).click();
    await expect(statusOf(page)).toHaveText("Đang giao");
    await expect(detail(page).getByRole("button", { name: "Hoàn tất" })).toBeDisabled();
    await expect(detail(page).getByText(/Chỉ hoàn tất được khi đơn đã được đánh dấu thu tiền/)).toBeVisible();

    // Đánh dấu đã thu (COD hoặc chuyển khoản), rồi hoàn tất.
    await detail(page).getByRole("button", { name: "Đánh dấu đã thu" }).click();
    const pd = actionDialog(page);
    await expect(pd).toContainText("Số tiền thu");
    await pd.getByLabel("Mã tham chiếu giao dịch (tùy chọn)").fill("FT123");
    await pd.getByRole("button", { name: "Đánh dấu đã thu" }).click();
    await expect(pd).toBeHidden();
    await expect(detail(page).getByTestId("order-payment")).toContainText("Đã thu");
    await expect(detail(page).getByRole("button", { name: "Đánh dấu đã thu" })).toHaveCount(0);
    await detail(page).getByRole("button", { name: "Hoàn tất" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Hoàn tất" }).click();
    await expect(statusOf(page)).toHaveText("Hoàn tất");
    await expect(detail(page).getByRole("button", { name: "Hủy đơn" })).toHaveCount(0);
    await expect(detail(page).getByTestId("returns-panel")).toBeVisible();
  });

  test("hoàn tất khi chưa thu bị ORDER_NOT_PAID (qua API); nhận tại cửa hàng không có ô phí ship", async ({ page }) => {
    const h = await hdr(page.request, "salesmgr");
    const o = await seed(page.request, { fulfilment: "PICKUP", paymentMethod: "CASH", status: "READY_FOR_PICKUP" });
    const res = await page.request.post(`/api/sales/orders/${o.id}/completion`, { headers: h, data: {} });
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("ORDER_NOT_PAID");

    const p = await seed(page.request, { fulfilment: "PICKUP", paymentMethod: "CASH" });
    await openOrder(page, "salesmgr", p);
    await detail(page).getByRole("button", { name: "Xác nhận đơn" }).click();
    await expect(actionDialog(page).getByLabel("Phí vận chuyển (đồng)")).toHaveCount(0);
    await actionDialog(page).getByRole("button", { name: "Xác nhận đơn" }).click();
    await expect(statusOf(page)).toHaveText("Đã xác nhận");
    await detail(page).getByRole("button", { name: "Sẵn sàng nhận" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Sẵn sàng nhận" }).click();
    await expect(statusOf(page)).toHaveText("Sẵn sàng nhận");
  });

  test("hủy đơn đã thu: bắt buộc lý do, hoàn tồn, sinh khoản hoàn chờ hoàn", async ({ page }) => {
    const h = await hdr(page.request, "salesmgr");
    const o = await seed(page.request, { status: "CONFIRMED", paid: true });
    await openOrder(page, "salesmgr", o);
    await detail(page).getByRole("button", { name: "Hủy đơn" }).click();
    const dlg = actionDialog(page);
    await expect(dlg).toContainText("tạo khoản hoàn");
    await dlg.getByRole("button", { name: "Hủy đơn" }).click();
    await expect(dlg.getByText("Nhập lý do hủy")).toBeVisible();
    await dlg.getByLabel("Lý do hủy").fill("Khách không nhận hàng");
    await dlg.getByRole("button", { name: "Hủy đơn" }).click();
    await expect(dlg).toBeHidden();
    await expect(statusOf(page)).toHaveText("Đã hủy");
    await expect(detail(page).getByTestId("order-cancel-reason")).toHaveText("Khách không nhận hàng");

    // Hàng giữ được nhả (sổ cái RESERVE rồi RELEASE cho đúng đơn này) và có khoản hoàn chờ hoàn.
    const ledger = (await (await page.request.get(`/api/sales/stock-items/${BOOK1}/ledger?size=100`, { headers: h })).json()) as { items: { type: string; refId: string }[] };
    const types = ledger.items.filter((e) => e.refId === o.id).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["RESERVE", "RELEASE"]));
    const refunds = (await (await page.request.get("/api/sales/refunds?status=PENDING&size=100", { headers: h })).json()) as { items: { orderId: string; source: string }[] };
    expect(refunds.items.some((r) => r.orderId === o.id && r.source === "CANCELLATION")).toBeTruthy();
  });

  test("hai người cùng thao tác: thao tác sau nhận 409, hiện rõ và có nút tải lại", async ({ page }) => {
    const cashier = await hdr(page.request, "cashier");
    // (a) Hai người cùng đánh dấu đã thu.
    const a = await seed(page.request, { status: "CONFIRMED" });
    await openOrder(page, "salesmgr", a);
    expect((await page.request.post(`/api/sales/orders/${a.id}/payment`, { headers: cashier, data: { method: "CASH" } })).ok()).toBeTruthy();
    await detail(page).getByRole("button", { name: "Đánh dấu đã thu" }).click();
    const dlg = actionDialog(page);
    await dlg.getByRole("button", { name: "Đánh dấu đã thu" }).click();
    await expect(dlg.getByText(/vừa được người khác thao tác/)).toBeVisible();
    await dlg.getByRole("button", { name: "Hủy" }).click();

    // (b) Người kia sang "sẵn sàng nhận" trước: nút của người này đã cũ, bấm thì báo xung đột và tải lại được.
    const b = await seed(page.request, { status: "CONFIRMED", fulfilment: "PICKUP", paid: true });
    await openOrder(page, "salesmgr", b);
    expect((await page.request.post(`/api/sales/orders/${b.id}/ready-for-pickup`, { headers: cashier, data: {} })).ok()).toBeTruthy();
    await detail(page).getByRole("button", { name: "Sẵn sàng nhận" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Sẵn sàng nhận" }).click();
    await expect(detail(page).getByText(/vừa được người khác thao tác/)).toBeVisible();
    await detail(page).getByRole("button", { name: "Tải lại đơn" }).click();
    await expect(statusOf(page)).toHaveText("Sẵn sàng nhận");
    await expect(detail(page).getByText(/vừa được người khác thao tác/)).toHaveCount(0);
  });
});

test.describe("bán hàng pha 2: trả hàng, đổi hàng", () => {
  test("trả trong hạn: tạo phiếu, khoản hoàn theo tỷ lệ; vượt số lượng bị RETURN_QUANTITY_EXCEEDED; đổi hàng mở POS", async ({ page }) => {
    const h = await hdr(page.request, "salesmgr");
    const o = await seed(page.request, { status: "COMPLETED", paid: true, quantity: 2 });
    await openOrder(page, "salesmgr", o);
    await detail(page).getByRole("button", { name: "Tạo phiếu trả" }).click();
    const dlg = actionDialog(page);
    await dlg.getByLabel("Lý do trả hàng").fill("Sách bị rách bìa");
    await dlg.getByRole("button", { name: "Tạo phiếu trả" }).click();
    await expect(dlg.getByText("Chọn ít nhất một dòng và số lượng trả.")).toBeVisible();
    await dlg.getByLabel(/Số lượng trả/).fill("1");
    await dlg.getByLabel(/Tình trạng/).click();
    await page.getByTitle("Hao hụt (xuất hủy)").click();
    await dlg.getByRole("button", { name: "Tạo phiếu trả" }).click();
    await expect(dlg).toBeHidden();
    const panel = detail(page).getByTestId("returns-panel");
    await expect(panel.getByRole("button", { name: /^TH-/ })).toHaveCount(1);

    // 240.000 + VAT 10% = 264.000 cho 2 cuốn: trả 1 cuốn hoàn 132.000, khoản hoàn chờ hoàn.
    const refunds = (await (await page.request.get("/api/sales/refunds?status=PENDING&size=100", { headers: h })).json()) as { items: { orderId: string; source: string; amount: number }[] };
    expect(refunds.items.find((r) => r.orderId === o.id && r.source === "RETURN")?.amount).toBe(132000);

    // Số lượng vượt "đã mua trừ đã trả" (còn 1): BE từ chối.
    const line = ((await (await page.request.get(`/api/sales/orders/${o.id}`, { headers: h })).json()) as { lines: { id: string }[] }).lines[0];
    const over = await page.request.post("/api/sales/returns", {
      headers: h,
      data: { orderId: o.id, lines: [{ orderLineId: line.id, quantity: 2, disposition: "RESTOCK" }], reason: "x", clientRequestId: `over-${o.id}` },
    });
    expect(over.status()).toBe(409);
    expect(((await over.json()) as { code: string }).code).toBe("RETURN_QUANTITY_EXCEEDED");

    // Chi tiết phiếu.
    await panel.getByRole("button", { name: /^TH-/ }).click();
    await expect(page.getByTestId("return-detail")).toContainText("Sách bị rách bìa");
    await expect(page.getByTestId("return-detail")).toContainText("Hao hụt (xuất hủy)");
    await page.keyboard.press("Escape");

    // Đổi hàng: mở POS với phiếu trả, đơn mới gửi kèm exchangeOfReturnId.
    const posts: Record<string, unknown>[] = [];
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/sales/pos-orders") && posts.push(r.postDataJSON() as Record<string, unknown>));
    await panel.getByRole("link", { name: "Đổi hàng" }).click();
    await expect(page).toHaveURL(/\/sales\/pos\?exchangeOfReturnId=/);
    await expect(main(page).getByTestId("pos-exchange")).toContainText("Chênh lệch tiền được xử lý ngoài hệ thống");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    await main(page).getByRole("button", { name: "Thanh toán" }).click();
    await page.getByLabel("Tiền khách đưa").fill("200000");
    await page.getByRole("button", { name: "Xác nhận đã thu" }).click();
    await expect(main(page).getByTestId("pos-done")).toBeVisible();
    expect(posts[0]?.exchangeOfReturnId).toBeTruthy();
  });

  test("trả quá hạn: create bị RETURN_WINDOW_EXPIRED; quản lý trả quá hạn với lý do bắt buộc (createLate)", async ({ page }) => {
    const h = await hdr(page.request, "salesmgr");
    const o = await seed(page.request, { status: "COMPLETED", paid: true, quantity: 1, completedAgoDays: 40 });
    await openOrder(page, "salesmgr", o);
    await detail(page).getByRole("button", { name: "Tạo phiếu trả" }).click();
    const dlg = actionDialog(page);
    await dlg.getByLabel(/Số lượng trả/).fill("1");
    await dlg.getByLabel("Lý do trả hàng").fill("Khách ốm không đến trả kịp");
    await dlg.getByRole("button", { name: "Tạo phiếu trả" }).click();
    await expect(dlg.getByText("Đơn đã quá hạn trả hàng.", { exact: true })).toBeVisible();
    const lateBtn = dlg.getByRole("button", { name: "Trả quá hạn (quản lý cho phép)" });
    await expect(lateBtn).toBeVisible();
    await expect(dlg.getByRole("button", { name: "Tạo phiếu trả", exact: true })).toHaveCount(0);

    await lateBtn.click();
    await expect(dlg.getByText("Trả quá hạn bắt buộc nhập lý do.")).toBeVisible();
    await dlg.getByLabel(/Lý do cho phép trả quá hạn/).fill("Quản lý đồng ý do khách nhập viện");
    await lateBtn.click();
    await expect(dlg).toBeHidden();
    await expect(detail(page).getByTestId("returns-panel").getByText(/Quá \d+ ngày/)).toBeVisible();

    const audit = (await (await page.request.get(`/api/sales/audit-log?action=RETURN_LATE_APPROVED&size=100`, { headers: h })).json()) as { items: { data: { lateReason: string } }[] };
    expect(audit.items.some((a) => a.data.lateReason === "Quản lý đồng ý do khách nhập viện")).toBeTruthy();
  });
});

test.describe("bán hàng pha 2: hoàn tiền và nhật ký", () => {
  test("đánh dấu đã hoàn một khoản hoàn từ hủy đơn đã thu", async ({ page }) => {
    const h = await hdr(page.request, "salesmgr");
    const o = await seed(page.request, { status: "CONFIRMED", paid: true });
    const cancel = await page.request.post(`/api/sales/orders/${o.id}/cancellation`, { headers: h, data: { reason: "Hết hàng thật" } });
    expect(cancel.ok()).toBeTruthy();

    await gotoAs(page, "salesmgr", "/sales/refunds?status=PENDING");
    const row = main(page).getByRole("row", { name: new RegExp(o.id.slice(0, 8)) });
    await expect(row).toContainText("Hủy đơn đã thu");
    await expect(row).toContainText("Chờ hoàn");
    await row.getByRole("button", { name: "Đánh dấu đã hoàn" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByTestId("refund-confirm")).toContainText("Hủy đơn đã thu");
    await expect(dlg.getByTestId("refund-confirm")).toContainText(/\d/);
    await dlg.getByLabel("Mã tham chiếu (tùy chọn)").fill("RF-1");
    await dlg.getByRole("button", { name: "Đánh dấu đã hoàn" }).click();
    await expect(dlg).toBeHidden();
    await expect(main(page).getByRole("row", { name: new RegExp(o.id.slice(0, 8)) })).toHaveCount(0);

    await page.goto("/sales/refunds?status=REFUNDED");
    const done = main(page).getByRole("row", { name: new RegExp(o.id.slice(0, 8)) });
    await expect(done).toContainText("Đã hoàn");
    await expect(done).toContainText("RF-1");
    const order = (await (await page.request.get(`/api/sales/orders/${o.id}`, { headers: h })).json()) as Order;
    expect(order.paymentStatus).toBe("REFUNDED");
  });

  test("nhật ký ghi người, thời điểm, tham chiếu; lọc theo hành động; không có dữ liệu cá nhân", async ({ page }) => {
    const h = await hdr(page.request, "salesmgr");
    const o = await seed(page.request, { status: "CONFIRMED" });
    expect((await page.request.post(`/api/sales/orders/${o.id}/payment`, { headers: h, data: { method: "BANK_TRANSFER" } })).ok()).toBeTruthy();
    await gotoAs(page, "salesmgr", "/sales/audit?action=ORDER_PAID");
    const row = main(page).getByRole("row", { name: new RegExp(`Đơn hàng ${o.id.slice(0, 8)}`) });
    await expect(row).toContainText("Đánh dấu đã thu");
    await expect(row).toContainText("salesmgr");
    await expect(row.getByRole("link", { name: /Đơn hàng/ })).toHaveAttribute("href", `/sales/orders/${o.id}`);
    await expect(main(page)).not.toContainText("Nguyễn Văn Khách");
    await expect(main(page)).not.toContainText("0912345678");
  });
});
