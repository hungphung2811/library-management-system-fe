import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

// Dữ liệu mock (e2e/mock/data.mjs và e2e/mock/circulation.mjs). Hằng số đặt lại ở đây vì spec .ts không import .mjs.
const READER_VALID = { id: "u0000000-0000-4000-8000-000000000001", name: "Lê Văn Một" };
const READER_EXPIRED_CARD = { name: "Phạm Thị Hai" };
const FINE_USER_ID = "f1000000-0000-4000-8000-0000000000f1";
const COPY_JAVA_1 = { id: "c0000000-0000-4000-8000-000000000001", barcode: "BC-JAVA-001" };
const COPY_JAVA_2 = { id: "c0000000-0000-4000-8000-000000000002", barcode: "BC-JAVA-002" };
const BORROWING_OVERDUE_ID = "bd000000-0000-4000-8000-000000000001";
const BORROWING_RETURNED_ID = "bd000000-0000-4000-8000-000000000002";
const TITLE_DSA = { id: "b0000000-0000-4000-8000-000000000002", name: "Cấu trúc dữ liệu và giải thuật" };

// Chưa chạy được trong phiên viết (cổng bị chiếm): test bám theo mock, cần chạy `npm run test:e2e`.

/** Mở trang và đợi hydrate xong (điền ô khi React chưa hydrate thì state không nhận giá trị). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Lập phiếu bằng API (qua BFF của shell) để test không phụ thuộc test khác; trả về phiếu có id riêng. */
async function createBorrowing(page: Page, copyIds: string[]) {
  const res = await page.request.post("/api/bff/borrowings", { data: { userId: READER_VALID.id, bookCopyIds: copyIds } });
  expect(res.ok(), "lập phiếu qua BFF").toBeTruthy();
  return (await res.json()) as { id: string };
}

async function createReservation(page: Page, titleId: string) {
  const res = await page.request.post("/api/bff/reservations", { data: { titleId } });
  expect(res.ok(), "đặt trước qua BFF").toBeTruthy();
  return (await res.json()) as { id: string };
}

