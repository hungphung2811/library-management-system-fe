import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoApp, gotoAs, loginAs, markSpa, readSpa, sidebar } from "./helpers";

// Dữ liệu mock (e2e/mock/data.mjs và e2e/mock/circulation.mjs). Hằng số đặt lại ở đây vì spec .ts không import .mjs.
const READER_VALID = { id: "a0000000-0000-4000-8000-000000000001", name: "Lê Văn Hùng" };
const FINE_READER = READER_VALID; // độc giả có khoản phạt seed (mock gắn phạt vào DIRECTORY[0])
const READER_EXPIRED_CARD = { name: "Phạm Thị Hương" };
const FINE_USER_ID = "f1000000-0000-4000-8000-0000000000f1";
const FINE_COLLECT_READER_ID = "f2000000-0000-4000-8000-0000000000f2"; // chỉ test thu phạt được sửa
const COPY_JAVA_1 = { id: "c0000000-0000-4000-8000-000000000001", barcode: "TV00010001" };
const COPY_JAVA_2 = { id: "c0000000-0000-4000-8000-000000000002", barcode: "TV00010002" };
const COPY_OWN = { id: "c9000000-0000-4000-8000-0000000000b1", barcode: "TV99000011" }; // chỉ test trả theo mã vạch dùng
const BORROWING_OVERDUE_ID = "bd000000-0000-4000-8000-000000000001";
const BORROWING_RETURNED_ID = "bd000000-0000-4000-8000-000000000002";
const TITLE_DSA = { id: "b0000000-0000-4000-8000-000000000002", name: "Cấu trúc dữ liệu và giải thuật" };
const OVERDUE_TOTAL = 46; // 1 phiếu seed + 45 phiếu quá hạn seed thêm (BULK_OVERDUE), 20 phiếu mỗi trang

/** Lập phiếu bằng API để test không phụ thuộc test khác; trả về phiếu có id riêng. */
async function createBorrowing(page: Page, token: { accessToken: string }, copyIds: string[]) {
  const res = await page.request.post("/api/borrowings", {
    headers: bearer(token),
    data: { userId: READER_VALID.id, bookCopyIds: copyIds },
  });
  expect(res.ok(), "lập phiếu qua API").toBeTruthy();
  return (await res.json()) as { id: string };
}

async function createReservation(page: Page, token: { accessToken: string }, titleId: string) {
  const res = await page.request.post("/api/reservations", { headers: bearer(token), data: { titleId } });
  expect(res.ok(), "đặt trước qua API").toBeTruthy();
  return (await res.json()) as { id: string };
}

/** Chọn một mục trong ô chọn từ xa của antd: gõ từ khóa rồi bấm mục (option thật là .ant-select-item-option). */
async function pickOption(page: Page, box: ReturnType<Page["locator"]>, keyword: string, label: string) {
  await box.fill(keyword);
  await page.locator(".ant-select-item-option", { hasText: label }).click();
}

/** Nhãn của một lựa chọn trong bộ lọc Segmented (người dùng bấm vào chữ, không bấm vào ô radio ẩn). */
const segment = (page: Page, label: string) =>
  page.getByRole("radiogroup", { name: "Lọc theo trạng thái phiếu mượn" }).getByText(label, { exact: true });

const dataRows = (page: Page) => page.locator("table tbody tr[data-row-key]");

