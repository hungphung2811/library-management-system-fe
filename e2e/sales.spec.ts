import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar, type UserKey } from "./helpers";

// Module bán hàng (SALES): nav theo module và khóa, bán tại quầy (có/không giảm giá), nhập kho, cấu hình.
// Mock: e2e/mock/sales.mjs (tồn kho dùng chung 2 worker: mỗi test chỉ bán/nhập ít và không giả định tồn tuyệt đối).

const BOOK1 = "b0000000-0000-4000-8000-000000000001";
const BOOK2 = "b0000000-0000-4000-8000-000000000002";
const ISBN1 = "9786040000011";
const main = (page: Page) => page.getByRole("main");
let n = 0;
const uid = () => `${(Date.now() % 1e7).toString(36)}${process.env.TEST_PARALLEL_INDEX ?? 0}${++n}`;

async function api(page: Page, user: UserKey) {
  return bearer(await loginApi(page.request, user));
}

test.describe("bán hàng: nav và quyền", () => {
  test("thu ngân chỉ thấy mục Bán tại quầy; tài khoản không có module SALES không thấy nhóm Bán hàng", async ({ page }) => {
    await gotoAs(page, "seller", "/");
    await expect(sidebar(page).getByRole("link", { name: "Bán tại quầy" })).toHaveAttribute("href", "/sales/pos");
    await expect(sidebar(page).getByRole("link", { name: "Tồn kho" })).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: "Cấu hình bán hàng" })).toHaveCount(0);
    await gotoAs(page, "admin", "/");
    await expect(sidebar(page).getByRole("link", { name: "Bán tại quầy" })).toHaveCount(0);
    await gotoAs(page, "salesadmin", "/");
    for (const l of ["Bán tại quầy", "Đơn hàng", "Tồn kho", "Phiếu nhập kho", "Nhà cung cấp", "Cấu hình bán hàng"]) {
      await expect(sidebar(page).getByRole("link", { name: l })).toBeVisible();
    }
  });

  test("vào thẳng URL khi thiếu khóa hoặc module thì thấy trang không có quyền", async ({ page }) => {
    await gotoAs(page, "seller", "/sales/stock");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await gotoAs(page, "admin", "/sales/pos");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });
});