test.describe("zone circulation: phân quyền", () => {
  test("trang mượn trả: member không quyền nào, staff chỉ được mượn, admin được cả hai", async ({ page, browser }) => {
    const expectations = [
      ["member", 0, 2],
      ["staff", 1, 1], // có BorrowingController/borrow, không có returnBook
      ["admin", 2, 0], // admin bỏ qua kiểm khóa
    ] as const;
    for (const [user, allowed, denied] of expectations) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await loginAs(p, user);
      await p.goto("/circulation");
      await expect(p.getByText("Được phép"), `${user}: được phép`).toHaveCount(allowed);
      await expect(p.getByText("Không có quyền"), `${user}: không có quyền`).toHaveCount(denied);
      await ctx.close();
    }
  });

  test("mục Mượn trả ở sidebar theo quyền: thủ thư thấy đủ 4, độc giả chỉ thấy Đặt trước; trang gốc không còn thẻ lối tắt", async ({
    page,
    browser,
  }) => {
    await loginAs(page, "librarian");
    await page.goto("/circulation");
    const nav = page.getByRole("navigation");
    for (const name of ["Lập phiếu mượn", "Nhận trả sách", "Tra phiếu mượn", "Đặt trước"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect(page.getByRole("main").getByRole("link")).toHaveCount(0);
    await expect(page.getByText("Quyền nghiệp vụ của bạn")).toBeVisible();

    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await loginAs(p, "reader");
    await p.goto("/circulation/reservations");
    const pn = p.getByRole("navigation");
    await expect(pn.getByRole("link", { name: "Đặt trước" })).toBeVisible();
    await expect(pn.getByRole("link", { name: "Lập phiếu mượn" })).toHaveCount(0);
    await expect(pn.getByRole("link", { name: "Nhận trả sách" })).toHaveCount(0);
    await expect(pn.getByRole("link", { name: "Tra phiếu mượn" })).toHaveCount(0);
    await ctx.close();
  });

  test("thiếu quyền xem trang: member thấy thông báo 403 ở /borrow, /return và /reservations", async ({ page }) => {
    await loginAs(page, "member");
    for (const path of ["/circulation/borrow", "/circulation/return", "/circulation/reservations"]) {
      await page.goto(path);
      await expect(page.getByText("Bạn chưa có quyền xem trang này"), path).toBeVisible();
    }
  });
});

test.describe("zone circulation: lập phiếu mượn", () => {
  test("thủ thư chọn độc giả, quét sách vào giỏ rồi lập phiếu", async ({ page }) => {
    await loginAs(page, "librarian");
    await open(page, "/circulation/borrow");

    // Bước 1: độc giả, kiểm thẻ (option thật của antd là .ant-select-item-option; role=option là danh sách a11y ẩn)
    await page.locator("#reader-select").fill("Lê Văn");
    await page.locator(".ant-select-item-option", { hasText: READER_VALID.name }).click();
    await expect(page.getByText("Thẻ hợp lệ")).toBeVisible();
    await expect(page.getByText("RD-0001")).toBeVisible();

    // Bước 2: quét sách
    const scan = page.getByLabel("Quét hoặc nhập mã vạch sách");
    await scan.fill(COPY_JAVA_1.barcode);
    await scan.press("Enter");
    await expect(page.getByText("Đã thêm «Lập trình Java cơ bản».")).toBeVisible();
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();

    await scan.fill(COPY_JAVA_1.barcode);
    await scan.press("Enter");
    await expect(page.getByText("Mã này đã có trong phiếu.")).toBeVisible();

    await scan.fill("BC-DSA-001"); // LOANED trong mock
    await scan.press("Enter");
    await expect(page.getByText(/đang cho mượn/)).toBeVisible();
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();

    await scan.fill("BC-KHONG-CO");
    await scan.press("Enter");
    await expect(page.getByText("Không tìm thấy bản sao có mã vạch «BC-KHONG-CO».")).toBeVisible();

    // Bước 3: lập phiếu
    await page.getByRole("button", { name: "Lập phiếu mượn" }).click();
    await expect(page.getByText("Đã lập phiếu mượn")).toBeVisible();
    await expect(page.getByTestId("borrowing-id")).toHaveText(/^[0-9a-f-]{36}$/);
    await expect(page.getByText("Hạn trả", { exact: true })).toBeVisible();

    // Lập phiếu mới: quay lại bước chọn độc giả
    await page.getByRole("button", { name: "Lập phiếu mới" }).click();
    await expect(page.locator("#reader-select")).toBeVisible();
  });

  test("thẻ độc giả hết hạn: báo thẻ không hợp lệ và khóa việc lập phiếu", async ({ page }) => {
    await loginAs(page, "librarian");
    await open(page, "/circulation/borrow");
    await page.locator("#reader-select").fill("Phạm");
    await page.locator(".ant-select-item-option", { hasText: READER_EXPIRED_CARD.name }).click();
    await expect(page.getByText("Thẻ không hợp lệ")).toBeVisible();
    await expect(page.getByText("Không thể lập phiếu.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lập phiếu mượn" })).toBeDisabled();
    await expect(page.getByLabel("Quét hoặc nhập mã vạch sách")).toHaveAttribute("readonly", "");
  });

  test("staff không có quyền tìm người dùng/tra mã vạch: nhập UUID, BE từ chối vì phạt chưa trả", async ({ page }) => {
    await loginAs(page, "staff");
    await open(page, "/circulation/borrow");
    await page.getByLabel("Mã người dùng (UUID)").fill(FINE_USER_ID);
    await page.getByRole("button", { name: "Chọn" }).click();
    await expect(page.getByText(/không có quyền xem hồ sơ độc giả/)).toBeVisible();

    const scan = page.getByLabel("Nhập mã bản sao (UUID)");
    await scan.fill(COPY_JAVA_1.id);
    await scan.press("Enter");
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Lập phiếu mượn" }).click();
    await expect(page.getByText(/thanh toán phạt trước/)).toBeVisible();
    // Giỏ được giữ nguyên để sửa
    await expect(page.getByText("1 cuốn", { exact: true })).toBeVisible();
  });
});