test.describe("circulation: phân quyền", () => {
  for (const [user, allowed, denied] of [
    ["member", 0, 2],
    ["staff", 1, 1], // có BorrowingController/borrow, không có returnBook
    ["admin", 2, 0], // admin bỏ qua kiểm khóa
  ] as const) {
    test(`trang gốc mượn trả: ${user} có ${allowed} quyền nghiệp vụ`, async ({ page }) => {
      await gotoAs(page, user, "/circulation");
      await expect(page.getByText("Quyền nghiệp vụ của bạn")).toBeVisible();
      await expect(page.getByText("Được phép")).toHaveCount(allowed);
      await expect(page.getByText("Không có quyền")).toHaveCount(denied);
    });
  }

  test("mục Mượn trả ở sidebar theo quyền: thủ thư thấy đủ, độc giả chỉ thấy Đặt trước và Phạt", async ({
    page,
    browser,
  }) => {
    await gotoAs(page, "librarian", "/circulation");
    const nav = sidebar(page);
    for (const name of ["Lập phiếu mượn", "Nhận trả sách", "Tra phiếu mượn", "Đặt trước", "Phạt"]) {
      await expect(nav.getByRole("link", { name }), name).toBeVisible();
    }
    // Trang gốc không còn thẻ lối tắt trong <main>
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(0);

    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await gotoAs(p, "reader", "/circulation/reservations");
    const pn = sidebar(p);
    await expect(pn.getByRole("link", { name: "Đặt trước" })).toBeVisible();
    await expect(pn.getByRole("link", { name: "Phạt" })).toBeVisible();
    for (const name of ["Lập phiếu mượn", "Nhận trả sách", "Tra phiếu mượn"]) {
      await expect(pn.getByRole("link", { name }), name).toHaveCount(0);
    }
    await ctx.close();
  });

  test("thiếu quyền xem trang: member thấy thông báo 403 ở borrow, return và reservations", async ({ page }) => {
    await loginAs(page, "member");
    for (const path of ["/circulation/borrow", "/circulation/return", "/circulation/reservations"]) {
      await gotoApp(page, path);
      await expect(page.getByText("Bạn chưa có quyền xem trang này"), path).toBeVisible();
    }
  });

  test("member vào /circulation/borrowings: thiếu quyền xem danh sách nhưng vẫn có ô tra phiếu theo mã", async ({ page }) => {
    await gotoAs(page, "member", "/circulation/borrowings");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(page.getByText("«Danh sách phiếu mượn»")).toBeVisible();
    await expect(page.getByLabel("Mã phiếu mượn (UUID)")).toBeVisible();
  });
});

