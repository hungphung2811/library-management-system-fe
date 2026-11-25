import { expect, test, type Page } from "@playwright/test";
import { gotoApp, gotoAs, loginAs } from "./helpers";

// Bám e2e/mock/works-reports.mjs (tác phẩm, báo cáo CSV, ghi nhận tìm lại). Mock dùng chung 2 worker: mỗi test dùng dữ liệu riêng.

const uniq = () => String(Date.now() % 1_000_000) + String(Math.floor(Math.random() * 100));
/** FormModal đặt lại form khi mở và sau animation: đợi animation xong rồi mới nhập. */
const settle = (page: Page) => expect(page.locator(".ant-modal").last()).not.toHaveClass(/ant-zoom/);
const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });

test.describe("tác phẩm (works)", () => {
  test("liệt kê, tìm kiếm và mở chi tiết với danh sách ấn bản", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/works");
    await expect(page.getByRole("heading", { name: "Tác phẩm" })).toBeVisible();
    await expect(row(page, "Harry Potter và Hòn đá Phù thủy")).toContainText("3");
    await page.getByRole("searchbox").first().fill("Sapiens");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=Sapiens/);
    await expect(row(page, "Harry Potter")).toHaveCount(0);
    await page.getByRole("link", { name: "Sapiens: Lược sử loài người", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Sapiens: Lược sử loài người" })).toBeVisible();
    await expect(dialog.getByText("Ấn bản (1)")).toBeVisible();
  });

  test("tạo tác phẩm mới", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/works");
    const name = `Tác phẩm mới ${uniq()}`;
    await page.getByRole("button", { name: /Thêm tác phẩm/ }).click();
    const dialog = page.getByRole("dialog", { name: "Thêm tác phẩm" });
    await settle(page);
    await dialog.getByLabel("Tên tác phẩm").fill(name);
    // Thiếu tác giả: BE trả INVALID_WORK, hộp thoại giữ nguyên và hiện lỗi.
    await dialog.getByRole("button", { name: "Tạo" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Thông tin tác phẩm chưa hợp lệ");
    await dialog.getByLabel("Tác giả", { exact: true }).fill("Tác giả thử");
    const post = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/works"));
    await dialog.getByRole("button", { name: "Tạo" }).click();
    expect((await post).postDataJSON()).toMatchObject({ title: name, author: "Tác giả thử", kind: "SINGLE", seriesId: null, authorIds: [] });
    await expect(page.getByText("Đã lưu tác phẩm.")).toBeVisible();
  });

  test("sửa tác phẩm: nạp chi tiết rồi gửi PUT đủ trường", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/works?q=Tác phẩm để sửa");
    await page.getByRole("button", { name: "Sửa Tác phẩm để sửa" }).click();
    const dialog = page.getByRole("dialog", { name: /Sửa tác phẩm/ });
    await settle(page);
    await expect(dialog.getByLabel("Mô tả")).toHaveValue("Mô tả cũ");
    await dialog.getByLabel("Mô tả").fill("Mô tả mới");
    const put = page.waitForRequest((r) => r.method() === "PUT" && /\/api\/works\//.test(r.url()));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await put).postDataJSON()).toMatchObject({ title: "Tác phẩm để sửa", description: "Mô tả mới", author: "Tác giả cũ" });
  });

  test("gộp hai tác phẩm nguồn vào tác phẩm đích", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/works?q=Tác phẩm gộp");
    await expect(row(page, "Tác phẩm gộp nguồn B")).toBeVisible();
    await page.getByRole("button", { name: "Gộp vào Tác phẩm gộp đích A" }).click();
    const dialog = page.getByRole("dialog", { name: /Gộp vào/ });
    await settle(page);
    await dialog.getByRole("combobox").click();
    await page.locator('.ant-select-item-option[title="Tác phẩm gộp nguồn B — Tác giả gộp"]').click();
    await page.locator('.ant-select-item-option[title="Tác phẩm gộp nguồn C — Tác giả gộp"]').click();
    await page.keyboard.press("Escape");
    const post = page.waitForRequest((r) => r.method() === "POST" && /\/merge$/.test(r.url()));
    await dialog.getByRole("button", { name: "Gộp" }).click();
    expect((await post).postDataJSON().sourceWorkIds).toHaveLength(2);
    await expect(page.getByText("Đã gộp tác phẩm.")).toBeVisible();
    await expect(row(page, "Tác phẩm gộp nguồn B")).toHaveCount(0);
    await expect(row(page, "Tác phẩm gộp đích A")).toContainText("3");
  });

  test("chỉ có quyền xem: ẩn nút thêm, sửa, gộp", async ({ page }) => {
    await gotoAs(page, "workview", "/catalog/works");
    await expect(row(page, "Harry Potter và Hòn đá Phù thủy")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm tác phẩm/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Sửa / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Gộp vào / })).toHaveCount(0);
  });

  test("đổi tác phẩm của ấn bản: tách thành tác phẩm mới", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog?q=Sách đã mất được tìm lại");
    await page.getByRole("table").getByRole("link", { name: "Sách đã mất được tìm lại" }).first().click();
    const detail = page.getByRole("dialog");
    await expect(detail.getByRole("link", { name: "Harry Potter và Hòn đá Phù thủy" })).toBeVisible();
    await detail.getByRole("button", { name: "Đổi tác phẩm" }).click();
    const dialog = page.getByRole("dialog", { name: /Đổi tác phẩm/ });
    await settle(page);
    await dialog.getByText("Tách thành tác phẩm mới").click();
    const title = `Tác phẩm tách ${uniq()}`;
    await dialog.getByLabel("Tên tác phẩm mới").fill(title);
    const put = page.waitForRequest((r) => r.method() === "PUT" && /\/work$/.test(r.url()));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    expect((await put).postDataJSON()).toEqual({ newWork: { title, kind: "SINGLE" } });
    await expect(page.getByText("Đã đổi tác phẩm của ấn bản.")).toBeVisible();
  });
});