test.describe("zone circulation: xem phiếu, gia hạn, trả sách", () => {
  test("tra phiếu theo mã: member (chỉ có quyền xem) vào chi tiết, không thấy nút thao tác", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/circulation/borrowings");
    await page.getByLabel("Mã phiếu mượn (UUID)").fill(BORROWING_RETURNED_ID);
    await page.getByRole("button", { name: "Xem phiếu" }).click();
    await expect(page).toHaveURL(new RegExp(`/circulation/borrowings/${BORROWING_RETURNED_ID}$`));
    await expect(page.getByText("Phiếu đã trả hết.")).toBeVisible();
    await expect(page.getByText("Bạn chỉ có quyền xem.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gia hạn" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Trả/ })).toHaveCount(0);
  });

  test("mã phiếu không tồn tại hoặc sai dạng: trang 404 của phiếu", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/circulation/borrowings/bd000000-0000-4000-8000-0000000000ff");
    await expect(page.getByText("Không tìm thấy phiếu mượn")).toBeVisible();
    await page.goto("/circulation/borrowings/khong-phai-uuid");
    await expect(page.getByText("Không tìm thấy phiếu mượn")).toBeVisible();
  });

  test("gia hạn phiếu: hạn trả đổi và số lần gia hạn tăng", async ({ page }) => {
    await loginAs(page, "librarian");
    const b = await createBorrowing(page, [COPY_JAVA_1.id]);
    await page.goto(`/circulation/borrowings/${b.id}`);
    await expect(page.getByText("0/2 lần")).toBeVisible();
    await page.getByRole("button", { name: "Gia hạn", exact: true }).click();
    // Popconfirm: nút xác nhận cùng tên, nằm sau trong DOM
    await page.getByRole("button", { name: "Gia hạn", exact: true }).last().click();
    await expect(page.getByText(/Đã gia hạn\. Hạn trả mới/)).toBeVisible();
    await expect(page.getByText("1/2 lần")).toBeVisible();
  });

  test("phiếu quá hạn: hiện cảnh báo quá hạn, BE từ chối gia hạn và FE hiện message BE", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto(`/circulation/borrowings/${BORROWING_OVERDUE_ID}`);
    await expect(page.getByText(/Quá hạn \d+ ngày/)).toBeVisible();
    await page.getByRole("button", { name: "Gia hạn", exact: true }).click();
    await page.getByRole("button", { name: "Gia hạn", exact: true }).last().click();
    // 409 từ BE: Alert cảnh báo giữ message BE nguyên văn
    await expect(page.getByText("Phiếu mượn đã quá hạn, không thể gia hạn")).toBeVisible();
  });

  test("nhận trả sách: nhập mã phiếu, quét mã vạch, trả từng dòng đến khi phiếu trả hết", async ({ page }) => {
    await loginAs(page, "librarian");
    const b = await createBorrowing(page, [COPY_JAVA_1.id, COPY_JAVA_2.id]);
    await page.goto("/circulation/return");
    await page.getByLabel("Mã phiếu mượn (UUID, dán từ phiếu in)").fill(b.id);
    await page.getByRole("button", { name: "Tải phiếu" }).click();
    await expect(page.getByRole("row", { name: new RegExp(COPY_JAVA_1.barcode) })).toBeVisible();

    const scan = page.getByLabel("Quét hoặc nhập mã vạch sách");
    // Sách không thuộc phiếu
    await scan.fill("BC-DSA-001");
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

  test("nhận trả sách: mã phiếu không tồn tại", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/circulation/return");
    await page.getByLabel("Mã phiếu mượn (UUID, dán từ phiếu in)").fill("bd000000-0000-4000-8000-0000000000ff");
    await page.getByRole("button", { name: "Tải phiếu" }).click();
    await expect(page.getByText("Không tìm thấy phiếu mượn.")).toBeVisible();
  });
});

test.describe("zone circulation: đặt trước", () => {
  test("độc giả thấy đặt trước sẵn sàng nhận ở đầu danh sách và không có nút hủy quá hạn", async ({ page }) => {
    await loginAs(page, "reader");
    await page.goto("/circulation/reservations");
    await expect(page.getByRole("heading", { name: "Đặt trước" })).toBeVisible();
    await expect(page.getByText("Nhận trước 10/01/2030").first()).toBeVisible(); // bảng + danh sách thẻ (responsive)
    await expect(page.getByText("Sẵn sàng nhận").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Hủy đặt trước quá hạn" })).toHaveCount(0);
    // Tab lịch sử có đặt trước đã nhận
    await page.getByRole("tab", { name: /Lịch sử/ }).click();
    await expect(page.getByText("Đã nhận", { exact: true }).first()).toBeVisible();
  });

  test("tạo đặt trước từ hộp thoại: chọn sách, đặt trước, báo vị trí hàng đợi", async ({ page }) => {
    await loginAs(page, "reader");
    await open(page, "/circulation/reservations");
    const dialog = page.getByRole("dialog");
    // Máy tải nặng: lần bấm đầu có thể rơi vào lúc chưa hydrate xong nên thử lại đến khi hộp thoại mở.
    await expect(async () => {
      await page.getByRole("button", { name: "Đặt trước sách" }).click();
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20_000 });
    await dialog.getByRole("combobox").fill("Cấu trúc");
    await page.locator(".ant-select-item-option", { hasText: TITLE_DSA.name }).click();
    await dialog.getByRole("button", { name: "Đặt trước", exact: true }).click();
    await expect(page.getByText(/Đã đặt trước\. Bạn đứng thứ \d+ trong hàng đợi\./)).toBeVisible();
  });

  test("hủy đặt trước: dòng chuyển khỏi tab đang hiệu lực", async ({ page }) => {
    await loginAs(page, "reader");
    const r = await createReservation(page, TITLE_DSA.id);
    await page.goto("/circulation/reservations");
    const row = page.locator(`tr[data-row-key="${r.id}"]`);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^Hủy đặt trước/ }).click();
    await page.getByRole("button", { name: "Hủy đặt trước", exact: true }).click();
    await expect(page.getByText(/Đã hủy đặt trước «/)).toBeVisible();
    await expect(page.locator(`tr[data-row-key="${r.id}"]`)).toHaveCount(0);
  });

  test("thủ thư có nút hủy đặt trước quá hạn nhận", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/circulation/reservations");
    await page.getByRole("button", { name: "Hủy đặt trước quá hạn" }).click();
    await page.getByRole("button", { name: "Hủy quá hạn", exact: true }).click();
    await expect(page.getByText(/Đã hủy \d+ đặt trước quá hạn nhận\./)).toBeVisible();
  });
});