test.describe("circulation: lập phiếu mượn", () => {
  test("thủ thư chọn độc giả, quét sách vào giỏ rồi lập phiếu", async ({ page }) => {
    await gotoAs(page, "librarian", "/circulation/borrow");

    // Bước 1: độc giả, kiểm thẻ
    await pickOption(page, page.locator("#reader-select"), "Lê Văn", READER_VALID.name);
    await expect(page.getByText("Thẻ hợp lệ")).toBeVisible();
    await expect(page.getByText("SV21-04817")).toBeVisible();

    // Bước 2: quét sách
    const scan = page.getByLabel("Quét hoặc nhập mã vạch sách");
    await scan.fill(COPY_JAVA_1.barcode);
    await scan.press("Enter");
    await expect(page.getByText("Đã thêm «Lập trình Java cơ bản».")).toBeVisible();
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();

    await scan.fill(COPY_JAVA_1.barcode);
    await scan.press("Enter");
    await expect(page.getByText("Mã này đã có trong phiếu.")).toBeVisible();

    await scan.fill("TV00010003"); // LOANED trong mock
    await scan.press("Enter");
    await expect(page.getByText(/đang cho mượn/)).toBeVisible();
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();

    await scan.fill("TV99999999");
    await scan.press("Enter");
    await expect(page.getByText("Không tìm thấy bản sao có mã vạch «TV99999999».")).toBeVisible();

    // Bước 3: lập phiếu
    await page.getByRole("button", { name: "Lập phiếu mượn" }).click();
    await expect(page.getByText("Đã lập phiếu mượn")).toBeVisible();
    await expect(page.getByTestId("borrowing-id")).toHaveText(/[0-9a-f-]{36}/);
    await expect(page.getByText("Hạn trả", { exact: true })).toBeVisible();

    // Lập phiếu mới: quay lại bước chọn độc giả
    await page.getByRole("button", { name: "Lập phiếu mới" }).click();
    await expect(page.locator("#reader-select")).toBeVisible();
  });

  test("bỏ sách khỏi giỏ: nút Bỏ làm giỏ trống lại", async ({ page }) => {
    await gotoAs(page, "librarian", "/circulation/borrow");
    await pickOption(page, page.locator("#reader-select"), "Lê Văn", READER_VALID.name);
    const scan = page.getByLabel("Quét hoặc nhập mã vạch sách");
    await scan.fill(COPY_JAVA_2.barcode);
    await scan.press("Enter");
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Bỏ «/ }).click();
    await expect(page.getByText("Chưa có sách. Quét mã vạch trên sách để thêm.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lập phiếu mượn" })).toBeDisabled();
  });

  test("thẻ độc giả hết hạn: báo thẻ không hợp lệ và khóa việc lập phiếu", async ({ page }) => {
    await gotoAs(page, "librarian", "/circulation/borrow");
    await pickOption(page, page.locator("#reader-select"), "Phạm", READER_EXPIRED_CARD.name);
    await expect(page.getByText("Thẻ không hợp lệ")).toBeVisible();
    await expect(page.getByText(/Không thể lập phiếu\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Lập phiếu mượn" })).toBeDisabled();
    await expect(page.getByLabel("Quét hoặc nhập mã vạch sách")).toHaveAttribute("readonly", "");
    await expect(page.getByTestId("scan-locked-note")).toBeVisible();
  });

  test("staff không có quyền tìm người dùng/tra mã vạch: nhập UUID, BE từ chối vì phạt chưa trả", async ({ page }) => {
    await gotoAs(page, "staff", "/circulation/borrow");
    await page.getByLabel("Mã người dùng (UUID)").fill(FINE_USER_ID);
    await page.getByRole("button", { name: "Chọn" }).click();
    await expect(page.getByText(/không có quyền xem hồ sơ độc giả/)).toBeVisible();

    const scan = page.getByLabel("Nhập mã bản sao (UUID)");
    await scan.fill(COPY_JAVA_1.id);
    await scan.press("Enter");
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Lập phiếu mượn" }).click();
    // UNPAID_FINES (409): FE dịch mã lỗi, và giữ giỏ nguyên để sửa
    await expect(page.getByText(/thanh toán phạt trước/)).toBeVisible();
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();
  });
});