test.describe("ghi nhận tìm lại sách đã mất", () => {
  async function openLostBook(page: Page) {
    await loginAs(page, "admin");
    await gotoApp(page, `/catalog?q=${encodeURIComponent("Sách đã mất được tìm lại")}`);
    await page.getByRole("table").getByRole("link", { name: "Sách đã mất được tìm lại" }).first().click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Sách đã mất được tìm lại" })).toBeVisible();
  }

  test("gửi đề nghị hoàn khoản; gửi lại thì báo đã có đề nghị", async ({ page }) => {
    await openLostBook(page);
    await row(page, "LOSTFOUND01").getByRole("button", { name: "Ghi nhận tìm lại LOSTFOUND01" }).click();
    const dialog = page.getByRole("dialog", { name: /Ghi nhận tìm lại/ });
    await settle(page);
    await dialog.getByLabel("Ghi chú kiểm tra").fill("Còn nguyên bìa");
    const post = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/borrowings/found"));
    await dialog.getByRole("button", { name: "Gửi đề nghị" }).click();
    const body = (await post).postDataJSON();
    expect(body).toMatchObject({ restoreStatus: "AVAILABLE", refundMethod: "CASH", checkNote: "Còn nguyên bìa", referenceCode: null });
    expect(body.bookCopyId).toBeTruthy();
    await expect(page.getByText("Đã gửi đề nghị hoàn khoản chờ duyệt.")).toBeVisible();
    // Lần hai trên cùng bản sao: 409 REFUND_ALREADY_EXISTS, hộp thoại giữ nguyên.
    await row(page, "LOSTFOUND01").getByRole("button", { name: "Ghi nhận tìm lại LOSTFOUND01" }).click();
    const again = page.getByRole("dialog", { name: /Ghi nhận tìm lại/ });
    await settle(page);
    await again.getByRole("button", { name: "Gửi đề nghị" }).click();
    await expect(again.locator(".ant-alert-error")).toContainText("đã có đề nghị hoàn khoản");
  });

  test("thiếu khóa reportFound thì không có nút", async ({ page }) => {
    await loginAs(page, "librarian");
    await gotoApp(page, `/catalog?q=${encodeURIComponent("Sách đã mất được tìm lại")}`);
    await page.getByRole("table").getByRole("link", { name: "Sách đã mất được tìm lại" }).first().click();
    await expect(row(page, "LOSTFOUND02")).toBeVisible();
    await expect(page.getByRole("button", { name: /Ghi nhận tìm lại/ })).toHaveCount(0);
  });
});

test.describe("báo cáo CSV", () => {
  test("xuất ba báo cáo, gửi đúng bộ lọc và cảnh báo khi bị cắt", async ({ page }) => {
    await gotoAs(page, "salesadmin", "/reports");
    await expect(page.getByRole("heading", { name: "Báo cáo" })).toBeVisible();

    const overdue = page.getByTestId("report-overdue");
    const dl1 = page.waitForEvent("download");
    await overdue.getByRole("button", { name: "Xuất CSV" }).click();
    expect((await dl1).suggestedFilename()).toBe("overdue-borrowings-20261119.csv");
    await expect(page.getByText("Đã tải báo cáo.")).toBeVisible();

    const stock = page.getByTestId("report-stock");
    await stock.getByText("Chỉ mặt hàng sắp hết").click();
    const req = page.waitForRequest((r) => r.url().includes("/api/reports/stock"));
    await stock.getByRole("button", { name: "Xuất CSV" }).click();
    expect((await req).url()).toContain("lowStockOnly=true");

    const orders = page.getByTestId("report-orders");
    await orders.getByRole("combobox", { name: "Kênh bán" }).click();
    await page.locator('.ant-select-item-option[title="Tại quầy"]').click();
    const req2 = page.waitForRequest((r) => r.url().includes("/api/reports/orders"));
    await orders.getByRole("button", { name: "Xuất CSV" }).click();
    expect((await req2).url()).toContain("channel=POS");
    await expect(page.getByText(/bị cắt ở 10\.000 dòng/).last()).toBeVisible();
  });

  test("không có khóa báo cáo thì trang báo không có quyền và không có mục menu", async ({ page }) => {
    await gotoAs(page, "librarian", "/reports");
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByText("Báo cáo")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Xuất CSV" })).toHaveCount(0);
  });
});
