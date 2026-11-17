import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoApp, loginAs, sidebar } from "./helpers";

// Dữ liệu mock (e2e/mock/data.mjs và e2e/mock/circulation.mjs). Hằng số đặt lại ở đây vì spec .ts không import .mjs.
const READER_VALID = { id: "a0000000-0000-4000-8000-000000000001", name: "Lê Văn Hùng" }; // 2 phiếu seed, 2 khoản phạt
const READER_BULK = { id: "a0000000-0000-4000-8000-000000000002", name: "Phạm Thị Hương" }; // 45 phiếu quá hạn seed
const BORROWING_OVERDUE_ID = "bd000000-0000-4000-8000-000000000001";
const MINE_ACTIVE_ID = "bd000000-0000-4000-8000-000000000011"; // phiếu của user `reader`
const MINE_RETURNED_ID = "bd000000-0000-4000-8000-000000000012";
const COPY_A = { id: "c9000000-0000-4000-8000-0000000000a1", barcode: "TV99000001" }; // chỉ spec này dùng
const COPY_B = { id: "c9000000-0000-4000-8000-0000000000a2", barcode: "TV99000002" };

const dataRows = (page: Page) => page.locator("table tbody tr[data-row-key]");
const segment = (page: Page, label: string) =>
  page.getByRole("radiogroup", { name: "Lọc theo trạng thái phiếu mượn" }).getByText(label, { exact: true });

async function createBorrowing(page: Page, token: { accessToken: string }, copyIds: string[]) {
  const res = await page.request.post("/api/borrowings", {
    headers: bearer(token),
    data: { userId: READER_VALID.id, bookCopyIds: copyIds },
  });
  expect(res.ok(), "lập phiếu qua API").toBeTruthy();
  return (await res.json()) as { id: string };
}

