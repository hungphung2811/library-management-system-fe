import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoApp, gotoAs, loginAs } from "./helpers";
import { book, copyBarcode } from "./fake.mjs";

// Bám e2e/mock/catalog.mjs (sách "Sách có thông tin nhập kho", bản sao ACQ0000000n) và e2e/mock/catalog-reference.mjs.
// Mock dùng chung cho 2 worker: mỗi test dùng bản sao/tên riêng.

const ACQ_BOOK = "Sách có thông tin nhập kho";
const copyRow = (page: Page, barcode: string) => page.getByRole("row").filter({ hasText: barcode });
const uniq = () => String(Date.now() % 1_000_000) + String(Math.floor(Math.random() * 100));

async function openBook(page: Page, name: string) {
  await gotoApp(page, `/catalog?q=${encodeURIComponent(name)}`);
  await page.getByRole("table").getByRole("link", { name }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name })).toBeVisible();
}
/** FormModal đặt lại form khi mở và sau animation: đợi animation xong rồi mới nhập. */
const settle = (page: Page) => expect(page.locator(".ant-modal").last()).not.toHaveClass(/ant-zoom/);
const pickOption = (page: Page, title: string) => page.locator(`.ant-select-item-option[title="${title}"]`).click();

test.describe("bản sao: thông tin nhập kho", () => {
  test("hiện ngày nhập, nguồn, giá mua, tình trạng, ghi chú, ngày kiểm kê", async ({ page }) => {
    await loginAs(page, "librarian");
    await openBook(page, ACQ_BOOK);
    const row = copyRow(page, "ACQ00000001");
    await expect(row).toContainText("15/03/2024");
    await expect(row).toContainText("Mua");
    await expect(row).toContainText("85.000");
    await expect(row).toContainText("Tốt");
    await expect(row).toContainText("Gáy hơi cong");
    await expect(row).toContainText("01/06/2025");
    // Bản sao chưa nhập gì hiện dấu gạch ngang, không vỡ.
    await expect(copyRow(page, "ACQ00000004")).toContainText("Tặng");
    await expect(copyRow(page, "ACQ00000004")).toContainText("Cũ nát");
  });

  test("không có khóa updateAcquisition thì ẩn nút Thông tin nhập kho", async ({ page }) => {
    await loginAs(page, "copyviewer");
    await openBook(page, ACQ_BOOK);
    await expect(copyRow(page, "ACQ00000001")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thông tin nhập kho/ })).toHaveCount(0);
  });

  test("sửa nguồn nhập sang Tặng: gửi đủ 6 field, giá mua bị xóa", async ({ page }) => {
    await loginAs(page, "librarian");
    await openBook(page, ACQ_BOOK);
    await copyRow(page, "ACQ00000002").getByRole("button", { name: "Thông tin nhập kho của ACQ00000002" }).click();
    const dialog = page.getByRole("dialog", { name: /Thông tin nhập kho/ });
    await settle(page);
    // Form nạp sẵn giá trị hiện có.
    await expect(dialog.getByLabel("Ngày nhập")).toHaveValue("15/03/2024");
    await expect(dialog.getByLabel("Giá mua (₫)")).toHaveValue("85.000");
    await dialog.getByLabel("Nguồn nhập").click();
    await pickOption(page, "Tặng");
    await expect(dialog.getByLabel("Giá mua (₫)")).toBeDisabled();
    const put = page.waitForRequest((r) => r.method() === "PUT" && /\/acquisition$/.test(r.url()));
    await dialog.getByRole("button", { name: "Lưu" }).click();
    const body = (await put).postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["acquiredDate", "acquisitionSource", "conditionGrade", "conditionNote", "lastInventoryDate", "purchasePrice"]);
    expect(body).toMatchObject({ acquisitionSource: "DONATION", purchasePrice: null, acquiredDate: "2024-03-15", conditionNote: "Gáy hơi cong" });
    await expect(dialog).toHaveCount(0);
    await expect(copyRow(page, "ACQ00000002")).toContainText("Tặng");
    await expect(copyRow(page, "ACQ00000002")).not.toContainText("85.000");
  });

  test("kiểm kê trước ngày nhập bị chặn ngay trong form", async ({ page }) => {
    await loginAs(page, "librarian");
    await openBook(page, ACQ_BOOK);
    await copyRow(page, "ACQ00000001").getByRole("button", { name: "Thông tin nhập kho của ACQ00000001" }).click();
    const dialog = page.getByRole("dialog", { name: /Thông tin nhập kho/ });
    await settle(page);
    await dialog.getByLabel("Ngày kiểm kê gần nhất").fill("01/01/2020");
    await dialog.getByLabel("Ngày kiểm kê gần nhất").press("Enter");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog.getByText("Ngày kiểm kê không được trước ngày nhập")).toBeVisible();
  });

  test("PUT /acquisition thay toàn bộ: body rỗng xóa hết; giá mua khi nguồn khác Mua là 422", async ({ page }) => {
    const t = await loginAs(page, "librarian");
    const list = await page.request.get("/api/books?keyword=" + encodeURIComponent(ACQ_BOOK), { headers: bearer(t) });
    const titleId = ((await list.json()) as { id: string; name: string }[]).find((b) => b.name === ACQ_BOOK)!.id;
    const copies = (await (await page.request.get(`/api/book-copies?titleId=${titleId}`, { headers: bearer(t) })).json()) as { id: string; barcode: string }[];
    const id = copies.find((c) => c.barcode === "ACQ00000003")!.id;

    const bad = await page.request.put(`/api/book-copies/${id}/acquisition`, { headers: bearer(t), data: { acquisitionSource: "DONATION", purchasePrice: 1000 } });
    expect(bad.status()).toBe(422);
    expect((await bad.json()).code).toBe("INVALID_COPY");

    const ok = await page.request.put(`/api/book-copies/${id}/acquisition`, { headers: bearer(t), data: {} });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ acquiredDate: null, acquisitionSource: null, purchasePrice: null, conditionGrade: null, conditionNote: null, lastInventoryDate: null });
  });

  test("thêm bản sao kèm thông tin nhập kho", async ({ page }) => {
    const tokens = await loginAs(page, "librarian");
    const b = book();
    const res = await page.request.post("/api/books", { headers: bearer(tokens), data: { name: b.name, author: b.author, isbn: b.isbn, coverPrice: b.coverPrice } });
    expect(res.status()).toBe(201);
    await openBook(page, b.name);

    const barcode = copyBarcode();
    await page.getByRole("button", { name: /Thêm bản sao/ }).click();
    const dialog = page.getByRole("dialog", { name: /^Thêm bản sao/ });
    await settle(page);
    await dialog.getByLabel("Mã vạch").fill(barcode);
    await dialog.getByLabel("Ngày nhập").fill("10/02/2025");
    await dialog.getByLabel("Ngày nhập").press("Enter");
    await dialog.getByLabel("Nguồn nhập").click();
    await pickOption(page, "Mua");
    await dialog.getByLabel("Giá mua (₫)").fill("120000");
    await dialog.getByLabel("Tình trạng", { exact: true }).click();
    await pickOption(page, "Mới");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(dialog).toHaveCount(0);
    const row = copyRow(page, barcode);
    await expect(row).toContainText("10/02/2025");
    await expect(row).toContainText("120.000");
    await expect(row).toContainText("Mới");
  });
});

