import { expect, test } from "@playwright/test";
import { gotoAs } from "./helpers";

// ShortId (cột ID của bảng): icon sao chép chỉ hiện khi rê chuột hoặc focus bàn phím. Dùng danh sách vai trò của admin (mock).

test.describe("cột ID: icon sao chép chỉ hiện khi hover", () => {
  test("mặc định ẩn, rê chuột vào id thì hiện, rời đi thì ẩn lại", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    const id = page.getByTestId("short-id").first();
    await expect(id).toBeVisible();
    const copy = id.getByRole("button", { name: /^Sao chép id / });
    await expect(copy).toHaveCSS("opacity", "0");
    await id.hover();
    await expect(copy).toHaveCSS("opacity", "1");
    await page.getByRole("main").getByRole("heading").first().hover();
    await expect(copy).toHaveCSS("opacity", "0");
  });

  test("focus bằng bàn phím cũng hiện icon (truy cập được khi không dùng chuột)", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    const copy = page.getByTestId("short-id").first().getByRole("button", { name: /^Sao chép id / });
    await copy.focus();
    await expect(copy).toHaveCSS("opacity", "1");
  });

  test("bấm sao chép: hiện thông báo và dấu ✓ giữ icon hiển thị", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoAs(page, "admin", "/admin/roles");
    const id = page.getByTestId("short-id").first();
    await id.hover();
    await id.getByRole("button", { name: /^Sao chép id / }).click();
    await expect(page.getByText("Đã sao chép id")).toBeVisible();
    await page.getByRole("main").getByRole("heading").first().hover();
    await expect(id.getByRole("button", { name: /^Sao chép id / })).toHaveCSS("opacity", "1");
  });
});