test.describe("circulation: xem phiếu, gia hạn, trả sách", () => {
  test("tra phiếu theo mã: member (chỉ có quyền xem) vào chi tiết, không thấy nút thao tác", async ({ page }) => {
    await gotoAs(page, "member", "/circulation/borrowings");
    await markSpa(page);
    const lookup = page.getByLabel("Mã phiếu mượn (UUID)");
    await lookup.fill("khong-phai-uuid");
    await expect(page.getByText("Mã phiếu phải có dạng UUID.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Xem phiếu" })).toBeDisabled();
    await lookup.fill(BORROWING_RETURNED_ID);
    await page.getByRole("button", { name: "Xem phiếu" }).click();
    await expect(page).toHaveURL(new RegExp(`/circulation/borrowings/${BORROWING_RETURNED_ID}$`));
    await expect(page.getByText("Phiếu đã trả hết.")).toBeVisible();
    await expect(page.getByText("Bạn chỉ có quyền xem.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gia hạn" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Trả/ })).toHaveCount(0);
    expect(await readSpa(page), "chuyển trang phía client, không tải lại").toBe(1);
  });

  test("mã phiếu không tồn tại hoặc sai dạng: trang 404 của phiếu", async ({ page }) => {
    await gotoAs(page, "librarian", "/circulation/borrowings/bd000000-0000-4000-8000-0000000000ff");
    await expect(page.getByText("Không tìm thấy phiếu mượn", { exact: true })).toBeVisible();
    await gotoApp(page, "/circulation/borrowings/khong-phai-uuid");
    await expect(page.getByText("Không tìm thấy phiếu mượn", { exact: true })).toBeVisible();
  });

  test("gia hạn phiếu: hạn trả đổi và số lần gia hạn tăng", async ({ page }) => {
    const t = await loginAs(page, "librarian");
    const b = await createBorrowing(page, t, [COPY_JAVA_1.id]);
    await gotoApp(page, `/circulation/borrowings/${b.id}`);
    await expect(page.getByText("0/2 lần")).toBeVisible();
    await page.getByRole("button", { name: "Gia hạn", exact: true }).click();
    // Popconfirm: nút xác nhận cùng tên, nằm sau trong DOM
    await page.getByRole("button", { name: "Gia hạn", exact: true }).last().click();
    await expect(page.getByText(/Đã gia hạn\. Hạn trả mới/)).toBeVisible();
    await expect(page.getByText("1/2 lần")).toBeVisible();
  });

  test("phiếu quá hạn: hiện cảnh báo quá hạn, BE từ chối gia hạn và FE hiện message BE", async ({ page }) => {
    await gotoAs(page, "librarian", `/circulation/borrowings/${BORROWING_OVERDUE_ID}`);
    await expect(page.getByText(/Quá hạn \d+ ngày/)).toBeVisible();
    await page.getByRole("button", { name: "Gia hạn", exact: true }).click();
    await page.getByRole("button", { name: "Gia hạn", exact: true }).last().click();
    // 409 từ BE: Alert cảnh báo giữ message BE nguyên văn
    await expect(page.getByText("Phiếu mượn đã quá hạn, không thể gia hạn")).toBeVisible();
  });

  test("nhận trả sách: nhập mã phiếu, quét mã vạch, trả từng dòng đến khi phiếu trả hết", async ({ page }) => {
    const t = await loginAs(page, "librarian");
    const b = await createBorrowing(page, t, [COPY_JAVA_1.id, COPY_JAVA_2.id]);
    await gotoApp(page, "/circulation/return");
    await page.getByLabel("Mã phiếu mượn (UUID, dán từ phiếu in)").fill(b.id);
    await page.getByRole("button", { name: "Tải phiếu" }).click();
    await expect(page.getByRole("row", { name: new RegExp(COPY_JAVA_1.barcode) })).toBeVisible();

    const scan = page.getByLabel("Quét hoặc nhập mã vạch sách");
    // Sách không thuộc phiếu
    await scan.fill("TV00010003");
    await scan.press("Enter");
    await expect(page.getByText("Sách này không thuộc phiếu mượn đang chọn.")).toBeVisible();

    // Quét đúng sách thứ nhất
    await scan.fill(COPY_JAVA_1.barcode);
    await scan.press("Enter");
    await expect(page.getByText(/Đã nhận trả/)).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(COPY_JAVA_1.barcode) }).getByText("Đã trả")).toBeVisible();

    // Quét lại sách đã trả: thông báo trung tính, không phải lỗi
    await scan.fill(COPY_JAVA_1.barcode);
    await scan.press("Enter");
    await expect(page.getByText(/đã được trả trước đó/)).toBeVisible();

    // Trả cuốn còn lại bằng nút trên dòng
    await page.getByRole("row", { name: new RegExp(COPY_JAVA_2.barcode) }).getByRole("button", { name: /^Trả/ }).click();
    await expect(page.getByText("Phiếu đã trả hết.")).toBeVisible();
  });

  test("trả theo mã vạch: chọn Hỏng thì hiện phạt; báo mất có xác nhận; phiếu theo độc giả liệt kê phiếu", async ({ page }) => {
    const t = await loginAs(page, "clerk");
    const b = await createBorrowing(page, t, [COPY_OWN.id]);
    await gotoApp(page, "/circulation/return");
    await page.getByText("Hỏng", { exact: true }).click();
    const scan = page.getByLabel(/Mã vạch sách cần trả/);
    await scan.fill(COPY_OWN.barcode);
    await scan.press("Enter");
    const out = page.getByTestId("barcode-outcome");
    await expect(out.getByText(/Đã nhận trả sách/)).toBeVisible();
    await expect(out.getByText(/Phát sinh 1 khoản phạt/)).toBeVisible();

    // Mã vạch không có trong phiếu mở nào: báo lỗi, không crash
    await scan.fill(COPY_OWN.barcode);
    await scan.press("Enter");
    await expect(page.getByRole("status").getByText(/\S/).first()).toBeVisible();

    // Báo mất: cần xác nhận
    const b2 = await createBorrowing(page, t, [COPY_OWN.id]);
    await page.getByLabel("Mã vạch sách bị mất").fill(COPY_OWN.barcode);
    await page.getByRole("button", { name: "Báo mất" }).click();
    await page.getByRole("button", { name: "Xác nhận báo mất" }).click();
    await expect(out.getByText(/Đã ghi nhận mất sách/)).toBeVisible();
    expect(b.id).not.toBe(b2.id);

    // Phiếu theo độc giả (không gọi /api/borrowings/search)
    await gotoApp(page, `/circulation/borrowings?readerId=${READER_VALID.id}`);
    await expect(page.getByRole("link", { name: b.id.slice(0, 8) })).toBeVisible();
  });

  test("nhận trả sách: mã phiếu không tồn tại", async ({ page }) => {
    await gotoAs(page, "librarian", "/circulation/return");
    await page.getByLabel("Mã phiếu mượn (UUID, dán từ phiếu in)").fill("bd000000-0000-4000-8000-0000000000ff");
    await page.getByRole("button", { name: "Tải phiếu" }).click();
    await expect(page.getByText("Không tìm thấy phiếu mượn.")).toBeVisible();
  });
});

