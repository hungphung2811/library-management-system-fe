import { expect, test } from "@playwright/test";
import { gotoAs } from "./helpers";

// Dữ liệu mock: e2e/mock/circulation.mjs (clerk đề nghị, finemgr duyệt).
const READER = "a0000000-0000-4000-8000-000000000001";

test.describe("đền bù: cấu hình, yêu cầu điều chỉnh, duyệt", () => {
  test("quản lý lưu chính sách đền bù và thêm mức hư hại", async ({ page }) => {
    await gotoAs(page, "finemgr", "/circulation/compensation");
    await expect(page.getByRole("heading", { name: "Đền bù và mức hư hại" })).toBeVisible();
    await expect(page.locator("tr[data-row-key=MINOR]")).toContainText("20%");

    const rate = page.getByLabel("Tỷ lệ đền khi mất sách (%)");
    await rate.fill("200");
    await page.getByRole("button", { name: "Lưu chính sách" }).click();
    await expect(page.getByText("Đã lưu chính sách đền bù.")).toBeVisible();

    await page.getByRole("button", { name: "Thêm mức hư hại" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Mã", { exact: true }).fill("WATER");
    await dlg.getByLabel("Tên mức").fill("Dính nước");
    await dlg.getByLabel("Tỷ lệ đền (%)").fill("70");
    await dlg.getByRole("button", { name: "Thêm", exact: true }).click();
    await expect(page.locator("tr[data-row-key=WATER]")).toContainText("70%");
  });

  test("thủ thư gửi yêu cầu giảm phạt từ dòng phạt", async ({ page }) => {
    await gotoAs(page, "clerk", `/circulation/fines?readerId=${READER}`);
    const row = page.locator("tr[data-row-key=f0000000-0000-4000-8000-000000000001]");
    await row.getByRole("button", { name: "Yêu cầu điều chỉnh" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Lý do").fill("Hoàn cảnh khó khăn");
    await dlg.getByRole("button", { name: "Gửi yêu cầu" }).click();
    // Mock đã có yêu cầu chờ duyệt cho khoản này nên BE trả 409; hộp thoại giữ lại và báo lỗi.
    await expect(dlg.getByText("Khoản phạt này đã có yêu cầu đang chờ duyệt.")).toBeVisible();
  });

  test("quản lý duyệt yêu cầu miễn/giảm và từ chối yêu cầu hoàn khoản", async ({ page }) => {
    await gotoAs(page, "finemgr", "/circulation/fine-requests");
    const row = page.locator("tr[data-row-key=ad100000-0000-4000-8000-000000000002]");
    await row.getByRole("button", { name: "Duyệt" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Duyệt", exact: true }).click();
    await expect(row).toContainText("Đã duyệt");

    await page.getByRole("tab", { name: "Hoàn khoản sách tìm lại" }).click();
    const refund = page.locator("tr[data-row-key=ae100000-0000-4000-8000-000000000001]");
    await refund.getByRole("button", { name: "Từ chối" }).click();
    await page.getByRole("dialog").getByLabel("Ghi chú (tùy chọn)").fill("Chưa đủ giấy tờ");
    await page.getByRole("dialog").getByRole("button", { name: "Từ chối", exact: true }).click();
    await expect(refund).toContainText("Đã từ chối");
  });

  test("thủ thư không thấy mục cấu hình đền bù khi thiếu quyền duyệt", async ({ page }) => {
    await gotoAs(page, "clerk", "/circulation/fine-requests");
    await expect(page.getByRole("tab", { name: "Hoàn khoản sách tìm lại" })).toHaveCount(0);
    await expect(page.locator("tr[data-row-key=ad100000-0000-4000-8000-000000000001]").getByRole("button", { name: "Duyệt" })).toHaveCount(0);
  });
});