test.describe("bán hàng: POS", () => {
  test("thu ngân quét ISBN, thanh toán tiền mặt, xem phiếu; không có ô giảm giá", async ({ page }) => {
    await gotoAs(page, "seller", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    await expect(main(page).getByTestId("cart-line")).toContainText("Lập trình Java cơ bản");
    await expect(main(page).getByRole("group", { name: /Giảm giá/ })).toHaveCount(0);
    await expect(main(page).getByTestId("pos-estimate")).toContainText("120.000");
    await main(page).getByText("Tiền mặt", { exact: true }).click();
    await main(page).getByLabel("Tên khách (tùy chọn)").fill("Khách thử");
    await main(page).getByRole("button", { name: "Thanh toán" }).click();
    // Hai bước: đơn ra AWAITING_PAYMENT, thu ngân phải xác nhận đã thu (tiền mặt: nhập tiền khách đưa, hiện tiền thối).
    await expect(page.getByTestId("manual-panel")).toBeVisible();
    await expect(page.getByTestId("manual-amount")).toContainText("132.000");
    const confirmBtn = page.getByRole("button", { name: "Xác nhận đã thu" });
    await expect(confirmBtn).toBeDisabled();
    await page.getByLabel("Tiền khách đưa").fill("100000");
    await expect(page.getByTestId("manual-change")).toContainText("32.000");
    await expect(confirmBtn).toBeDisabled();
    await page.getByLabel("Tiền khách đưa").fill("150000");
    await expect(page.getByTestId("manual-change")).toContainText("18.000");
    await confirmBtn.click();
    await expect(main(page).getByTestId("pos-done")).toContainText("Đã bán đơn DH-");
    await expect(main(page).getByTestId("sales-receipt")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "In phiếu" })).toBeVisible();
    await main(page).getByRole("button", { name: "Bán đơn mới" }).click();
    await expect(main(page).getByTestId("cart-empty")).toBeVisible();
  });

  test("thanh toán thẻ: bắt buộc mã giao dịch mới xác nhận được; đóng khung giữ chờ, mở lại được", async ({ page }) => {
    await gotoAs(page, "seller", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    await main(page).getByText("Thẻ", { exact: true }).click();
    await main(page).getByRole("button", { name: "Thanh toán" }).click();
    const panel = page.getByTestId("manual-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Tiền khách đưa")).toHaveCount(0);
    const confirmBtn = panel.getByRole("button", { name: "Xác nhận đã thu" });
    await expect(confirmBtn).toBeDisabled();
    await panel.getByRole("button", { name: "Đóng (giữ chờ)" }).click();
    await expect(main(page).getByTestId("qr-pending")).toContainText("chờ xác nhận đã thu");
    await main(page).getByRole("button", { name: "Mở khung thu tiền" }).click();
    await panel.getByLabel(/Mã giao dịch thẻ/).fill("APPR-123456");
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await expect(main(page).getByTestId("pos-done")).toContainText("Đã bán đơn DH-");
  });

  test("quản lý bán có giảm giá dòng: dùng endpoint /discounted, phiếu ra đúng số tiền", async ({ page }) => {
    const reqs: string[] = [];
    page.on("request", (r) => r.method() === "POST" && reqs.push(new URL(r.url()).pathname));
    await gotoAs(page, "salesmgr", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    const disc = main(page).getByRole("group", { name: "Giảm giá Lập trình Java cơ bản" }).getByRole("spinbutton");
    await disc.fill("20000");
    await expect(main(page).getByTestId("pos-estimate")).toContainText("100.000");
    await main(page).getByRole("button", { name: "Thanh toán" }).click();
    await page.getByLabel("Tiền khách đưa").fill("110000");
    await page.getByRole("button", { name: "Xác nhận đã thu" }).click();
    await expect(main(page).getByTestId("pos-done")).toBeVisible();
    expect(reqs).toContain("/api/sales/pos-orders/discounted");
    // 120.000 - 20.000 giảm = 100.000, VAT 10% (mock) = 110.000; cấu hình VAT chỉ test này và test cấu hình (không đổi VAT) dùng chung.
    await expect(main(page).getByTestId("receipt-grand-total")).toContainText("110.000");
  });

  test("danh sách chọn sách: mặc định chỉ còn hàng, lọc theo tên không dấu, thêm vào giỏ", async ({ page }) => {
    // Thu ngân (seller) không có khóa liệt kê tồn nên không thấy danh sách; quản lý bán có.
    await gotoAs(page, "seller", "/sales/pos");
    await expect(main(page).getByTestId("pos-catalog")).toHaveCount(0);
    await gotoAs(page, "salesmgr", "/sales/pos");
    const catalog = main(page).getByTestId("pos-catalog");
    await expect(catalog.getByTestId("pos-catalog-item").first()).toBeVisible();
    // Mặc định bật "Chỉ còn hàng": không dòng nào mang nhãn Hết hàng
    await expect(catalog.getByText("Hết hàng", { exact: true })).toHaveCount(0);
    await catalog.getByLabel("Tìm theo tên hoặc SKU").fill("lap trinh java");
    const items = catalog.getByTestId("pos-catalog-item");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Lập trình Java cơ bản");
    await catalog.getByRole("button", { name: "Thêm Lập trình Java cơ bản" }).click();
    await expect(main(page).getByTestId("cart-line")).toContainText("Lập trình Java cơ bản");
    // Khớp không có: báo trống, "Xóa bộ lọc" trả lại danh sách
    await catalog.getByLabel("Tìm theo tên hoặc SKU").fill("khong-co-sach-nay");
    await expect(catalog.getByText("Không có sách còn hàng khớp bộ lọc")).toBeVisible();
    await catalog.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(catalog.getByTestId("pos-catalog-item").first()).toBeVisible();
  });

  test("tồn không đủ: hiện INSUFFICIENT_STOCK kèm số còn lại và tên sách", async ({ page }) => {
    const h = await api(page, "salesmgr");
    const adj = (delta: number) =>
      page.request.post("/api/sales/stock-adjustments", { headers: h, data: { titleId: BOOK2, delta, reason: "e2e" } });
    await gotoAs(page, "seller", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill("9786040000028");
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toContainText("Cấu trúc dữ liệu và giải thuật");
    const taken = (await (await adj(-2)).json()) as { available: number };
    expect(taken.available).toBe(0);
    await main(page).getByRole("button", { name: "Thanh toán" }).click();
    await expect(main(page).getByText("Tồn kho khả dụng không đủ.")).toBeVisible();
    await expect(main(page).getByText(/«Cấu trúc dữ liệu và giải thuật»: chỉ còn 0 cuốn khả dụng/)).toBeVisible();
    expect((await adj(2)).ok()).toBeTruthy();
  });
});

test.describe("bán hàng: POS thanh toán QR (cổng giả lập)", () => {
  /** Thêm sách 1 vào giỏ, chọn QR và bấm "Tạo mã QR". */
  async function startQr(page: Page, note?: string) {
    await gotoAs(page, "seller", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    if (note) await main(page).getByLabel("Ghi chú của khách (tùy chọn)").fill(note);
    await main(page).getByText("QR", { exact: true }).click();
    await main(page).getByRole("button", { name: "Tạo mã QR" }).click();
    await expect(page.getByTestId("qr-code")).toBeVisible();
  }
  const orderStatus = async (page: Page, orderNo: string) => {
    const h = await api(page, "salesmgr");
    const r = (await (await page.request.get(`/api/sales/orders?keyword=${orderNo}`, { headers: h })).json()) as { items: { orderNo: string; status: string; paymentStatus: string }[] };
    return r.items.find((o) => o.orderNo === orderNo);
  };

  test("MoMo sandbox: có mã QR và gợi ý mở app MoMo test, không có nút giả lập; hủy thanh toán được", async ({ page }) => {
    await gotoAs(page, "seller", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    await main(page).getByText("MoMo (sandbox)", { exact: true }).click();
    await main(page).getByRole("button", { name: "Tạo mã QR" }).click();
    await expect(page.getByTestId("qr-code")).toBeVisible();
    await expect(page.getByTestId("momo-hint")).toContainText("app MoMo");
    await expect(page.getByRole("dialog").getByText("Thanh toán MoMo · đơn ")).toBeVisible();
    await expect(page.getByRole("button", { name: /Giả lập đã thanh toán/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Hủy thanh toán" }).click();
    await page.getByRole("button", { name: "Hủy thanh toán" }).last().click();
    await expect(page.getByTestId("qr-terminal")).toContainText("Đã hủy thanh toán");
  });

  test("SePay test: có mã QR và hướng dẫn Mô phỏng giao dịch với mã tham chiếu, không có nút giả lập", async ({ page }) => {
    await gotoAs(page, "seller", "/sales/pos");
    const scan = main(page).getByLabel("Quét mã ISBN hoặc nhập mã rồi Enter");
    await scan.fill(ISBN1);
    await scan.press("Enter");
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    await main(page).getByText("SePay (test)", { exact: true }).click();
    await main(page).getByRole("button", { name: "Tạo mã QR" }).click();
    await expect(page.getByTestId("qr-code")).toBeVisible();
    await expect(page.getByTestId("sepay-hint")).toContainText("Mô phỏng giao dịch");
    await expect(page.getByTestId("sepay-hint")).toContainText("LMS");
    await expect(page.getByRole("dialog").getByText("Thanh toán SePay · đơn ")).toBeVisible();
    await expect(page.getByRole("button", { name: /Giả lập đã thanh toán/ })).toHaveCount(0);
  });

  test("tạo đơn QR: thấy mã QR, số tiền, tham chiếu và đếm ngược; giả lập thanh toán thì thấy Đã bán đơn", async ({ page }) => {
    await startQr(page);
    await expect(page.getByTestId("qr-amount")).toContainText("132.000");
    await expect(page.getByTestId("qr-reference")).toContainText("LMS");
    await expect(page.getByTestId("qr-countdown")).toHaveText(/^\d\d:\d\d$/);
    await expect(page.getByTestId("qr-status")).toHaveText("Đang chờ thanh toán");
    await expect(page.getByText(/sandbox/).first()).toBeVisible();
    await page.getByRole("button", { name: "Giả lập đã thanh toán (sandbox)" }).click();
    await expect(main(page).getByTestId("pos-done")).toContainText("Đã bán đơn DH-");
    await expect(main(page).getByTestId("sales-receipt")).toBeVisible();
    await main(page).getByRole("button", { name: "Bán đơn mới" }).click();
    await expect(main(page).getByTestId("cart-empty")).toBeVisible();
  });

  test("hủy thanh toán: đơn thành Đã hủy, giỏ còn nguyên; đóng khung thì mở lại được", async ({ page }) => {
    await startQr(page);
    const orderNo = (await page.getByRole("dialog").getByText(/^Thanh toán QR · đơn /).textContent())!.replace("Thanh toán QR · đơn ", "").trim();
    await page.getByRole("button", { name: "Đóng (giữ chờ)" }).click();
    await expect(main(page).getByTestId("qr-pending")).toContainText(orderNo);
    await expect(main(page).getByRole("button", { name: "Tạo mã QR" })).toBeDisabled();
    await main(page).getByRole("button", { name: "Mở mã QR" }).click();
    await expect(page.getByTestId("qr-code")).toBeVisible();
    await page.getByRole("button", { name: "Hủy thanh toán", exact: true }).click();
    await page.getByRole("button", { name: "Hủy thanh toán", exact: true }).last().click();
    await expect(page.getByTestId("qr-terminal")).toContainText("Đã hủy thanh toán");
    await page.getByTestId("qr-panel").getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(main(page).getByTestId("qr-pending")).toHaveCount(0);
    await expect(main(page).getByTestId("cart-line")).toHaveCount(1);
    const o = await orderStatus(page, orderNo);
    expect(o?.status).toBe("CANCELLED");
    expect(o?.paymentStatus).toBe("UNPAID");
  });

  test("hết hạn: báo hết hạn và tạo lại mã QR mới", async ({ page }) => {
    await startQr(page, "QR_SHORT_TTL");
    const ref1 = await page.getByTestId("qr-reference").textContent();
    await expect(page.getByTestId("qr-terminal")).toContainText("Mã QR đã hết hạn", { timeout: 20_000 });
    await page.getByRole("button", { name: "Tạo mã QR mới" }).click();
    await expect(page.getByTestId("qr-code")).toBeVisible();
    await expect(page.getByTestId("qr-reference")).not.toHaveText(ref1!);
    await page.getByRole("button", { name: "Hủy thanh toán", exact: true }).click();
    await page.getByRole("button", { name: "Hủy thanh toán", exact: true }).last().click();
    await expect(page.getByTestId("qr-terminal")).toBeVisible();
  });

  test("đơn chờ thanh toán hiện nhãn Chờ thanh toán ở danh sách đơn và không có nút thao tác", async ({ page }) => {
    await startQr(page);
    const orderNo = (await page.getByRole("dialog").getByText(/^Thanh toán QR · đơn /).textContent())!.replace("Thanh toán QR · đơn ", "").trim();
    await gotoAs(page, "salesmgr", `/sales/orders?keyword=${orderNo}`);
    await expect(main(page).getByText("Chờ thanh toán").first()).toBeVisible();
    const o = await orderStatus(page, orderNo);
    await page.goto(`/sales/orders/${(await (await page.request.get(`/api/sales/orders?keyword=${orderNo}`, { headers: await api(page, "salesmgr") })).json()).items[0].id}`);
    await expect(page.getByTestId("order-status")).toContainText("Chờ thanh toán");
    await expect(page.getByTestId("order-actions")).toHaveCount(0);
    expect(o?.status).toBe("AWAITING_PAYMENT");
  });
});

test.describe("bán hàng: nhập kho và tồn", () => {
  test("tạo phiếu nhập nháp, xác nhận thì tồn tăng", async ({ page }) => {
    const h = await api(page, "salesmgr");
    const name = `NCC-${uid()}`;
    const sup = (await (await page.request.post("/api/sales/suppliers", { headers: h, data: { name } })).json()) as { id: string };
    const stock = async () => ((await (await page.request.get(`/api/sales/stock-items/${BOOK1}`, { headers: h })).json()) as { onHand: number }).onHand;
    const before = await stock();

    await gotoAs(page, "salesmgr", "/sales/receipts");
    await main(page).getByRole("button", { name: "Tạo phiếu nhập" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Nhà cung cấp").click();
    await page.getByTitle(name).click();
    await dlg.getByLabel("Đầu sách").click();
    await dlg.getByLabel("Đầu sách").pressSequentially("Java", { delay: 20 });
    await page.getByTitle(/Lập trình Java cơ bản/).click();
    await dlg.getByLabel("Số lượng").fill("3");
    await dlg.getByLabel("Giá nhập").fill("80000");
    await dlg.getByRole("button", { name: "Tạo phiếu nháp" }).click();
    await expect(dlg).toBeHidden();
    expect(await stock()).toBe(before); // nháp chưa cộng tồn

    await main(page).getByText("Nháp").first().waitFor();
    await main(page).getByRole("button", { name: /^PN-/ }).first().click();
    const detail = page.getByTestId("receipt-detail");
    await expect(detail).toContainText(name);
    await expect(detail).toContainText("240.000");
    await detail.getByRole("button", { name: "Xác nhận nhập kho" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xác nhận nhập kho" }).click();
    await expect(detail.getByText("Phiếu đã xác nhận")).toBeVisible();
    expect(await stock()).toBe(before + 3);
  });
});

test.describe("bán hàng: cấu hình", () => {
  test("sửa số ngày trả hàng, lưu thành công; phiên bản cũ bị từ chối với nút tải lại", async ({ page }) => {
    const h = await api(page, "salesmgr");
    await gotoAs(page, "salesmgr", "/sales/settings");
    const days = main(page).getByLabel("Số ngày cho phép trả hàng");
    await days.fill("14");
    await main(page).getByRole("button", { name: "Lưu cấu hình" }).click();
    await expect(page.getByText("Đã lưu cấu hình bán hàng.")).toBeVisible();
    await expect(days).toHaveValue("14");

    // Người khác sửa trước: form đang mở giữ version cũ nên lưu bị 409.
    const cur = (await (await page.request.get("/api/sales/settings", { headers: h })).json()) as Record<string, unknown>;
    const res = await page.request.put("/api/sales/settings", { headers: h, data: { ...cur, returnWindowDays: 7 } });
    expect(res.ok()).toBeTruthy();
    await days.fill("20");
    await main(page).getByRole("button", { name: "Lưu cấu hình" }).click();
    await expect(main(page).getByText(/vừa được người khác sửa/)).toBeVisible();
    await main(page).getByRole("button", { name: "Tải lại cấu hình" }).click();
    await expect(days).toHaveValue("7");
  });
});
