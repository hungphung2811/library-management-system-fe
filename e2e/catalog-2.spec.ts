import { expect, test } from "@playwright/test";
import { gotoAs } from "./helpers";

// Bổ sung cho catalog: sửa đầu sách, form tìm kiếm (ISBN, sắp xếp, cỡ trang, trang trên URL, chip, đếm), tra mã vạch.
// Bám e2e/mock/catalog.mjs (SEED.editable, isbnA, dupIsbn; 25 "Tuyển tập văn học Việt Nam, tập NN").

test.describe("catalog: sửa đầu sách", () => {
  test("admin sửa tên, tác giả, ISBN, giá bìa; ô có sẵn giá trị và trang cập nhật", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog?q=" + encodeURIComponent("Sách để sửa thông tin"));
    await page.getByRole("table").getByRole("link", { name: "Sách để sửa thông tin" }).click();
    await page.getByRole("dialog").first().getByRole("button", { name: /Sửa$/ }).first().click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin sách" });
    await expect(dlg.getByLabel("Tên sách")).toHaveValue("Sách để sửa thông tin");
    await expect(dlg.getByLabel("Tác giả")).toHaveValue("Tác giả cũ");
    await expect(dlg.getByLabel("ISBN")).toHaveValue("9786041119001");
    await dlg.getByLabel("Tác giả").fill("Tác giả mới");
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã cập nhật thông tin sách.")).toBeVisible();
    await expect(page.getByText("Tác giả mới").first()).toBeVisible();
  });

  test("ISBN trùng thì báo lỗi trong hộp thoại và giữ dữ liệu", async ({ page }) => {
    await gotoAs(page, "admin", "/catalog?q=" + encodeURIComponent("Sách ISBN lọc A"));
    await page.getByRole("table").getByRole("link", { name: "Sách ISBN lọc A" }).click();
    await page.getByRole("dialog").first().getByRole("button", { name: /Sửa$/ }).first().click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin sách" });
    await dlg.getByLabel("ISBN").fill("9786041118882");
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(dlg.locator(".ant-alert-error")).toBeVisible();
    await expect(dlg.getByLabel("ISBN")).toHaveValue("9786041118882");
  });

  test("người không có TitleController/update không thấy nút Sửa", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog?q=" + encodeURIComponent("Sách ISBN lọc A"));
    await page.getByRole("table").getByRole("link", { name: "Sách ISBN lọc A" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Sách ISBN lọc A" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sửa$/ })).toHaveCount(0);
  });
});

test.describe("catalog: form tìm kiếm", () => {
  test("nhãn ô tìm không nhắc ISBN; ô ISBN lọc riêng, có chip, đếm và xóa bộ lọc", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog");
    await expect(page.getByRole("searchbox")).toHaveAttribute("placeholder", "Tìm theo tên sách hoặc tác giả");
    await page.getByRole("textbox", { name: "Lọc theo ISBN" }).fill("97860411188");
    await expect(page).toHaveURL(/isbn=97860411188/);
    await expect(page.getByTestId("result-count")).toHaveText("2 đầu sách");
    await expect(page.getByRole("textbox", { name: "Lọc theo ISBN" })).toHaveValue("97860411188"); // giá trị lọc hiện trong ô, không có chip
    await expect(page.getByText("ISBN: 97860411188")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Lọc theo ISBN" }).fill("");
    await expect(page).not.toHaveURL(/isbn=/);
    await page.getByRole("textbox", { name: "Lọc theo ISBN" }).fill("97860411188");
    await expect(page).toHaveURL(/isbn=/);
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(page.getByRole("textbox", { name: "Lọc theo ISBN" })).toHaveValue("");
  });

  test("cỡ trang 10 và trang nằm trên URL; sắp xếp theo tên Z-A", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog?q=" + encodeURIComponent("Tuyển tập văn học Việt Nam") + "&size=10");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(11); // 1 tiêu đề + 10 dòng
    await page.getByRole("link", { name: "Trang 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(table.getByRole("row")).toHaveCount(11);
    await page.reload();
    await expect(page).toHaveURL(/page=2/);
    await expect(table.getByRole("link", { name: "Tuyển tập văn học Việt Nam, tập 11" })).toBeVisible();

    await page.getByRole("combobox", { name: "Sắp xếp" }).click();
    await page.getByTitle("Tên sách Z → A").click();
    await expect(page).toHaveURL(/sort=name-desc/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(table.getByRole("link").first()).toHaveText("Tuyển tập văn học Việt Nam, tập 25");
  });
});

test.describe("catalog: tra mã vạch", () => {
  test("mục Vừa tra có link sang sách và nút copy mã", async ({ page }) => {
    await gotoAs(page, "librarian", "/catalog/barcode");
    await page.getByRole("textbox").first().fill("TV00031031");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Vừa tra")).toBeVisible();
    const recent = page.locator(".ant-card", { hasText: "Vừa tra" });
    await expect(recent.getByRole("link", { name: "Hoàng Lê nhất thống chí" })).toBeVisible();
    await expect(recent.getByRole("button", { name: "Sao chép" }).first()).toBeVisible();
    await recent.getByRole("button", { name: "Xóa lịch sử" }).click();
    await expect(page.getByText("Vừa tra")).toHaveCount(0);
  });
});
