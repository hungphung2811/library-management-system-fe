import { expect, test } from "@playwright/test";
import { gotoApp, loginAs, sidebar, type UserKey } from "./helpers";

// Phân quyền phía UI cho khung ứng dụng (nav + chặn trang không có khóa). Nội dung chi tiết từng trang thuộc spec nhóm:
// catalog.spec.ts, circulation.spec.ts, admin.spec.ts (các agent nhóm bổ sung kiểm thử quyền theo trang ở đó).
test.describe("phân quyền: thanh điều hướng", () => {
  test("nhóm Quản trị hiện với admin và người có khóa, ẩn với người không có", async ({ page }) => {
    for (const [user, visible] of [["admin", 1], ["staff", 1], ["member", 0]] as const satisfies readonly [UserKey, number][]) {
      await loginAs(page, user);
      await gotoApp(page, "/");
      await expect(sidebar(page).getByRole("button", { name: "Quản trị" }), `user ${user}`).toHaveCount(visible);
    }
  });

  test("nhóm Mượn trả luôn hiện (có mục 'Phiếu của tôi' không cần khóa); mục nghiệp vụ chỉ hiện khi có khóa (any-of)", async ({ page }) => {
    // [user, số mục "Lập phiếu mượn", số mục "Đặt trước"]: member không có khóa nào thì chỉ còn "Phiếu của tôi".
    for (const [user, borrow, reserve] of [["admin", 1, 1], ["staff", 1, 0], ["reader", 0, 1], ["member", 0, 0]] as const satisfies readonly [UserKey, number, number][]) {
      await loginAs(page, user);
      await gotoApp(page, "/");
      const nav = sidebar(page);
      await expect(nav.getByRole("button", { name: "Mượn trả" }), `user ${user}`).toHaveCount(1);
      await expect(nav.getByRole("link", { name: "Phiếu của tôi" }), `user ${user}`).toHaveCount(1);
      await expect(nav.getByRole("link", { name: "Lập phiếu mượn" }), `user ${user}`).toHaveCount(borrow);
      await expect(nav.getByRole("link", { name: "Đặt trước" }), `user ${user}`).toHaveCount(reserve);
    }
  });

  test("header hiển thị username (không phải id người dùng) trong menu người dùng", async ({ page }) => {
    await loginAs(page, "staff");
    await gotoApp(page, "/");
    await expect(page.getByRole("button", { name: "Tài khoản của tôi" })).toHaveAttribute("title", "staff");
  });
});

test.describe("phân quyền: trang không có khóa", () => {
  test("member vào /admin/roles thấy thông báo thiếu quyền (trong khung), không có dữ liệu", async ({ page }) => {
    await loginAs(page, "member");
    await gotoApp(page, "/admin/roles");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(page.getByRole("link", { name: "Về trang chủ", exact: true })).toBeVisible();
  });

  test("staff có khóa listRoles thì vào được /admin/roles, nhưng /admin/users bị chặn", async ({ page }) => {
    await loginAs(page, "staff");
    await gotoApp(page, "/admin/roles");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toHaveCount(0);
    await gotoApp(page, "/admin/users");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });
});
