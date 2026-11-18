import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoApp, gotoAs, loginAs, sidebar } from "./helpers";
import { book, copyBarcode } from "./fake.mjs";

// Bám e2e/mock/catalog.mjs (dữ liệu riêng: "Hoàng Lê nhất thống chí" có đủ trạng thái bản sao, "Tuyển tập văn học Việt Nam, tập NN" để kiểm phân trang).
// Mock dùng chung cho 2 worker: mỗi test dùng bản sao/sách riêng, không giả định số lượng bản ghi.

const STATES_BOOK = "Hoàng Lê nhất thống chí";

async function openBook(page: Page, name: string) {
  await gotoApp(page, `/catalog?q=${encodeURIComponent(name)}`);
  await page.getByRole("table").getByRole("link", { name }).first().click();
  await expect(page).toHaveURL(/\/catalog\/books\/[^/]+$/);
  // Chi tiết nằm trong modal, danh sách vẫn ở nền.
  await expect(page.getByRole("dialog").getByRole("heading", { name })).toBeVisible();
}

/** Tạo sách mới qua BFF (đầu sách thật kèm lần tái bản riêng, chưa có bản sao). */
async function createBook(page: Page, t: { accessToken: string }) {
  const b = book();
  const res = await page.request.post("/api/books", {
    headers: bearer(t),
    data: { name: b.name, author: b.author, isbn: b.isbn, coverPrice: b.coverPrice },
  });
  expect(res.status()).toBe(201);
  return { ...((await res.json()) as { id: string }), name: b.name };
}

const copyRow = (page: Page, barcode: string) => page.getByRole("row").filter({ hasText: barcode });

test.describe("zone catalog: danh sách và tìm sách", () => {
  test("member không có quyền tra cứu thấy trang 403 tiếng Việt", async ({ page }) => {
    await gotoAs(page, "member", "/catalog");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(page.getByText("«Tra cứu sách»")).toBeVisible();
  });

  test("tìm theo từ khóa, không khớp thì có nút xóa bộ lọc, không còn trang chờ cũ", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog");
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
    await gotoAs(page, "librarian", "/catalog?q=" + encodeURIComponent("Cấu trúc dữ liệu"));
    await expect(page.getByRole("table").getByRole("link", { name: "Cấu trúc dữ liệu và giải thuật" })).toBeVisible();
    await page.getByRole("switch").click();
    await expect(page).toHaveURL(/available=true/);
    await expect(page.getByText("Không tìm thấy sách cho «Cấu trúc dữ liệu».")).toBeVisible();
  });

  test("phân trang client 20 dòng mỗi trang", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog?q=" + encodeURIComponent("Tuyển tập văn học Việt Nam"));
    const rows = page.getByRole("table").locator("tbody tr.ant-table-row");
    await expect(rows).toHaveCount(20);
    await page.locator(".ant-pagination-item-2").click();
    await expect(rows).toHaveCount(5);
  });

  test("Tra mã vạch ở sidebar và nút Thêm sách (mở hộp thoại) chỉ hiện khi có quyền; Thêm sách không còn là mục sidebar", async ({ page, browser }) => {
    await gotoAs(page, "librarian", "/catalog");
    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: "Thêm sách" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button", { name: "Thêm sách" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Tra mã vạch" })).toHaveAttribute("href", "/catalog/barcode");
    await expect(page.getByRole("main").getByRole("link", { name: "Tra theo mã vạch" })).toHaveCount(0);

    const ctx = await browser.newContext();
    const r = await ctx.newPage();
    await gotoAs(r, "reader", "/catalog");
    await expect(r.getByRole("table")).toBeVisible();
    await expect(sidebar(r).getByRole("link", { name: "Danh sách sách" })).toBeVisible();
    await expect(sidebar(r).getByRole("link", { name: "Thêm sách" })).toHaveCount(0);
    await expect(r.getByRole("main").getByRole("button", { name: "Thêm sách" })).toHaveCount(0);
    await expect(sidebar(r).getByRole("link", { name: "Tra mã vạch" })).toHaveCount(0);
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
    // Đã có chức năng sửa (BookEditButton): độc giả không có khóa TitleController/update nên không thấy nút Sửa
    await expect(page.getByRole("button", { name: /Sửa$/ })).toHaveCount(0);
  });

  test("độc giả: sách còn bản sẵn sàng thì không có nút Đặt trước", async ({ page }) => {
    await loginAs(page, "reader");
    await openBook(page, "Lập trình Java cơ bản");
    await expect(page.getByRole("button", { name: "Đặt trước" })).toHaveCount(0);
  });

  test("sách không tồn tại hiện 404 và nút về danh sách", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog/books/khong-ton-tai");
    const detail = page.getByRole("dialog");
    await expect(detail.getByText("Không tìm thấy sách")).toBeVisible();
    await detail.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test("mở sách từ danh sách: modal chi tiết, danh sách còn ở nền, đóng (X) về URL danh sách", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog?q=" + encodeURIComponent(STATES_BOOK));
    await page.getByRole("table").getByRole("link", { name: STATES_BOOK }).first().click();
    const detail = page.getByRole("dialog");
    await expect(detail.getByRole("heading", { name: STATES_BOOK })).toBeVisible();
    await expect(page.getByRole("table").getByRole("link", { name: STATES_BOOK }).first()).toBeVisible();
    await detail.locator(".ant-modal-close").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/catalog\?q=/);
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
    const tokens = await loginAs(page, "librarian");
    const { name } = await createBook(page, tokens);
    await openBook(page, name);
    await expect(page.getByText("Đầu sách này chưa có bản sao nào.")).toBeVisible();

    const barcode = copyBarcode();
    await page.getByRole("button", { name: /Thêm bản sao/ }).click();
    const dialog = page.getByRole("dialog", { name: /^Thêm bản sao/ });
    // FormModal gọi resetFields trong afterOpenChange (sau animation mở): đợi animation xong rồi mới gõ, nếu không ô bị xóa mất.
    await expect(page.locator(".ant-modal").last()).not.toHaveClass(/ant-zoom/);
    await dialog.getByLabel("Mã vạch").fill(barcode);
    await dialog.getByLabel("Mã vạch").press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(copyRow(page, barcode)).toContainText("Sẵn sàng");

    await page.getByRole("button", { name: /Thêm bản sao/ }).click();
    await expect(page.locator(".ant-modal").last()).not.toHaveClass(/ant-zoom/);
    await dialog.getByLabel("Mã vạch").fill(barcode);
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.getByText(`Mã vạch ${barcode} đã tồn tại`)).toBeVisible();
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

