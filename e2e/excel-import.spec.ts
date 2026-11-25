import { expect, test, type Page } from "@playwright/test";
import { gotoAs } from "./helpers";

// Nhập Excel hàng loạt (ADR-0024): tải mẫu, tải lên, xem trước từng dòng, xác nhận, tiến độ/kết quả, file mật khẩu tạm (users).
// Mock: e2e/mock/imports.mjs. Hành vi điều khiển bằng TÊN TỆP (chi-hop-le, sai-mau, qua-lon, rong, gioi-han, gian-doan).
// Tệp .xlsx ở đây chỉ là byte giả (mock không đọc nội dung, chỉ lấy tên tệp).

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const xlsx = (name: string, size = 64) => ({ name, mimeType: XLSX_MIME, buffer: Buffer.alloc(size, 1) });
const dialog = (page: Page) => page.getByRole("dialog");
const pick = (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) =>
  dialog(page).getByTestId("excel-import-file").setInputFiles(file);

test.describe("nhập Excel: người dùng (kèm file mật khẩu tạm)", () => {
  test("tải mẫu, xem trước dòng lỗi/trùng, xác nhận, tải mật khẩu tạm một lần rồi báo đã hết", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    const d = dialog(page);
    await expect(d.getByText("Nhập người dùng từ Excel")).toBeVisible();

    const tpl = page.waitForEvent("download");
    await d.getByRole("button", { name: "Tải file mẫu (.xlsx)" }).click();
    expect((await tpl).suggestedFilename()).toBe("mau-users.xlsx");

    await pick(page, xlsx("nguoi-dung.xlsx"));
    const totals = d.getByTestId("excel-import-totals");
    await expect(totals).toContainText("Hợp lệ");
    await expect(totals.locator(".ant-statistic").nth(0)).toContainText("3");
    await expect(totals.locator(".ant-statistic").nth(1)).toContainText("1");
    await expect(totals.locator(".ant-statistic").nth(2)).toContainText("1");
    // Dòng lỗi hiện thông điệp theo cột; dòng trùng được nói rõ là bỏ qua.
    await expect(d.getByRole("row").filter({ hasText: "Tên đăng nhập là bắt buộc" })).toBeVisible();
    await expect(d.getByText("1 dòng trùng với dữ liệu đã có sẽ bị bỏ qua", { exact: false })).toBeVisible();

    // Lọc theo trạng thái dòng (phân trang/lọc phía server).
    await d.getByText("Lỗi (1)").click();
    await expect(d.getByRole("row").filter({ hasText: "Tên đăng nhập là bắt buộc" })).toBeVisible();
    await expect(d.getByRole("row").filter({ hasText: "Đã có trong hệ thống" })).toHaveCount(0);
    await d.getByText("Tất cả", { exact: true }).click();

    const err = page.waitForEvent("download");
    await d.getByRole("button", { name: "Tải file lỗi" }).click();
    expect((await err).suggestedFilename()).toBe("loi-users.xlsx");

    await d.getByRole("button", { name: "Xác nhận nhập 3 dòng" }).click();
    await expect(d.getByTestId("excel-import-progress")).toBeVisible();
    await expect(d.getByText("Đã nhập xong: tạo 3 người dùng.")).toBeVisible({ timeout: 15_000 });
    await expect(d.getByTestId("excel-import-result")).toContainText("Bỏ qua (trùng)");
    await expect(d.getByTestId("excel-import-credentials")).toContainText("chỉ tải được MỘT lần");

    // Đóng khi chưa tải mật khẩu tạm: có cảnh báo, chọn quay lại thì hộp thoại còn nguyên.
    await d.locator(".ant-modal-footer").getByRole("button", { name: "Đóng" }).click();
    const warn = page.getByRole("dialog", { name: "Chưa tải file mật khẩu tạm" });
    await expect(warn).toBeVisible();
    await warn.getByRole("button", { name: "Quay lại tải file" }).click();
    await expect(warn).toBeHidden();
    await expect(d.getByTestId("excel-import-credentials")).toBeVisible();

    const cred = page.waitForEvent("download");
    await d.getByRole("button", { name: "Tải file mật khẩu tạm" }).click();
    expect((await cred).suggestedFilename()).toBe("mat-khau-tam-users.xlsx");
    await expect(d.getByTestId("excel-import-credentials")).toContainText("Đã tải file mật khẩu tạm");

    // Lần hai: BE trả 410 IMPORT_CREDENTIALS_GONE, UI báo đã hết.
    await d.getByRole("button", { name: /Tải lại/ }).click();
    await expect(d.getByTestId("excel-import-credentials")).toContainText("đã được tải hoặc đã hết hạn");
    await expect(d.getByRole("button", { name: /Tải lại/ })).toHaveCount(0);

    // Đã tải: đóng không còn cảnh báo.
    await d.locator(".ant-modal-footer").getByRole("button", { name: "Đóng" }).click();
    await expect(d).toBeHidden();
  });

  test("nút CSV cũ đã bị thay: không còn 'Nhập từ CSV'", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await expect(page.getByRole("button", { name: "Nhập Excel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nhập từ CSV" })).toHaveCount(0);
  });
});