test.describe("circulation-2: bộ lọc danh sách phiếu mượn", () => {
  test("lọc theo độc giả: gọi search với readerId, hiện đếm, chip, rồi Xóa bộ lọc", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/borrowings");
    const box = page.locator('div[aria-label="Độc giả"]').getByRole("combobox");
    await box.fill("Hương");
    const req = page.waitForRequest((r) => r.url().includes("/api/borrowings/search") && r.url().includes(`readerId=${READER_BULK.id}`));
    await page.locator(".ant-select-item-option", { hasText: READER_BULK.name }).click();
    await req;
    await expect(page).toHaveURL(new RegExp(`readerId=${READER_BULK.id}`));
    await expect(page.getByText("45 phiếu", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Độc giả" })).toContainText(READER_BULK.name);
    await expect(dataRows(page)).toHaveCount(20);

    // Kết hợp với trạng thái rồi xóa tất cả bằng một nút
    await segment(page, "Đã trả hết").click();
    await expect(page).toHaveURL(/status=RETURNED/);
    await expect(page.getByText("Không có phiếu mượn nào khớp bộ lọc.")).toBeVisible();
    await page.getByRole("button", { name: "Xóa bộ lọc" }).first().click();
    await expect(page).not.toHaveURL(/readerId=|status=/);
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Độc giả" })).toHaveCount(0);
    await expect(dataRows(page).first()).toBeVisible();
  });

  test("độc giả trên URL được giữ khi tải lại; bỏ chip thì bỏ lọc", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, `/circulation/borrowings?readerId=${READER_VALID.id}`);
    await expect(page.getByText(/^\d+ phiếu$/)).toBeVisible(); // nhiều test khác cũng lập phiếu cho độc giả này
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Độc giả" })).toContainText(READER_VALID.name);
    await expect(page.locator(`tr[data-row-key="${BORROWING_OVERDUE_ID}"]`)).toBeVisible();
    await page.getByRole("button", { name: "Bỏ bộ lọc Độc giả" }).click();
    await expect(page).not.toHaveURL(/readerId=/);
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Độc giả" })).toHaveCount(0);
  });

  test("kích thước trang 10/20/50 gửi size lên BE và lên URL", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/borrowings?status=OVERDUE");
    await expect(dataRows(page)).toHaveCount(20);
    const req = page.waitForRequest((r) => r.url().includes("/api/borrowings/search") && r.url().includes("size=10"));
    await page.getByRole("combobox", { name: "Số dòng mỗi trang" }).click();
    await page.locator(".ant-select-item-option", { hasText: "10 / trang" }).click();
    await req;
    await expect(page).toHaveURL(/size=10/);
    await expect(dataRows(page)).toHaveCount(10);
    await gotoApp(page, "/circulation/borrowings?status=OVERDUE&size=50");
    await expect(dataRows(page)).toHaveCount(46);
  });

  test("ô tra mã phiếu nằm trong thanh lọc: sai dạng báo lỗi, đúng UUID mở trang chi tiết", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/borrowings");
    const input = page.getByLabel("Mã phiếu mượn (UUID)");
    await input.fill("abc");
    await expect(page.getByText("Mã phiếu phải có dạng UUID.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Xem phiếu" })).toBeDisabled();
    await input.fill(BORROWING_OVERDUE_ID);
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/circulation/borrowings/${BORROWING_OVERDUE_ID}$`));
  });
});

test.describe("circulation-2: phiếu của tôi", () => {
  test("độc giả thấy mục nav và hai phiếu của mình, lọc trạng thái trên URL", async ({ page }) => {
    await loginAs(page, "reader");
    await gotoApp(page, "/circulation/mine");
    await expect(sidebar(page).getByRole("link", { name: "Phiếu của tôi" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Phiếu của tôi", exact: true })).toBeVisible();
    await expect(page.locator(`tr[data-row-key="${MINE_ACTIVE_ID}"]`)).toBeVisible();
    await expect(page.locator(`tr[data-row-key="${MINE_RETURNED_ID}"]`)).toBeVisible();
    await expect(page.getByText("2 phiếu", { exact: true })).toBeVisible();

    await gotoApp(page, "/circulation/mine?status=RETURNED");
    await expect(page.locator(`tr[data-row-key="${MINE_RETURNED_ID}"]`)).toBeVisible();
    await expect(page.locator(`tr[data-row-key="${MINE_ACTIVE_ID}"]`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Trạng thái" })).toBeVisible();
    await page.getByRole("button", { name: "Xóa bộ lọc" }).first().click();
    await expect(page.locator(`tr[data-row-key="${MINE_ACTIVE_ID}"]`)).toBeVisible();
  });

  test("người không có khóa nghiệp vụ nào (member) vẫn vào được, chưa có phiếu thì hiện trạng thái rỗng", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/circulation/mine");
    await expect(sidebar(page).getByRole("link", { name: "Phiếu của tôi" })).toBeVisible();
    await expect(page.getByText("Bạn chưa có phiếu mượn nào.")).toBeVisible();
  });

  test("độc giả xem phiếu của mình bằng GET /{id}, thủ thư (khóa getAny) bằng /{id}/detail", async ({ page }) => {
    await loginAs(page, "reader");
    const own = page.waitForRequest((r) => r.url().includes(`/api/borrowings/${MINE_ACTIVE_ID}`));
    await gotoApp(page, `/circulation/borrowings/${MINE_ACTIVE_ID}`);
    expect(new URL((await own).url()).pathname).toBe(`/api/borrowings/${MINE_ACTIVE_ID}`);
    await expect(page.getByText("Thông tin phiếu")).toBeVisible();

    await loginAs(page, "clerk");
    const staff = page.waitForRequest((r) => r.url().includes(`/api/borrowings/${MINE_ACTIVE_ID}`));
    await gotoApp(page, `/circulation/borrowings/${MINE_ACTIVE_ID}`);
    expect(new URL((await staff).url()).pathname).toBe(`/api/borrowings/${MINE_ACTIVE_ID}/detail`);
    await expect(page.getByText("Thông tin phiếu")).toBeVisible();
  });
});

test.describe("circulation-2: phạt và đặt trước có bộ lọc", () => {
  test("phạt: lọc trạng thái, khoảng ngày, lý do và tổng theo bộ lọc", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, `/circulation/fines?readerId=${READER_VALID.id}`);
    await expect(dataRows(page)).toHaveCount(2);
    await expect(page.getByTestId("fine-filter-total")).toContainText("65.000");

    await gotoApp(page, `/circulation/fines?readerId=${READER_VALID.id}&fineStatus=PAID`);
    await expect(dataRows(page)).toHaveCount(1);
    await expect(page.getByTestId("fine-filter-total")).toContainText("50.000");
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Trạng thái" })).toBeVisible();

    // Khoảng ngày phát sinh: chỉ khoản 2020-03-12 nằm sau 2020-03-01
    await gotoApp(page, `/circulation/fines?readerId=${READER_VALID.id}&createdFrom=2020-03-01`);
    await expect(dataRows(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Ngày phát sinh" })).toBeVisible();

    await gotoApp(page, `/circulation/fines?readerId=${READER_VALID.id}&reason=LATE_RETURN`);
    await expect(dataRows(page)).toHaveCount(1);
    await expect(page.getByTestId("fine-filter-total")).toContainText("15.000");

    // Xóa bộ lọc giữ nguyên độc giả
    await page.getByRole("button", { name: "Xóa bộ lọc" }).first().click();
    await expect(dataRows(page)).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp(`readerId=${READER_VALID.id}`));
  });

  test("phạt: không khớp bộ lọc thì báo riêng, không nói 'không có khoản phạt nào'", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, `/circulation/fines?readerId=${READER_VALID.id}&createdFrom=2030-01-01`);
    await expect(page.getByText("Không có khoản phạt nào khớp bộ lọc.")).toBeVisible();
  });

  test("đặt trước: lọc trạng thái (chọn nhiều) và ô tìm tên sách", async ({ page }) => {
    await loginAs(page, "reader");
    await gotoApp(page, "/circulation/reservations?status=FULFILLED");
    await expect(page.getByRole("tab", { name: /Lịch sử \(1\)/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Đang hiệu lực \(0\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bỏ bộ lọc Trạng thái" })).toBeVisible();

    await gotoApp(page, "/circulation/reservations");
    const q = page.getByRole("searchbox", { name: "Tên sách" });
    await q.fill("zzz-khong-co");
    await expect(page).toHaveURL(/q=zzz-khong-co/);
    await expect(page.getByText("Không có đặt trước nào khớp bộ lọc.")).toBeVisible();
    await page.getByRole("button", { name: "Xóa bộ lọc" }).first().click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.getByText("Không có đặt trước nào khớp bộ lọc.")).toHaveCount(0);
  });
});

test.describe("circulation-2: trả hỏng và báo mất", () => {
  test("trả theo mã vạch chọn Hỏng: gửi barcode và condition=DAMAGED, hiện phạt kèm link sang màn Phạt", async ({ page }) => {
    const t = await loginAs(page, "clerk");
    await createBorrowing(page, t, [COPY_B.id]);
    await gotoApp(page, "/circulation/return");
    await page.getByText("Hỏng", { exact: true }).click();
    const post = page.waitForRequest((r) => r.url().endsWith("/api/borrowings/returns") && r.method() === "POST");
    const scan = page.getByLabel(/Mã vạch sách cần trả/);
    await scan.fill(COPY_B.barcode);
    await scan.press("Enter");
    expect((await post).postDataJSON()).toEqual({ barcode: COPY_B.barcode, condition: "DAMAGED" });
    const out = page.getByTestId("barcode-outcome");
    await expect(out.getByText(/Đã nhận trả sách/)).toBeVisible();
    await expect(out.getByText(/Phát sinh 1 khoản phạt/)).toBeVisible();
    await expect(out.getByRole("link", { name: "Xem phạt của độc giả" })).toHaveAttribute(
      "href",
      `/circulation/fines?readerId=${READER_VALID.id}`,
    );
  });

  test("báo mất từng dòng trên phiếu: có xác nhận, dòng thành Đã mất và hiện khoản phạt", async ({ page }) => {
    const t = await loginAs(page, "clerk");
    const b = await createBorrowing(page, t, [COPY_A.id]);
    await gotoApp(page, `/circulation/borrowings/${b.id}`);
    const lost = page.getByRole("button", { name: /^Báo mất/ });
    await lost.click();
    // Chưa xác nhận thì chưa gọi BE
    await expect(page.getByText("Đã mất", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Xác nhận báo mất" }).click();
    await expect(page.getByText("Đã mất", { exact: true }).first()).toBeVisible(); // bảng + thẻ mobile cùng nằm trong DOM
    await expect(page.getByText(/Phát sinh 1 khoản phạt/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Xem phạt của độc giả" })).toBeVisible();
    await expect(page.getByText("Phiếu đã trả hết.")).toBeVisible();
  });

  test("nhân viên không có khóa returnCopy/reportLost không thấy hai ô theo mã vạch", async ({ page }) => {
    await loginAs(page, "librarian");
    await gotoApp(page, "/circulation/return");
    await expect(page.getByLabel(/Mã vạch sách cần trả/)).toHaveCount(0);
    await expect(page.getByLabel("Mã vạch sách bị mất")).toHaveCount(0);
    await expect(page.getByLabel("Mã phiếu mượn (UUID, dán từ phiếu in)")).toBeVisible();
  });
});