test.describe("circulation: danh sách phiếu mượn (lọc trạng thái, phân trang server)", () => {
  test("hiện danh sách kèm tên độc giả, bấm mã phiếu sang chi tiết bằng chuyển trang phía client", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/borrowings");
    await expect(page.getByRole("heading", { name: "Phiếu mượn", exact: true })).toBeVisible();
    await expect(page.getByText(/\d+ phiếu$/)).toBeVisible();
    // Tên độc giả có khi có quyền tìm người dùng
    const overdue = page.locator(`tr[data-row-key="${BORROWING_OVERDUE_ID}"]`);
    await expect(overdue).toBeVisible();
    await expect(overdue.getByText("Lê Văn Hùng (hung.le)")).toBeVisible();
    await expect(overdue.getByText("Quá hạn")).toBeVisible();

    await markSpa(page);
    await overdue.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/circulation/borrowings/${BORROWING_OVERDUE_ID}$`));
    await expect(page.getByText(/Quá hạn \d+ ngày/)).toBeVisible();
    expect(await readSpa(page), "không tải lại trang").toBe(1);
  });

  test("lọc Quá hạn: gọi API với overdue=true, đúng tổng và 20 dòng mỗi trang, phân trang server qua URL", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/borrowings");
    const first = page.waitForRequest((r) => r.url().includes("/api/borrowings/search") && r.url().includes("overdue=true"));
    await segment(page, "Quá hạn").click();
    const req = new URL((await first).url());
    expect(req.searchParams.get("page")).toBe("0");
    expect(req.searchParams.get("size")).toBe("20");
    expect(req.searchParams.has("status")).toBe(false);
    await expect(page).toHaveURL(/status=OVERDUE/);
    await expect(page.getByText(`${OVERDUE_TOTAL} phiếu`, { exact: true })).toBeVisible();
    await expect(dataRows(page)).toHaveCount(20);
    await expect(page.locator(`tr[data-row-key="${BORROWING_RETURNED_ID}"]`)).toHaveCount(0);

    // Sang trang 2 bằng thanh phân trang: URL có page=2, API nhận page=1 (BE đánh số từ 0)
    const second = page.waitForRequest((r) => r.url().includes("/api/borrowings/search") && r.url().includes("page=1&"));
    await page.getByTitle("2", { exact: true }).click();
    await second;
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/status=OVERDUE/);
    await expect(dataRows(page)).toHaveCount(20);

    // Trang cuối còn 6 dòng
    await gotoApp(page, "/circulation/borrowings?status=OVERDUE&page=3");
    await expect(dataRows(page)).toHaveCount(OVERDUE_TOTAL - 40);
  });

  test("lọc Đã trả hết rồi Đang mượn, rồi về Tất cả: bộ lọc nằm trên URL và đổi nội dung", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/borrowings?status=RETURNED");
    const returned = page.locator(`tr[data-row-key="${BORROWING_RETURNED_ID}"]`);
    await expect(returned).toBeVisible();
    await expect(page.locator(`tr[data-row-key="${BORROWING_OVERDUE_ID}"]`)).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Đã trả hết" })).toBeChecked();

    await segment(page, "Đang mượn").click();
    await expect(page).toHaveURL(/status=ACTIVE/);
    await expect(returned).toHaveCount(0);
    await expect(dataRows(page).first()).toBeVisible();

    await segment(page, "Tất cả").click();
    await expect(page).not.toHaveURL(/status=/);
    await expect(page.getByRole("radio", { name: "Tất cả" })).toBeChecked();
  });

  test("staff có quyền lập phiếu nhưng không có quyền xem danh sách: chỉ thấy ô tra phiếu và thông báo thiếu quyền", async ({ page }) => {
    await gotoAs(page, "staff", "/circulation/borrowings");
    await expect(page.getByLabel("Mã phiếu mượn (UUID)")).toBeVisible();
    await expect(page.getByText("«Danh sách phiếu mượn»")).toBeVisible();
    await expect(dataRows(page)).toHaveCount(0);
  });
});

test.describe("circulation: phạt", () => {
  test("thủ thư chưa chọn độc giả: hiện ô chọn; chọn độc giả thì URL có readerId và hiện tổng chưa thanh toán + khoản phạt", async ({
    page,
  }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/fines");
    await expect(page.getByText("Tra cứu và thu phí phạt của độc giả.")).toBeVisible();
    await expect(page.getByText("Chọn một độc giả để xem các khoản phạt.")).toBeVisible();

    await pickOption(page, page.getByRole("combobox"), "Lê Văn", FINE_READER.name);
    await expect(page).toHaveURL(new RegExp(`readerId=${FINE_READER.id}`));
    await expect(page.getByText("Tổng chưa thanh toán")).toBeVisible();
    await expect(page.getByText(/15\.000\s*₫/).first()).toBeVisible();
    const rows = dataRows(page);
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Trả trễ hạn" }).getByText("Chưa thanh toán")).toBeVisible();
    await expect(rows.filter({ hasText: "Sách hỏng" }).getByText("Đã thanh toán")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thu phạt" })).toBeVisible();
  });

  test("thu phạt: xác nhận, thu toàn bộ khoản chưa trả, tổng về 0 và nút thu biến mất", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, `/circulation/fines?readerId=${FINE_COLLECT_READER_ID}`);
    await expect(page.getByText(/50\.000\s*₫/).first()).toBeVisible();
    await expect(dataRows(page)).toHaveCount(2);

    await page.getByRole("button", { name: "Thu phạt", exact: true }).click();
    await expect(page.getByText(/^Thu 50\.000\s*₫\?$/)).toBeVisible();
    // Popconfirm: nút xác nhận cùng tên, nằm sau trong DOM
    await page.getByRole("button", { name: "Thu phạt", exact: true }).last().click();
    await expect(page.getByText("Đã thu 2 khoản phạt.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Thu phạt", exact: true })).toHaveCount(0);
    await expect(dataRows(page).filter({ hasText: "Chưa thanh toán" })).toHaveCount(0);
    await expect(dataRows(page).filter({ hasText: "Đã thanh toán" })).toHaveCount(2);
  });

  test("có quyền xem phạt nhưng không có quyền thu: xem được, không có nút Thu phạt, có thông báo thiếu quyền", async ({ page }) => {
    await loginAs(page, "finelook");
    await gotoApp(page, `/circulation/fines?readerId=${FINE_READER.id}`);
    await expect(page.getByText(/15\.000\s*₫/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Thu phạt" })).toHaveCount(0);
    await expect(page.getByText("«Thu phạt»")).toBeVisible();
  });

  test("readerId sai dạng trên URL: coi như chưa chọn độc giả", async ({ page }) => {
    await loginAs(page, "clerk");
    await gotoApp(page, "/circulation/fines?readerId=khong-phai-uuid");
    await expect(page.getByText("Chọn một độc giả để xem các khoản phạt.")).toBeVisible();
  });

  test("người dùng thường xem phạt của chính mình (/api/fines/mine), không có ô chọn độc giả", async ({ page }) => {
    await gotoAs(page, "reader", "/circulation/fines");
    await expect(page.getByText("Các khoản phạt của bạn.")).toBeVisible();
    await expect(page.getByText(/10\.000\s*₫/).first()).toBeVisible();
    await expect(dataRows(page)).toHaveCount(1);
    await expect(page.getByPlaceholder("Tìm độc giả theo tên, tài khoản hoặc email")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Thu phạt" })).toHaveCount(0);
  });

  test("tài khoản không có khoản phạt nào: tổng 0 và thông báo trống", async ({ page }) => {
    await gotoAs(page, "member", "/circulation/fines");
    await expect(page.getByText("Độc giả không có khoản phạt nào.")).toBeVisible();
    await expect(page.getByText(/0\s*₫/).first()).toBeVisible();
  });
});

test.describe("circulation: đặt trước", () => {
  test("độc giả thấy đặt trước sẵn sàng nhận ở đầu danh sách và không có nút hủy quá hạn", async ({ page }) => {
    await gotoAs(page, "reader", "/circulation/reservations");
    await expect(page.getByRole("heading", { name: "Đặt trước" })).toBeVisible();
    await expect(page.getByText("Nhận trước 10/01/2030").first()).toBeVisible(); // bảng + danh sách thẻ (responsive)
    await expect(page.getByText("Sẵn sàng nhận").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Hủy đặt trước quá hạn" })).toHaveCount(0);
    // Tab lịch sử có đặt trước đã nhận
    await page.getByRole("tab", { name: /Lịch sử/ }).click();
    await expect(page.getByText("Đã nhận", { exact: true }).first()).toBeVisible();
  });

  test("tạo đặt trước từ hộp thoại: chọn sách, đặt trước, báo vị trí hàng đợi", async ({ page }) => {
    await gotoAs(page, "reader", "/circulation/reservations");
    await page.getByRole("button", { name: "Đặt trước sách" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // FormModal gọi resetFields trong afterOpenChange (sau animation mở): đợi animation xong rồi mới gõ, nếu không ô bị xóa mất.
    await expect(page.locator(".ant-modal")).not.toHaveClass(/ant-zoom/);
    await pickOption(page, dialog.getByRole("combobox"), "Cấu trúc", TITLE_DSA.name);
    await dialog.getByRole("button", { name: "Đặt trước", exact: true }).click();
    await expect(page.getByText(/Đã đặt trước\. Bạn đứng thứ \d+ trong hàng đợi\./)).toBeVisible();
  });

  test("hủy đặt trước: dòng chuyển khỏi tab đang hiệu lực", async ({ page }) => {
    const t = await loginAs(page, "reader");
    const r = await createReservation(page, t, TITLE_DSA.id);
    await gotoApp(page, "/circulation/reservations");
    const row = page.locator(`tr[data-row-key="${r.id}"]`);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^Hủy đặt trước/ }).click();
    await page.getByRole("button", { name: "Hủy đặt trước", exact: true }).click();
    await expect(page.getByText(/Đã hủy đặt trước «/)).toBeVisible();
    await expect(page.locator(`tr[data-row-key="${r.id}"]`)).toHaveCount(0);
  });

  test("thủ thư có nút hủy đặt trước quá hạn nhận", async ({ page }) => {
    await gotoAs(page, "librarian", "/circulation/reservations");
    await page.getByRole("button", { name: "Hủy đặt trước quá hạn" }).click();
    await page.getByRole("button", { name: "Hủy quá hạn", exact: true }).click();
    await expect(page.getByText(/Đã hủy \d+ đặt trước quá hạn nhận\./)).toBeVisible();
  });
});