test.describe("zone catalog: thêm sách (hộp thoại)", () => {
  test("thiếu quyền BOOK_CREATE thì không có nút và link cũ /catalog/books/new không mở hộp thoại", async ({ page }) => {
    await gotoAs(page, "reader", "/catalog/books/new");
    await expect(page).toHaveURL(/\/catalog(\?|$)/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button", { name: "Thêm sách" })).toHaveCount(0);
  });

  test("link cũ /catalog/books/new chuyển về danh sách và mở sẵn hộp thoại", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog/books/new");
    await expect(page.getByRole("dialog", { name: "Thêm sách" })).toBeVisible();
  });

  test("kiểm tra bắt buộc rồi tạo sách và chuyển tới trang chi tiết", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog");
    await page.getByRole("main").getByRole("button", { name: "Thêm sách" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm sách" });
    await dlg.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dlg.getByText("Nhập tên sách")).toBeVisible();
    await expect(dlg.getByText("Nhập tác giả")).toBeVisible();
    await expect(dlg.getByText("Nhập giá bìa")).toBeVisible();

    const b = book();
    const name = b.name;
    await dlg.getByLabel("Tên sách").fill(name);
    await dlg.getByLabel("Tác giả").fill(b.author);
    await dlg.getByLabel("ISBN").fill(b.isbn);
    await dlg.getByLabel("Giá bìa").fill(String(b.coverPrice));
    await dlg.getByRole("button", { name: "Lưu", exact: true }).click();

    await expect(page).toHaveURL(/\/catalog\/books\/[^/]+$/);
    await expect(page.getByRole("dialog").getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(b.isbn)).toBeVisible();
  });

  test("Lưu và thêm bản sao mở sẵn hộp thoại thêm bản sao", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog");
    await page.getByRole("main").getByRole("button", { name: "Thêm sách" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm sách" });
    const b = book();
    await dlg.getByLabel("Tên sách").fill(b.name);
    await dlg.getByLabel("Tác giả").fill(b.author);
    await dlg.getByLabel("Giá bìa").fill(String(b.coverPrice));
    await dlg.getByRole("button", { name: "Lưu và thêm bản sao" }).click();
    await expect(page).toHaveURL(/addCopy=1/);
    await expect(page.getByRole("dialog", { name: /^Thêm bản sao/ }).getByLabel("Mã vạch")).toBeVisible();
  });
});

test.describe("zone catalog: tra theo mã vạch", () => {
  test("staff không có quyền thấy trang 403", async ({ page }) => {
    await gotoAs(page, "staff", "/catalog/barcode");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("quét mã hợp lệ rồi mã lạ; ô nhập được xóa và giữ focus", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog/barcode");
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

test.describe("zone catalog: thông tin xuất bản của đầu sách", () => {
  const COVER = "https://covers.example.test/bia.png";
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

  test("sách có đủ trường: trang chi tiết hiện nhãn tiếng Việt, bộ sách, thẻ và ảnh bìa", async ({ page }) => {
    await page.route(COVER, (r) => r.fulfill({ contentType: "image/png", body: PNG }));
    await gotoAs(page, "librarian", "/catalog");
    const t = await loginAs(page, "librarian");
    const b = book();
    const res = await page.request.post("/api/books", {
      headers: bearer(t),
      data: {
        name: b.name, author: b.author, isbn: b.isbn, coverPrice: b.coverPrice,
        subtitle: "Phiên bản minh họa", publicationYear: 2019, edition: "Tái bản lần 4", language: "fr", pageCount: 320,
        format: "HARDCOVER", translator: "Đỗ Thanh Hà", series: "Tủ sách vàng", seriesNumber: 7, coverImageUrl: COVER, tags: ["kinh điển", "thiếu nhi"],
      },
    });
    expect(res.status()).toBe(201);
    const { id } = (await res.json()) as { id: string };
    await gotoApp(page, `/catalog/books/${id}`);
    const main = page.getByRole("dialog").first();
    await expect(main.getByText("Phiên bản minh họa").first()).toBeVisible();
    await expect(main.getByText("Bìa cứng")).toBeVisible();
    await expect(main.getByText("Tiếng Pháp")).toBeVisible();
    await expect(main.getByText("2019")).toBeVisible();
    await expect(main.getByText("320")).toBeVisible();
    await expect(main.getByText("Tái bản lần 4")).toBeVisible();
    await expect(main.getByText("Đỗ Thanh Hà")).toBeVisible();
    await expect(main.getByText("Tủ sách vàng - Tập 7")).toBeVisible();
    await expect(main.getByText("kinh điển")).toBeVisible();
    await expect(main.getByText("thiếu nhi")).toBeVisible();
    await expect(main.getByRole("img", { name: `Bìa sách ${b.name}` })).toBeVisible();
  });

  test("sách không có trường xuất bản: không hiện nhãn trống; ảnh bìa lỗi tải thì có dự phòng", async ({ page }) => {
    await page.route(COVER, (r) => r.abort());
    await gotoAs(page, "librarian", "/catalog");
    const t = await loginAs(page, "librarian");
    const plain = book();
    const r1 = await page.request.post("/api/books", { headers: bearer(t), data: { name: plain.name, author: plain.author, coverPrice: plain.coverPrice } });
    const idPlain = ((await r1.json()) as { id: string }).id;
    await gotoApp(page, `/catalog/books/${idPlain}`);
    const main = page.getByRole("dialog").first();
    await expect(main.getByRole("heading", { name: plain.name })).toBeVisible();
    for (const label of ["Phụ đề", "Năm xuất bản", "Lần tái bản", "Ngôn ngữ", "Số trang", "Hình thức", "Dịch giả", "Bộ sách", "Thẻ"]) {
      await expect(main.getByText(label, { exact: true })).toHaveCount(0);
    }
    await expect(main.getByTestId("cover-fallback")).toBeVisible();

    const broken = book();
    const r2 = await page.request.post("/api/books", { headers: bearer(t), data: { name: broken.name, author: broken.author, coverPrice: broken.coverPrice, coverImageUrl: COVER } });
    const idBroken = ((await r2.json()) as { id: string }).id;
    await gotoApp(page, `/catalog/books/${idBroken}`);
    await expect(page.getByRole("dialog").first().getByTestId("cover-fallback")).toBeVisible();
  });

  test("form thêm sách: nhập khối Thông tin xuất bản, lưu rồi hiện ở chi tiết; sửa được và kiểm URL ảnh bìa", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog");
    await page.getByRole("main").getByRole("button", { name: "Thêm sách" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm sách" });
    const b = book();
    await dlg.getByLabel("Tên sách").fill(b.name);
    await dlg.getByLabel("Tác giả").fill(b.author);
    await dlg.getByLabel("Giá bìa").fill(String(b.coverPrice));
    await dlg.getByLabel("Phụ đề").fill("Bản đặc biệt");
    await dlg.getByLabel("Năm xuất bản").fill("2020");
    await dlg.getByLabel("Số trang").fill("256");
    await dlg.getByLabel("Hình thức").click();
    await page.getByTitle("Sách điện tử").click();
    await dlg.getByLabel("Bộ sách").fill("Bộ thử nghiệm");
    await dlg.getByLabel("Tập số").fill("3");
    await dlg.getByLabel("Thẻ").fill("văn học");
    await dlg.getByLabel("Thẻ").press("Enter");
    await dlg.getByLabel("Ảnh bìa (URL)").fill("ftp://x/y.png");
    await dlg.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dlg.getByText("Phải là địa chỉ http:// hoặc https://")).toBeVisible();
    await dlg.getByLabel("Ảnh bìa (URL)").fill("");
    await dlg.getByRole("button", { name: "Lưu", exact: true }).click();

    await expect(page).toHaveURL(/\/catalog\/books\/[^/]+$/);
    const main = page.getByRole("dialog").first();
    await expect(main.getByText("Bản đặc biệt").first()).toBeVisible();
    await expect(main.getByText("Sách điện tử")).toBeVisible();
    await expect(main.getByText("Bộ thử nghiệm - Tập 3")).toBeVisible();
    await expect(main.getByText("văn học")).toBeVisible();

    await main.getByRole("button", { name: "Sửa" }).first().click();
    const edit = page.getByRole("dialog", { name: "Sửa thông tin sách" });
    await expect(edit.getByLabel("Phụ đề")).toHaveValue("Bản đặc biệt");
    await edit.getByLabel("Phụ đề").fill("");
    await edit.getByLabel("Bộ sách").fill("");
    await edit.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(edit).toBeHidden();
    await expect(main.getByText("Bản đặc biệt")).toHaveCount(0);
    await expect(main.getByText("Bộ thử nghiệm")).toHaveCount(0);
  });
});