test.describe("danh mục tham chiếu: field bổ sung", () => {
  test("tác giả: hiện năm sinh - mất, quốc tịch, website, ảnh fallback chữ cái", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    const row = page.getByRole("row").filter({ hasText: "Nguyễn Du" });
    await expect(row).toContainText("1765 - 1820");
    await expect(row).toContainText("Việt Nam");
    await expect(row.getByRole("link", { name: /example\.org/ })).toHaveAttribute("href", "https://example.org/nguyen-du");
    await expect(row.locator(".ant-avatar")).toContainText("N");
  });

  test("tác giả: năm mất nhỏ hơn năm sinh và URL sai bị chặn, nhập đúng thì lưu", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/authors");
    await page.getByRole("button", { name: /Thêm tác giả/ }).click();
    const dialog = page.getByRole("dialog", { name: /Thêm tác giả/ });
    await settle(page);
    const name = `Tác giả thử ${uniq()}`;
    await dialog.getByLabel("Tên tác giả").fill(name);
    await dialog.getByLabel("Năm sinh").fill("1900");
    await dialog.getByLabel("Năm mất").fill("1890");
    await dialog.getByLabel("Website").fill("ftp://sai");
    await dialog.getByRole("button", { name: "Tạo" }).click();
    await expect(dialog.getByText("Năm mất không được nhỏ hơn năm sinh")).toBeVisible();
    await expect(dialog.getByText("Phải là địa chỉ http:// hoặc https://")).toBeVisible();

    await dialog.getByLabel("Năm mất").fill("1980");
    await dialog.getByLabel("Website").fill("https://tacgia.example.com");
    await dialog.getByRole("button", { name: "Tạo" }).click();
    await expect(dialog).toHaveCount(0);
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("1900 - 1980");
  });

  test("nhà xuất bản: hiện quốc gia, năm thành lập, website, địa chỉ", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/publishers");
    const row = page.getByRole("row").filter({ hasText: "Nhà xuất bản Kim Đồng" });
    await expect(row).toContainText("1957");
    await expect(row).toContainText("55 Quang Trung");
    await expect(row.getByRole("link", { name: /nxbkimdong/ })).toBeVisible();
  });

  test("nhà xuất bản: năm thành lập trước 1400 bị chặn", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/publishers");
    await page.getByRole("button", { name: /Thêm nhà xuất bản/ }).click();
    const dialog = page.getByRole("dialog", { name: /Thêm nhà xuất bản/ });
    await settle(page);
    await dialog.getByLabel("Tên nhà xuất bản").fill(`NXB thử ${uniq()}`);
    await dialog.getByLabel("Quốc gia").fill("Việt Nam");
    // InputNumber có min=1400 nên tự kẹp giá trị khi rời ô: kiểm tra giới hạn qua thuộc tính.
    await expect(dialog.getByLabel("Năm thành lập")).toHaveAttribute("aria-valuemin", "1400");
  });

  test("vị trí kệ: hiện tầng, khu vực, sức chứa và lưu được ô mới", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog/shelf-locations");
    const row = page.getByRole("row").filter({ hasText: "A1-01" });
    await expect(row).toContainText("Tầng 1");
    await expect(row).toContainText("Khu Văn học");
    await expect(row).toContainText("50");

    await page.getByRole("button", { name: /Thêm vị trí kệ/ }).click();
    const dialog = page.getByRole("dialog", { name: /Thêm vị trí kệ/ });
    await settle(page);
    const code = `K${uniq()}`;
    await dialog.getByLabel("Mã vị trí kệ").fill(code);
    await dialog.getByLabel("Tầng").fill("Tầng 2");
    await dialog.getByLabel("Khu vực").fill("Khu Thiếu nhi");
    await dialog.getByLabel("Sức chứa (số bản sao)").fill("40");
    await dialog.getByRole("button", { name: "Tạo" }).click();
    await expect(dialog).toHaveCount(0);
    const created = page.getByRole("row").filter({ hasText: code });
    await expect(created).toContainText("Tầng 2");
    await expect(created).toContainText("Khu Thiếu nhi");
    await expect(created).toContainText("40");
  });
});