test.describe("nhập Excel: danh mục tham chiếu (tác giả)", () => {
  test("tải lên, xem trước, tải file lỗi, tải lên lại, xác nhận và thấy kết quả", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    const d = dialog(page);
    await expect(d.getByText("Nhập tác giả từ Excel")).toBeVisible();

    await pick(page, xlsx("tac-gia.xlsx"));
    await expect(d.getByRole("row").filter({ hasText: "Tên tác giả là bắt buộc" })).toBeVisible();
    await expect(d.getByRole("button", { name: "Tải file lỗi" })).toBeVisible();

    await d.getByRole("button", { name: "Tải lên lại" }).click();
    await pick(page, xlsx("tac-gia-chi-hop-le.xlsx"));
    await expect(d.getByRole("button", { name: "Xác nhận nhập 2 dòng" })).toBeVisible();
    await expect(d.getByRole("button", { name: "Tải file lỗi" })).toHaveCount(0);
    await d.getByRole("button", { name: "Xác nhận nhập 2 dòng" }).click();
    await expect(d.getByText("Đã nhập xong: tạo 2 tác giả.")).toBeVisible({ timeout: 15_000 });
    // Không có file mật khẩu tạm ở loại không phải users.
    await expect(d.getByTestId("excel-import-credentials")).toHaveCount(0);
    await d.locator(".ant-modal-footer").getByRole("button", { name: "Đóng" }).click();
    await expect(d).toBeHidden();
  });

  test("đóng trước khi xác nhận thì hủy phiên (DELETE)", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    await pick(page, xlsx("huy-phien.xlsx"));
    await expect(dialog(page).getByTestId("excel-import-totals")).toBeVisible();
    const del = page.waitForRequest((r) => r.method() === "DELETE" && /\/api\/catalog\/imports\/authors\/[0-9a-f-]{36}$/.test(r.url()));
    await dialog(page).getByRole("button", { name: "Hủy" }).click();
    await del;
    await expect(dialog(page)).toBeHidden();
  });

  test("ghi bị gián đoạn thì bấm Tiếp tục nhập để hoàn tất", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    const d = dialog(page);
    await pick(page, xlsx("gian-doan.xlsx"));
    await d.getByRole("button", { name: /Xác nhận nhập/ }).click();
    await expect(d.getByText("Việc ghi dữ liệu bị gián đoạn.")).toBeVisible({ timeout: 15_000 });
    await d.getByRole("button", { name: "Tiếp tục nhập" }).click();
    await expect(d.getByText(/Đã nhập xong: tạo \d+ tác giả\./)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("nhập Excel: bán hàng và đầu sách", () => {
  test("mặt hàng (tồn kho): nhập xong và hiện kết quả", async ({ page }) => {
    await gotoAs(page, "salesadmin", "/sales/stock");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    const d = dialog(page);
    await expect(d.getByText("Nhập mặt hàng và tồn đầu kỳ từ Excel")).toBeVisible();
    await pick(page, xlsx("mat-hang.xlsx"));
    await expect(d.getByRole("row").filter({ hasText: "ISBN đầu sách là bắt buộc" })).toBeVisible();
    await d.getByRole("button", { name: "Xác nhận nhập 3 dòng" }).click();
    await expect(d.getByText("Đã nhập xong: tạo 3 mặt hàng.")).toBeVisible({ timeout: 15_000 });
  });

  test("nhà cung cấp có nút Nhập Excel", async ({ page }) => {
    await gotoAs(page, "salesadmin", "/sales/suppliers");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    await expect(dialog(page).getByText("Nhập nhà cung cấp từ Excel")).toBeVisible();
  });

  test("đầu sách: hai sheet DauSach/BanSao thành hai tab, lọc theo sheet", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    const d = dialog(page);
    await pick(page, xlsx("dau-sach.xlsx"));
    await expect(d.getByRole("tab", { name: /Đầu sách/ })).toBeVisible();
    await d.getByRole("tab", { name: /Bản sao/ }).click();
    await expect(d.getByRole("columnheader", { name: "Mã vạch *" })).toBeVisible();
    await d.getByRole("tab", { name: /Đầu sách/ }).click();
    await expect(d.getByRole("columnheader", { name: "Tên sách *" })).toBeVisible();
  });
});

test.describe("nhập Excel: lỗi tệp và phân quyền", () => {
  test("tệp sai đuôi bị chặn phía client, không gọi BE", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/imports/")) posted = true;
    });
    await pick(page, { name: "du-lieu.csv", mimeType: "text/csv", buffer: Buffer.from("name\nA\n") });
    await expect(dialog(page).getByRole("alert")).toContainText("Chỉ nhận tệp Excel .xlsx");
    expect(posted).toBe(false);
  });

  test("tệp quá 5 MB bị chặn phía client", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    await pick(page, xlsx("lon.xlsx", 5 * 1024 * 1024 + 1));
    await expect(dialog(page).getByRole("alert")).toContainText("vượt quá 5 MB");
  });

  test("BE trả 422 IMPORT_TEMPLATE_MISMATCH thì liệt kê cột thiếu", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    await pick(page, xlsx("sai-mau.xlsx"));
    const alert = dialog(page).getByRole("alert");
    await expect(alert).toContainText("không đúng mẫu");
    await expect(alert).toContainText("Thiếu cột bắt buộc: Tên tác giả");
  });

  test("413 và đủ 3 phiên được báo bằng tiếng Việt", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: "Nhập Excel" }).click();
    await pick(page, xlsx("qua-lon-server.xlsx"));
    await expect(dialog(page).getByRole("alert")).toContainText("vượt quá 5 MB");
    await pick(page, xlsx("gioi-han.xlsx"));
    await expect(dialog(page).getByRole("alert")).toContainText("tối đa 3 phiên");
  });

  test("nút Nhập Excel ẩn khi thiếu khóa nhập, hiện khi có đủ khóa (không phải admin)", async ({ page }) => {
    await gotoAs(page, "impnone", "/catalog/authors");
    await expect(page.getByRole("heading", { name: "Tác giả" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Nhập Excel" })).toHaveCount(0);

    await gotoAs(page, "impyes", "/catalog/authors");
    await expect(page.getByRole("button", { name: "Nhập Excel" })).toBeVisible();
  });
});
