import { expect, test, type Page } from "@playwright/test";
import { SHELL, loginAs } from "./helpers";
import { book, copyBarcode } from "./fake.mjs";

// Bám e2e/mock/catalog.mjs (dữ liệu riêng: "Hoàng Lê nhất thống chí" có đủ trạng thái bản sao, "Tuyển tập văn học Việt Nam, tập NN" để kiểm phân trang).
// Mock dùng chung cho 2 worker: mỗi test dùng bản sao/sách riêng, không giả định số lượng bản ghi.

const STATES_BOOK = "Hoàng Lê nhất thống chí";

async function openBook(page: Page, name: string) {
  await page.goto(`/catalog?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.waitForLoadState("networkidle"); // đợi hydrate: bấm nút Popconfirm khi chưa hydrate thì không mở được
}

/** Tạo sách mới qua BFF (đầu sách thật kèm lần tái bản riêng, chưa có bản sao). */
async function createBook(page: Page) {
  const b = book();
  const res = await page.request.post(`${SHELL}/api/bff/books`, {
    data: { name: b.name, author: b.author, isbn: b.isbn, coverPrice: b.coverPrice },
  });
  expect(res.status()).toBe(201);
  return { ...((await res.json()) as { id: string }), name: b.name };
}

const copyRow = (page: Page, barcode: string) => page.getByRole("row").filter({ hasText: barcode });

test.describe("zone catalog: danh sách và tìm sách", () => {
  test("member không có quyền tra cứu thấy trang 403 tiếng Việt", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/catalog");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(page.getByText("Tra cứu sách")).toBeVisible();
  });

  test("tìm theo từ khóa, không khớp thì có nút xóa bộ lọc, không còn trang chờ cũ", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog");
    await expect(page.getByText("catalog-service ở BE mới là khung")).toHaveCount(0);
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: "Cấu trúc dữ liệu và giải thuật" })).toBeVisible();

    await page.getByRole("searchbox").fill("Lập trình Java");
    await expect(page).toHaveURL(/q=/);
    await expect(table.getByRole("link", { name: "Lập trình Java cơ bản" })).toBeVisible();
    await expect(table.getByRole("link", { name: "Cấu trúc dữ liệu và giải thuật" })).toHaveCount(0);

    await page.getByRole("searchbox").fill("Giải tích hàm nâng cao");
    await expect(page.getByText("Không tìm thấy sách cho «Giải tích hàm nâng cao».")).toBeVisible();
    await page.getByRole("link", { name: "Xóa bộ lọc" }).or(page.getByRole("button", { name: "Xóa bộ lọc" })).click();
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test("lọc chỉ sách còn bản sẵn sàng", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog?q=" + encodeURIComponent("Cấu trúc dữ liệu"));
    await expect(page.getByRole("table").getByRole("link", { name: "Cấu trúc dữ liệu và giải thuật" })).toBeVisible();
    await page.getByRole("switch").click();
    await expect(page).toHaveURL(/available=true/);
    await expect(page.getByText("Không tìm thấy sách cho «Cấu trúc dữ liệu».")).toBeVisible();
  });

  test("phân trang client 20 dòng mỗi trang", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog?q=" + encodeURIComponent("Tuyển tập văn học Việt Nam"));
    const rows = page.getByRole("table").locator("tbody tr.ant-table-row");
    await expect(rows).toHaveCount(20);
    await page.locator(".ant-pagination-item-2").click();
    await expect(rows).toHaveCount(5);
  });

  test("mục Thêm sách và Tra mã vạch ở sidebar chỉ hiện khi có quyền; đầu danh sách không còn nút điều hướng", async ({ page, browser }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Thêm sách" })).toHaveAttribute("href", "/catalog/books/new");
    await expect(nav.getByRole("link", { name: "Tra mã vạch" })).toHaveAttribute("href", "/catalog/barcode");
    await expect(page.getByRole("main").getByRole("link", { name: "Tra theo mã vạch" })).toHaveCount(0);

    const ctx = await browser.newContext();
    const r = await ctx.newPage();
    await loginAs(r, "reader");
    await r.goto("/catalog");
    await expect(r.getByRole("table")).toBeVisible();
    await expect(r.getByRole("navigation").getByRole("link", { name: "Danh sách sách" })).toBeVisible();
    await expect(r.getByRole("navigation").getByRole("link", { name: "Thêm sách" })).toHaveCount(0);
    await expect(r.getByRole("navigation").getByRole("link", { name: "Tra mã vạch" })).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("zone catalog: chi tiết sách và bản sao", () => {
  test("độc giả: có Đặt trước khi hết bản, không thấy danh sách bản sao và nút thêm", async ({ page }) => {
    await loginAs(page, "reader");
    await openBook(page, "Cấu trúc dữ liệu và giải thuật");
    await expect(page.getByRole("button", { name: "Đặt trước" })).toBeVisible();
    await expect(page.getByText("Bạn không có quyền xem danh sách bản sao.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm bản sao/ })).toHaveCount(0);
    await expect(page.getByText("Chức năng sửa thông tin sách chưa có")).toBeVisible();
  });

  test("độc giả: sách còn bản sẵn sàng thì không có nút Đặt trước", async ({ page }) => {
    await loginAs(page, "reader");
    await openBook(page, "Lập trình Java cơ bản");
    await expect(page.getByRole("button", { name: "Đặt trước" })).toHaveCount(0);
  });

  test("sách không tồn tại hiện 404 và nút về danh sách", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog/books/khong-ton-tai");
    await expect(page.getByText("Không tìm thấy sách")).toBeVisible();
    await expect(page.getByRole("link", { name: "Về danh sách" })).toBeVisible();
  });

  test("thủ thư thấy bản sao, lọc theo trạng thái", async ({ page }) => {
    await loginAs(page, "librarian");
    await openBook(page, STATES_BOOK);
    await expect(copyRow(page, "TV00031031")).toContainText("Sẵn sàng");
    await expect(copyRow(page, "TV00031041")).toContainText("Đã mất");
    await page.getByText(/^Đã mất \(/).click();
    await expect(copyRow(page, "TV00031041")).toBeVisible();
    await expect(copyRow(page, "TV00031031")).toHaveCount(0);
  });

  test("thêm bản sao: thành công, trùng mã vạch báo lỗi trong hộp thoại", async ({ page }) => {
    await loginAs(page, "librarian");
    const { name } = await createBook(page);
    await openBook(page, name);
    await expect(page.getByText("Đầu sách này chưa có bản sao nào.")).toBeVisible();

    const barcode = copyBarcode();
    await page.getByRole("button", { name: /Thêm bản sao/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mã vạch").fill(barcode);
    await dialog.getByLabel("Mã vạch").press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(copyRow(page, barcode)).toContainText("Sẵn sàng");

    await page.getByRole("button", { name: /Thêm bản sao/ }).click();
    await page.getByRole("dialog").getByLabel("Mã vạch").fill(barcode);
    await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByRole("dialog").getByText(`Mã vạch ${barcode} đã tồn tại`)).toBeVisible();
  });

  test("đổi trạng thái: báo hư hỏng, báo mất, sửa xong, nhả giữ chỗ", async ({ page }) => {
    await loginAs(page, "librarian");
    await openBook(page, STATES_BOOK);

    const confirm = async (barcode: string, action: string) => {
      await copyRow(page, barcode).getByRole("button", { name: action }).click();
      await page.locator(".ant-popover").getByRole("button", { name: action }).click();
    };

    await confirm("TV00031001", "Báo hư hỏng");
    await expect(copyRow(page, "TV00031001")).toContainText("Hư hỏng");

    await copyRow(page, "TV00031002").getByRole("button", { name: "Báo mất" }).click();
    await expect(page.locator(".ant-popover").getByText("Việc đổi trạng thái ở đây không tính tiền phạt.")).toBeVisible();
    await page.locator(".ant-popover").getByRole("button", { name: "Báo mất" }).click();
    await expect(copyRow(page, "TV00031002")).toContainText("Đã mất");

    await confirm("TV00031011", "Đã sửa xong, cho mượn lại");
    await expect(copyRow(page, "TV00031011")).toContainText("Sẵn sàng");

    await confirm("TV00031021", "Nhả giữ chỗ");
    await expect(copyRow(page, "TV00031021")).toContainText("Sẵn sàng");
  });
});

test.describe("zone catalog: thêm sách", () => {
  test("thiếu quyền BOOK_CREATE thì thấy trang 403", async ({ page }) => {
    await loginAs(page, "reader");
    await page.goto("/catalog/books/new");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("kiểm tra bắt buộc rồi tạo sách và chuyển tới trang chi tiết", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog/books/new");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByText("Nhập tên sách")).toBeVisible();
    await expect(page.getByText("Nhập tác giả")).toBeVisible();
    await expect(page.getByText("Nhập giá bìa")).toBeVisible();

    const b = book();
    const name = b.name;
    await page.getByLabel("Tên sách").fill(name);
    await page.getByLabel("Tác giả").fill(b.author);
    await page.getByLabel("ISBN").fill(b.isbn);
    await page.getByLabel("Giá bìa").fill(String(b.coverPrice));
    await page.getByRole("button", { name: "Lưu", exact: true }).click();

    await expect(page).toHaveURL(/\/catalog\/books\/[^/]+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(b.isbn)).toBeVisible();
  });

  test("Lưu và thêm bản sao mở sẵn hộp thoại thêm bản sao", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog/books/new");
    await page.waitForLoadState("networkidle");
    const b = book();
    await page.getByLabel("Tên sách").fill(b.name);
    await page.getByLabel("Tác giả").fill(b.author);
    await page.getByLabel("Giá bìa").fill(String(b.coverPrice));
    await page.getByRole("button", { name: "Lưu và thêm bản sao" }).click();
    await expect(page).toHaveURL(/addCopy=1/);
    await expect(page.getByRole("dialog").getByLabel("Mã vạch")).toBeVisible();
  });
});

test.describe("zone catalog: tra theo mã vạch", () => {
  test("staff không có quyền thấy trang 403", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/catalog/barcode");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("quét mã hợp lệ rồi mã lạ; ô nhập được xóa và giữ focus", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/catalog/barcode");
    await page.waitForLoadState("networkidle");
    const input = page.getByLabel("Quét hoặc nhập mã vạch");

    await input.fill("TV00031031");
    await input.press("Enter");
    await expect(page.getByText(STATES_BOOK).first()).toBeVisible();
    await expect(page.getByText("Sẵn sàng").first()).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();

    await input.fill("TV99999998");
    await input.press("Enter");
    await expect(page.getByText("Không tìm thấy bản sao có mã vạch «TV99999998».")).toBeVisible();
    await expect(input).toBeFocused();
  });
});
