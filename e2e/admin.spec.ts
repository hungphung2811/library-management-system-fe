import { expect, test, type Page } from "@playwright/test";
import { gotoApp, gotoAs, loginAs, loginApi, bearer, sidebar } from "./helpers";
import { departmentSpec, person, readerCardNo, roleSpec } from "./fake.mjs";

// Nhóm quản trị của app web mới: các route /admin/... nằm CÙNG app (không còn zone riêng, không basePath), gọi thẳng /api/**.
// Mock: e2e/mock/admin.mjs (ghi) + e2e/mock/common.mjs (GET người dùng/hồ sơ độc giả). Dữ liệu dùng chung giữa 2 worker nên mỗi test
// tạo dữ liệu riêng (fake.mjs) và không giả định số lượng bản ghi.

const SEED_USER = "a0000000-0000-4000-8000-000000000001"; // Lê Văn Hùng, thẻ SV21-04817 còn hạn
const SEED_EXPIRED = "a0000000-0000-4000-8000-000000000002"; // Phạm Thị Hương, thẻ GV-0342 hết hạn

const main = (page: Page) => page.getByRole("main");
const popover = (page: Page) => page.locator(".ant-popover");

/**
 * Đợi FormModal "ổn định" sau khi mở. Sau hoạt ảnh mở, afterOpenChange gọi form.resetFields(): rc-field-form gắn key mới
 * nên MỌI ô được dựng lại (phần tử DOM mới) và giá trị đã gõ trước đó bị xóa. Đánh dấu ô đầu tiên rồi đợi nó bị thay mới.
 * Gọi ngay sau khi bấm nút mở, trước mọi thao tác fill. (Không dùng toBeFocused: autofocus của FormModal bị mất vì ô bị dựng lại.)
 */
async function dialogSettled(page: Page) {
  // Đợi hộp thoại hiện xong hoạt ảnh mở (antd gắn lớp ant-zoom-* trong lúc mở) rồi mới thao tác; ô đầu đã sẵn sàng.
  // Modal form có thể lồng trong modal chi tiết (không có ô nhập): lấy modal trên cùng (cuối DOM).
  const top = page.locator(".ant-modal").last();
  await top.locator("input:not([type=hidden]), textarea").first().waitFor();
  await expect(top).not.toHaveClass(/ant-zoom/);
}

/** Tạo người dùng qua API (như SPA gọi) rồi trả về bản ghi. */
async function createUser(page: Page) {
  const p = person();
  const t = await loginApi(page.request, "admin");
  const res = await page.request.post("/api/users", {
    headers: bearer(t),
    data: { username: p.username, fullName: p.fullName, email: p.email },
  });
  expect(res.status()).toBe(201);
  return { ...p, ...((await res.json()) as { id: string }) };
}

test.describe("admin: phân quyền và lối vào", () => {
  test("quản trị viên (admin=true, không có permission nào) thấy danh sách vai trò", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "MEMBER" })).toBeVisible();
  });

  test("người có khóa AccessControlController/listRoles thấy danh sách vai trò", async ({ page }) => {
    await gotoAs(page, "staff", "/admin/roles");
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
  });

  test("sidebar admin có đủ 4 mục, href đúng /admin/... (không nhân đôi tiền tố)", async ({ page }) => {
    await gotoAs(page, "admin", "/admin");
    const nav = sidebar(page);
    for (const [name, href] of [
      ["Người dùng", "/admin/users"],
      ["Vai trò và quyền", "/admin/roles"],
      ["Phòng ban", "/admin/departments"],
      ["Nhật ký hoạt động", "/admin/audit-logs"],
    ]) {
      await expect(nav.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  test("staff (chỉ có listRoles): sidebar chỉ có Vai trò và quyền; không có nút thêm; trang khác báo thiếu quyền", async ({ page }) => {
    await gotoAs(page, "staff", "/admin/roles");
    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: "Vai trò và quyền" })).toBeVisible();
    for (const name of ["Người dùng", "Phòng ban", "Nhật ký hoạt động"]) {
      await expect(nav.getByRole("link", { name })).toHaveCount(0);
    }
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm vai trò" })).toHaveCount(0);

    for (const path of ["/admin/users", "/admin/departments", "/admin/audit-logs"]) {
      await gotoApp(page, path);
      await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    }
  });

  test("staff bấm một vai trò: thiếu khóa getRole nên báo thiếu quyền ở trang chi tiết", async ({ page }) => {
    await gotoAs(page, "staff", "/admin/roles");
    await page.getByRole("link", { name: "CATALOGER" }).click();
    await expect(page).toHaveURL(/\/admin\/roles\/3$/);
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(page.getByText("«Chi tiết vai trò»")).toBeVisible();
  });

  test("thủ thư (có USER_SEARCH): xem danh sách người dùng, không có nút thêm; chi tiết báo thiếu quyền", async ({ page }) => {
    await gotoAs(page, "librarian", "/admin/users");
    await expect(page.getByRole("link", { name: "Lê Văn Hùng" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm người dùng" })).toHaveCount(0);

    await gotoApp(page, `/admin/users/${SEED_USER}`);
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("người không có khóa nào: mọi trang quản trị báo thiếu quyền, sidebar không có mục Quản trị", async ({ page }) => {
    await gotoAs(page, "member", "/admin/users");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "Quản trị" })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toHaveCount(0);

    await gotoApp(page, "/admin/roles");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("thủ thư không gọi được API ghi hồ sơ độc giả (403) dù đọc được (200)", async ({ page }) => {
    const t = await loginApi(page.request, "librarian");
    const res = await page.request.get(`/api/users/${SEED_USER}/reader-profile`, { headers: bearer(t) });
    expect(res.status()).toBe(200);
    const denied = await page.request.put(`/api/users/${SEED_USER}/reader-profile/status`, {
      headers: bearer(t),
      data: { status: "LOCKED" },
    });
    expect(denied.status()).toBe(403);
  });
});

test.describe("admin: trang tổng quan /admin", () => {
  test("quản trị viên thấy đủ 4 thẻ số liệu, 4 lối tắt, khối hoạt động và khối vai trò", async ({ page }) => {
    await gotoAs(page, "admin", "/admin");
    const m = main(page);
    await expect(m.getByRole("heading", { name: "Quản trị" })).toBeVisible();
    await expect(m.getByText("Vai trò của bạn: SUPER_ADMIN")).toBeVisible();

    // Thẻ số liệu: tiêu đề + một con số, cả thẻ là link tới trang tương ứng.
    for (const [title, href] of [
      ["Người dùng", "/admin/users"],
      ["Vai trò", "/admin/roles"],
      ["Phòng ban", "/admin/departments"],
      ["Sự kiện đã ghi", "/admin/audit-logs"],
    ]) {
      const card = m.locator(`a[href="${href}"]`).filter({ has: page.locator(".ant-statistic-title", { hasText: title }) });
      await expect(card).toHaveCount(1);
      await expect(card.locator(".ant-statistic-content-value")).toHaveText(/^\d+$/);
    }
    // Tổng sự kiện của mock cố định 45; ghi chú dưới thẻ vai trò và phòng ban.
    await expect(m.locator('a[href="/admin/audit-logs"] .ant-statistic-content-value')).toHaveText("45");
    await expect(m.getByText(/\d+ vai trò quản trị/)).toBeVisible();
    await expect(m.getByText(/\d+ đang dùng/)).toBeVisible();

    // Lối tắt (mô tả riêng của từng thẻ).
    for (const desc of [
      "Tạo, sửa, khóa tài khoản và thẻ độc giả.",
      "Gán quyền cho vai trò, gán vai trò cho người dùng.",
      "Cây phòng ban và trạng thái sử dụng.",
      "Tra cứu sự kiện nghiệp vụ theo đối tượng hoặc loại.",
    ]) {
      await expect(m.getByText(desc)).toBeVisible();
    }

    // Khối hoạt động gần đây: đúng 8 sự kiện mới nhất; khối vai trò liệt kê vai trò dạng link.
    await expect(m.getByText("Hoạt động gần đây")).toBeVisible();
    await expect(m.locator(".ant-table-wrapper").first().locator("tr.ant-table-row")).toHaveCount(8);
    await expect(m.getByRole("link", { name: "SUPER_ADMIN" })).toHaveAttribute("href", "/admin/roles/1");
  });

  test("bấm lối tắt, thẻ số liệu và vai trò đi đúng trang", async ({ page }) => {
    await gotoAs(page, "admin", "/admin");
    await main(page).getByRole("link", { name: /Tạo, sửa, khóa tài khoản/ }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await page.goBack();
    await expect(main(page).getByRole("heading", { name: "Quản trị" })).toBeVisible();
    await main(page).locator('a[href="/admin/departments"]').first().click();
    await expect(page).toHaveURL(/\/admin\/departments$/);

    await page.goBack();
    await main(page).getByRole("link", { name: "SUPER_ADMIN" }).click();
    await expect(page).toHaveURL(/\/admin\/roles\/1$/);
  });

  test("staff (chỉ có listRoles): chỉ thấy thẻ và lối tắt của Vai trò, không có khối nhật ký", async ({ page }) => {
    await gotoAs(page, "staff", "/admin");
    const m = main(page);
    await expect(m.getByText("Vai trò của bạn: LIBRARIAN")).toBeVisible();
    await expect(m.locator('a[href="/admin/roles"]')).not.toHaveCount(0);
    await expect(m.getByText("Gán quyền cho vai trò, gán vai trò cho người dùng.")).toBeVisible();
    for (const href of ["/admin/users", "/admin/departments", "/admin/audit-logs"]) {
      await expect(m.locator(`a[href="${href}"]`)).toHaveCount(0);
    }
    await expect(m.getByText("Hoạt động gần đây")).toHaveCount(0);
    await expect(m.getByText("Sự kiện đã ghi")).toHaveCount(0);
    await expect(m.getByText(/Cần quyền/)).toHaveCount(0);
  });

  test("thủ thư (chỉ USER_SEARCH): chỉ có thẻ Người dùng, không có khối vai trò", async ({ page }) => {
    await gotoAs(page, "librarian", "/admin");
    const m = main(page);
    await expect(m.locator('a[href="/admin/users"]')).not.toHaveCount(0);
    await expect(m.locator('a[href="/admin/roles"]')).toHaveCount(0);
    await expect(m.getByText("Hoạt động gần đây")).toHaveCount(0);
  });

  test("người không có quyền quản trị nào thấy cảnh báo, không có thẻ hay lối tắt", async ({ page }) => {
    await gotoAs(page, "member", "/admin");
    const m = main(page);
    await expect(m.getByText("Cần quyền AccessControlController/listRoles (hoặc một quyền quản trị khác)")).toBeVisible();
    await expect(m.locator("a[href^='/admin/']")).toHaveCount(0);
    await expect(m.locator(".ant-statistic")).toHaveCount(0);
  });

  test("nhật ký lỗi 500: khối nhật ký báo lỗi riêng, các thẻ còn lại và danh sách vai trò vẫn hiện", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/audit-logs**", (route) => {
      calls++;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "INTERNAL", message: "Dịch vụ nhật ký đang bảo trì" }),
      });
    });
    await gotoAs(page, "admin", "/admin");
    const m = main(page);
    await expect(m.getByText("Dịch vụ nhật ký đang bảo trì")).toBeVisible();
    await expect(m.getByRole("button", { name: "Thử lại" })).toBeVisible();
    expect(calls).toBeGreaterThan(0);

    // Phần còn lại của trang không bị chặn.
    await expect(m.getByRole("heading", { name: "Quản trị" })).toBeVisible();
    await expect(m.locator(".ant-statistic-title", { hasText: "Người dùng" })).toBeVisible();
    await expect(m.getByRole("link", { name: "SUPER_ADMIN" })).toBeVisible();
    await expect(m.getByText("Tạo, sửa, khóa tài khoản và thẻ độc giả.")).toBeVisible();
  });

  test("nhật ký chậm: trang hiện ngay, khối nhật ký có khung chờ rồi mới ra dữ liệu", async ({ page }) => {
    await page.route("**/api/audit-logs**", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await gotoAs(page, "admin", "/admin");
    const m = main(page);
    await expect(m.getByRole("heading", { name: "Quản trị" })).toBeVisible();
    await expect(m.locator(".ant-skeleton")).toBeVisible();
    await expect(m.locator("tr.ant-table-row").first()).toBeVisible();
  });
});

test.describe("admin: người dùng", () => {
  test("danh sách hiện người dùng mẫu, phòng ban và trạng thái bằng chữ", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await expect(page.getByRole("link", { name: "Lê Văn Hùng" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "hung.le", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Khoa Công nghệ thông tin" }).first()).toBeVisible();
    await expect(page.getByText("Đang hoạt động").first()).toBeVisible();
  });

  test("tìm theo từ khóa đẩy lên URL (q) và lọc kết quả; không khớp thì có nút Xóa bộ lọc", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("searchbox").fill("huong");
    await expect(page).toHaveURL(/[?&]q=huong/);
    await expect(page.getByRole("link", { name: "Phạm Thị Hương" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lê Văn Hùng" })).toHaveCount(0);

    await page.getByRole("searchbox").fill("khong-ai-ten-nhu-vay");
    await expect(page.getByText("Không có người dùng khớp bộ lọc.")).toBeVisible();
    await page.getByRole("link", { name: "Xóa bộ lọc" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("searchbox")).toHaveValue("");
    await expect(page.getByRole("link", { name: "Lê Văn Hùng" }).first()).toBeVisible();
  });

  test("bộ lọc trạng thái gửi status lên BE, ghi vào URL và chỉ còn người dùng khớp", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    const req = page.waitForRequest((r) => r.url().includes("/api/users?") && r.url().includes("status=DISABLED"));
    await page.getByRole("combobox", { name: "Lọc theo trạng thái" }).click();
    await page.locator('.ant-select-item-option[title="Đã vô hiệu"]').click();
    await req;
    await expect(page).toHaveURL(/[?&]status=DISABLED/);
    await expect(page.getByRole("link", { name: "Đỗ Văn Khóa" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lê Văn Hùng" })).toHaveCount(0);
  });

  test("phân trang server: page trên URL tính từ 1, BE nhận page-1 và size=20", async ({ page }) => {
    // Lọc theo từ khóa để chỉ còn 45 người dùng seed hàng loạt (test khác tạo/sửa người dùng không ảnh hưởng).
    const requested: string[] = [];
    page.on("request", (r) => r.url().includes("/api/users?") && requested.push(r.url()));
    await gotoAs(page, "admin", "/admin/users?q=nguoidung");
    await expect(page.getByText("Hiển thị 1–20 trên tổng 45")).toBeVisible();
    await expect(page.getByRole("link", { name: /Người dùng thử số 1$/ })).toBeVisible();
    expect(requested.some((u) => /[?&]page=0\b/.test(u) && /[?&]size=20\b/.test(u))).toBe(true);

    await page.getByRole("listitem", { name: "3", exact: true }).click();
    await expect(page).toHaveURL(/[?&]page=3/);
    await expect(page.getByText("Hiển thị 41–45 trên tổng 45")).toBeVisible();
    await expect(page.getByRole("link", { name: /Người dùng thử số 45$/ })).toBeVisible();
    expect(requested.some((u) => /[?&]page=2\b/.test(u))).toBe(true);

    // page sai (không phải số) thì về trang 1.
    await gotoApp(page, "/admin/users?q=nguoidung&page=abc");
    await expect(page.getByText("Hiển thị 1–20 trên tổng 45")).toBeVisible();
  });

  test("tạo người dùng kèm mật khẩu rồi chuyển sang trang chi tiết", async ({ page }) => {
    const p = person();
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByLabel("Tên đăng nhập").fill(p.username);
    await dlg.getByLabel("Họ tên").fill(p.fullName);
    await dlg.getByLabel("Email").fill(p.email);
    await dlg.getByLabel("Mật khẩu tạm").fill("ThuVien@2026");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("dialog").getByRole("heading", { name: p.fullName })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(`${p.username} · ${p.email}`)).toBeVisible();
  });

  test("form tạo người dùng báo lỗi bắt buộc, email sai định dạng và mật khẩu ngắn ngay dưới ô", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Nhập tên đăng nhập")).toBeVisible();
    await expect(dlg.getByText("Nhập họ tên")).toBeVisible();
    await expect(dlg.getByText("Nhập email")).toBeVisible();
    await expect(dlg.getByText("Nhập mật khẩu")).toBeVisible();

    await dlg.getByLabel("Email").fill("khong-phai-email");
    await dlg.getByLabel("Mật khẩu tạm").fill("ngan");
    await expect(dlg.getByText("Email chưa đúng định dạng")).toBeVisible();
    await expect(dlg.getByText("Từ 8 đến 72 ký tự")).toBeVisible();
  });

  test("tạo người dùng trùng tên đăng nhập: lỗi của BE hiện trong hộp thoại và giữ dữ liệu đã nhập", async ({ page }) => {
    const p = person();
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByLabel("Tên đăng nhập").fill("hung.le");
    await dlg.getByLabel("Họ tên").fill(p.fullName);
    await dlg.getByLabel("Email").fill(p.email);
    await dlg.getByLabel("Mật khẩu tạm").fill("ThuVien@2026");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Tên đăng nhập đã tồn tại")).toBeVisible();
    await expect(dlg.getByLabel("Họ tên")).toHaveValue(p.fullName);
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test("trang chi tiết hiện thông tin; bấm Sửa thì ô đã có sẵn giá trị hiện tại", async ({ page }) => {
    await gotoAs(page, "admin", `/admin/users/${SEED_USER}`);
    const detail = page.getByRole("dialog").first();
    await expect(detail.getByRole("heading", { name: "Lê Văn Hùng" })).toBeVisible();
    await expect(detail.getByText("hung.le · hung.le@gmail.com")).toBeVisible();
    // Trong modal không có breadcrumb, danh sách người dùng vẫn ở nền.
    await expect(detail.getByRole("navigation", { name: /breadcrumb/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Người dùng", exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin người dùng" });
    await dialogSettled(page);
    await expect(dlg.getByLabel("Họ tên")).toHaveValue("Lê Văn Hùng");
    await expect(dlg.getByLabel("Email")).toHaveValue("hung.le@gmail.com");
  });

  test("bấm Sửa, gõ dở rồi Hủy: mở lại thì ô về giá trị hiện tại, không giữ bản nháp", async ({ page }) => {
    await gotoAs(page, "admin", `/admin/users/${SEED_USER}`);
    const detail = page.getByRole("dialog").first();
    await detail.getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin người dùng" });
    await dialogSettled(page);
    await dlg.getByLabel("Họ tên").fill("Tên tạm sẽ bị hủy");
    await dlg.getByRole("button", { name: "Hủy" }).click();
    await expect(dlg).toBeHidden();
    await detail.getByRole("button", { name: "Sửa" }).click();
    await expect(page.getByRole("dialog", { name: "Sửa thông tin người dùng" }).getByLabel("Họ tên")).toHaveValue("Lê Văn Hùng");
  });

  test("mở hộp thoại tạo: ô đầu tiên được tự focus sau khi mở xong", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    await expect(page.getByRole("dialog").getByLabel("Tên đăng nhập")).toBeFocused();
  });

  test("sửa thông tin, vô hiệu hóa rồi kích hoạt lại", async ({ page }) => {
    await loginAs(page, "admin");
    const u = await createUser(page);
    const renamed = person().fullName;
    await gotoApp(page, `/admin/users/${u.id}`);

    const detail = page.getByRole("dialog").first();
    await detail.getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin người dùng" });
    await dialogSettled(page);
    await expect(dlg.getByLabel("Họ tên")).toHaveValue(u.fullName);
    await dlg.getByLabel("Họ tên").fill(renamed);
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(detail.getByRole("heading", { name: renamed })).toBeVisible();

    await detail.getByRole("button", { name: "Vô hiệu hóa" }).click();
    await popover(page).getByRole("button", { name: "Vô hiệu hóa" }).click();
    await expect(page.getByText("Đã vô hiệu").first()).toBeVisible();

    await detail.getByRole("button", { name: "Kích hoạt lại" }).click();
    await popover(page).getByRole("button", { name: "Kích hoạt lại" }).click();
    await expect(page.getByText("Đang hoạt động").first()).toBeVisible();
  });

  test("sửa người dùng với email sai: lỗi ngay dưới ô và hộp thoại không đóng", async ({ page }) => {
    await loginAs(page, "admin");
    const u = await createUser(page);
    await gotoApp(page, `/admin/users/${u.id}`);
    await page.getByRole("dialog").first().getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin người dùng" });
    await dialogSettled(page);
    await dlg.getByLabel("Email").fill("sai-dinh-dang");
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(dlg.getByText("Email chưa đúng định dạng")).toBeVisible();
    await expect(dlg).toBeVisible();
  });

  test("chi tiết trong modal: người dùng không tồn tại hiện 404 và nút Đóng về danh sách", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users/khong-ton-tai");
    const detail = page.getByRole("dialog");
    await expect(detail.getByText("Không tìm thấy người dùng")).toBeVisible();
    await detail.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("mở người dùng từ danh sách: hiện modal chi tiết, danh sách còn ở nền, đóng (X) về URL danh sách", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("link", { name: "Lê Văn Hùng" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/users/${SEED_USER}$`));
    const detail = page.getByRole("dialog");
    await expect(detail.getByRole("heading", { name: "Lê Văn Hùng" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Người dùng", exact: true })).toBeVisible();
    await detail.locator(".ant-modal-close").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test("danh sách người dùng lỗi 500: hiện lỗi và nút Thử lại tải lại được", async ({ page }) => {
    let broken = true;
    await page.route(/\/api\/users\?/, (route) =>
      broken
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL", message: "Máy chủ danh tính đang bận" }) })
        : route.fallback(),
    );
    await gotoAs(page, "admin", "/admin/users");
    await expect(page.getByText("Máy chủ danh tính đang bận")).toBeVisible();
    broken = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("link", { name: "Lê Văn Hùng" }).first()).toBeVisible();
  });

  test("thêm rồi gỡ vai trò cho người dùng", async ({ page }) => {
    await loginAs(page, "admin");
    const u = await createUser(page);
    await gotoApp(page, `/admin/users/${u.id}?tab=roles`);

    await expect(page.getByText("Thay đổi vai trò có hiệu lực khi người dùng đăng nhập lại.")).toBeVisible();
    await expect(page.getByText("Người dùng này chưa có vai trò nào.")).toBeVisible();
    await expect(page.getByText("Chưa có quyền nào.")).toBeVisible();

    await page.getByRole("tabpanel").locator(".ant-select").click();
    await page.locator('.ant-select-item-option[title="CATALOGER"]').click();
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const revoke = page.getByRole("button", { name: "Gỡ vai trò «CATALOGER»" });
    await expect(revoke).toBeVisible();
    // Quyền hiệu lực của vai trò vừa gán hiện ra (mock: CATALOGER có TitleController/search).
    await expect(page.getByText("TitleController/search")).toBeVisible();

    await revoke.click();
    await popover(page).getByRole("button", { name: "Gỡ vai trò" }).click();
    await expect(revoke).toHaveCount(0);
    await expect(page.getByText("Người dùng này chưa có vai trò nào.")).toBeVisible();
  });

  test("tab đang mở nằm trên URL (?tab=...) và đổi tab cập nhật URL", async ({ page }) => {
    await gotoAs(page, "admin", `/admin/users/${SEED_USER}?tab=reader`);
    await expect(page.getByRole("tab", { name: "Hồ sơ độc giả" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Vai trò và quyền" }).click();
    await expect(page).toHaveURL(/[?&]tab=roles/);
    await page.getByRole("tab", { name: "Thông tin" }).click();
    await expect(page).toHaveURL(/[?&]tab=info/);
  });

  test("hồ sơ độc giả có sẵn: hiện số thẻ, loại, hợp lệ; thẻ hết hạn báo không hợp lệ", async ({ page }) => {
    await gotoAs(page, "admin", `/admin/users/${SEED_USER}?tab=reader`);
    await expect(page.getByText("SV21-04817").first()).toBeVisible(); // số thẻ; mã SV trong mock trùng số thẻ
    await expect(page.getByText("Sinh viên", { exact: true })).toBeVisible();
    await expect(page.getByText("Hợp lệ", { exact: true })).toBeVisible();

    await gotoApp(page, `/admin/users/${SEED_EXPIRED}?tab=reader`);
    await expect(page.getByText("GV-0342")).toBeVisible();
    await expect(page.getByText("Giảng viên", { exact: true })).toBeVisible();
    await expect(page.getByText("Không hợp lệ: thẻ đã hết hạn")).toBeVisible();
  });

  test("cấp thẻ độc giả (ô đã có sẵn họ tên, email), khóa thẻ, mở khóa rồi gia hạn", async ({ page }) => {
    const card = readerCardNo();
    await loginAs(page, "admin");
    const u = await createUser(page);
    await gotoApp(page, `/admin/users/${u.id}?tab=reader`);

    await expect(page.getByText("Người này chưa có thẻ độc giả.")).toBeVisible();
    await page.getByRole("dialog").first().getByRole("button", { name: "Cấp thẻ độc giả" }).click();
    const dlg = page.getByRole("dialog", { name: "Cấp thẻ độc giả" });
    await dialogSettled(page);
    await expect(dlg.getByLabel("Họ tên trên thẻ")).toHaveValue(u.fullName);
    await expect(dlg.getByLabel("Email")).toHaveValue(u.email);

    // Bỏ trống rồi gửi: báo thiếu số thẻ, loại độc giả và hạn thẻ.
    await dlg.getByRole("button", { name: "Cấp thẻ" }).click();
    const err = (t: string) => dlg.locator(".ant-form-item-explain-error", { hasText: t });
    await expect(err("Nhập số thẻ")).toBeVisible();
    await expect(err("Chọn loại độc giả")).toBeVisible();
    await expect(err("Chọn hạn thẻ")).toBeVisible();

    await dlg.getByLabel("Số thẻ").fill(card);
    await dlg.locator(".ant-select").first().click(); // ô Loại độc giả đứng trước ô Giới tính
    await page.locator('.ant-select-item-option[title="Sinh viên"]').click();
    await dlg.getByLabel("Hạn thẻ").fill("30/06/2029");
    await dlg.getByLabel("Hạn thẻ").press("Enter");
    await dlg.getByRole("button", { name: "Cấp thẻ" }).click();

    await expect(page.getByText(card)).toBeVisible();
    await expect(page.getByText("Hợp lệ", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Khóa thẻ" }).click();
    await popover(page).getByRole("button", { name: "Khóa thẻ" }).click();
    await expect(page.getByText("Bị khóa", { exact: true })).toBeVisible();
    await expect(page.getByText("Không hợp lệ: thẻ bị khóa")).toBeVisible();

    await page.getByRole("button", { name: "Mở khóa thẻ" }).click();
    await popover(page).getByRole("button", { name: "Mở khóa" }).click();
    await expect(page.getByText("Hợp lệ", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Gia hạn thẻ" }).click();
    const renew = page.getByRole("dialog", { name: "Gia hạn thẻ" });
    await dialogSettled(page);
    await renew.getByLabel("Ngày hết hạn mới").fill("30/06/2031");
    await renew.getByLabel("Ngày hết hạn mới").press("Enter");
    // Enter trong ô ngày chốt giá trị và đôi khi gửi luôn form; còn mở thì bấm Gia hạn.
    await expect(async () => {
      if (await renew.isVisible()) await renew.getByRole("button", { name: "Gia hạn", exact: true }).click({ timeout: 2000 });
      await expect(renew).toBeHidden({ timeout: 3000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("30/06/2031")).toBeVisible();
  });
});

test.describe("admin: thông tin cá nhân", () => {
  test("chi tiết người dùng hiện SĐT, ngày sinh dd/MM/yyyy, giới tính, địa chỉ; chỉ hiện field có giá trị", async ({ page }) => {
    await gotoAs(page, "admin", `/admin/users/${SEED_USER}`);
    const detail = page.getByRole("dialog").first();
    await expect(detail.getByText("0912 345 678")).toBeVisible();
    await expect(detail.getByText("14/05/2003")).toBeVisible();
    await expect(detail.getByText("Nam", { exact: true })).toBeVisible();
    await expect(detail.getByText("12 Nguyễn Trãi, Thanh Xuân, Hà Nội")).toBeVisible();
    // Chức danh và mã cán bộ để null: không có dòng nào.
    await expect(detail.getByText("Chức danh", { exact: true })).toHaveCount(0);
    await expect(detail.getByText("Mã cán bộ", { exact: true })).toHaveCount(0);
  });

  test("danh sách người dùng có cột Điện thoại và avatar chữ cái đầu khi chưa có ảnh", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users?q=hung.le");
    const row = page.getByRole("row", { name: /Lê Văn Hùng/ });
    await expect(row.getByText("0912 345 678")).toBeVisible();
    await expect(row.locator(".ant-avatar", { hasText: "L" })).toBeVisible();
  });

  test("tạo người dùng kèm thông tin cá nhân: gửi đủ trường lên BE và hiện ở chi tiết", async ({ page }) => {
    const p = person();
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByLabel("Tên đăng nhập").fill(p.username);
    await dlg.getByLabel("Họ tên").fill(p.fullName);
    await dlg.getByLabel("Email").fill(p.email);
    await dlg.getByLabel("Số điện thoại").fill("0903 111 222");
    await dlg.getByLabel("Địa chỉ").fill("5 Hai Bà Trưng, Đà Nẵng");
    await dlg.getByLabel("Chức danh").fill("Thủ thư");
    await dlg.getByLabel("Mã cán bộ").fill("CB-777");
    await dlg.getByLabel("Mật khẩu tạm").fill("ThuVien@2026");
    const req = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/users");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    const body = (await req).postDataJSON();
    expect(body).toMatchObject({ phone: "0903 111 222", address: "5 Hai Bà Trưng, Đà Nẵng", jobTitle: "Thủ thư", employeeCode: "CB-777" });
    expect(body.avatarUrl).toBeUndefined();

    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/);
    const detail = page.getByRole("dialog");
    await expect(detail.getByText("0903 111 222")).toBeVisible();
    await expect(detail.getByText("CB-777")).toBeVisible();
  });

  test("form tạo báo lỗi SĐT sai ký tự và ảnh đại diện không phải http(s)", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByLabel("Số điện thoại").fill("abc123");
    await dlg.getByLabel("Ảnh đại diện (URL)").fill("ftp://x/y.png");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.locator(".ant-form-item-explain-error", { hasText: "Chỉ gồm số, +, - và khoảng trắng" })).toBeVisible();
    await expect(dlg.locator(".ant-form-item-explain-error", { hasText: "http:// hoặc https://" })).toBeVisible();
  });

  test("sửa người dùng: ô có sẵn giá trị cá nhân, lưu SĐT mới; để trống địa chỉ thì BE giữ nguyên", async ({ page }) => {
    await loginAs(page, "admin");
    const u = await createUser(page);
    const t = await loginApi(page.request, "admin");
    await page.request.put(`/api/users/${u.id}`, {
      headers: bearer(t),
      data: { fullName: u.fullName, email: u.email, phone: "0905 000 111", address: "Huế" },
    });
    await gotoApp(page, `/admin/users/${u.id}`);
    const detail = page.getByRole("dialog").first();
    await detail.getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog", { name: "Sửa thông tin người dùng" });
    await dialogSettled(page);
    await expect(dlg.getByLabel("Số điện thoại")).toHaveValue("0905 000 111");
    await expect(dlg.getByLabel("Địa chỉ")).toHaveValue("Huế");
    await dlg.getByLabel("Số điện thoại").fill("0905 999 888");
    await dlg.getByLabel("Địa chỉ").fill("");
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã cập nhật thông tin.")).toBeVisible();
    await expect(detail.getByText("0905 999 888")).toBeVisible();
    await expect(detail.getByText("Huế")).toBeVisible();
  });

  test("hồ sơ độc giả hiện khoa, lớp, mã SV, ngày cấp thẻ và thông tin cá nhân", async ({ page }) => {
    await gotoAs(page, "admin", `/admin/users/${SEED_USER}?tab=reader`);
    const panel = page.getByRole("dialog").first();
    await expect(panel.getByText("Khoa Công nghệ thông tin")).toBeVisible();
    await expect(panel.getByText("K21-CNTT2")).toBeVisible();
    await expect(panel.getByText("SV21-04817").first()).toBeVisible();
    await expect(panel.getByText("01/09/2021")).toBeVisible();
    await expect(panel.getByText("14/05/2003")).toBeVisible();
  });

  test("cấp thẻ kèm thông tin cá nhân (ngày cấp sau hạn thẻ bị chặn) rồi sửa hồ sơ bằng PUT mới", async ({ page }) => {
    const card = readerCardNo();
    await loginAs(page, "admin");
    const u = await createUser(page);
    await gotoApp(page, `/admin/users/${u.id}?tab=reader`);
    await page.getByRole("dialog").first().getByRole("button", { name: "Cấp thẻ độc giả" }).click();
    const dlg = page.getByRole("dialog", { name: "Cấp thẻ độc giả" });
    await dialogSettled(page);
    await dlg.getByLabel("Số thẻ").fill(card);
    await dlg.locator(".ant-select").first().click();
    await page.locator('.ant-select-item-option[title="Sinh viên"]').click();
    await dlg.getByLabel("Hạn thẻ").fill("30/06/2029");
    await dlg.getByLabel("Hạn thẻ").press("Enter");
    await dlg.getByLabel("Khoa / đơn vị").fill("Khoa Toán");
    await dlg.getByLabel("Lớp / ngành").fill("K22-TOAN");
    await dlg.getByLabel("Ngày cấp thẻ").fill("01/01/2030");
    await dlg.getByLabel("Ngày cấp thẻ").press("Enter");
    await dlg.getByRole("button", { name: "Cấp thẻ" }).click();
    await expect(dlg.locator(".ant-form-item-explain-error", { hasText: "Ngày cấp không được sau hạn thẻ" })).toBeVisible();
    await dlg.getByLabel("Ngày cấp thẻ").fill("01/09/2025");
    await dlg.getByLabel("Ngày cấp thẻ").press("Enter");
    await expect(async () => {
      if (await dlg.isVisible()) await dlg.getByRole("button", { name: "Cấp thẻ" }).click({ timeout: 2000 });
      await expect(dlg).toBeHidden({ timeout: 3000 });
    }).toPass({ timeout: 20_000 });
    const panel = page.getByRole("dialog").first();
    await expect(panel.getByText("Khoa Toán")).toBeVisible();
    await expect(panel.getByText("01/09/2025")).toBeVisible();

    await panel.getByRole("button", { name: "Sửa hồ sơ" }).click();
    const edit = page.getByRole("dialog", { name: "Sửa hồ sơ độc giả" });
    await dialogSettled(page);
    await expect(edit.getByLabel("Khoa / đơn vị")).toHaveValue("Khoa Toán");
    await expect(edit.getByText(/giữ nguyên giá trị hiện có/)).toBeVisible();
    await edit.getByLabel("Khoa / đơn vị").fill("Khoa Vật lý");
    const req = page.waitForRequest((r) => r.method() === "PUT" && r.url().endsWith(`/api/users/${u.id}/reader-profile`));
    await edit.getByRole("button", { name: "Lưu" }).click();
    expect((await req).postDataJSON()).toMatchObject({ faculty: "Khoa Vật lý", className: "K22-TOAN" });
    await expect(page.getByText("Đã cập nhật hồ sơ độc giả.")).toBeVisible();
    await expect(panel.getByText("Khoa Vật lý")).toBeVisible();
  });
});

test.describe("admin: vai trò và quyền", () => {
  test("danh sách hiện mô tả, loại vai trò và số quyền", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    const row = (name: string) => page.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) });
    await expect(row("SUPER_ADMIN")).toContainText("Quản trị toàn hệ thống");
    await expect(row("SUPER_ADMIN")).toContainText("Quản trị viên");
    await expect(row("SUPER_ADMIN")).toContainText("Toàn quyền");
    await expect(row("MEMBER")).toContainText("Thường");
  });

  test("tạo vai trò, gán một rồi nhiều quyền (chọn giữ nguyên khi đổi bộ lọc), gỡ một quyền", async ({ page }) => {
    const role = roleSpec();
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByLabel("Tên vai trò").fill(role.name);
    await dlg.getByLabel("Mô tả").fill(role.description);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/roles\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("dialog").getByRole("heading", { name: role.name })).toBeVisible();
    await expect(page.getByText("Vai trò này chưa có quyền nào.")).toBeVisible();
    await expect(page.getByText("Quyền đã gán (0)")).toBeVisible();

    await page.getByLabel("Lọc danh mục quyền").fill("ReportController");
    await page.getByRole("checkbox", { name: /ReportController\/exportAll/ }).check();
    await page.getByLabel("Lọc danh mục quyền").fill("BookCopyController");
    await page.getByRole("checkbox", { name: /BookCopyController\/add/ }).check();
    await page.getByRole("button", { name: "Gán 2 quyền đã chọn" }).click();

    await expect(page.getByText("Quyền đã gán (2)")).toBeVisible();
    const revoke = page.getByRole("button", { name: "Gỡ quyền ReportController/exportAll" });
    await expect(revoke).toBeVisible();
    await expect(page.getByRole("button", { name: "Gỡ quyền BookCopyController/add" })).toBeVisible();

    // Lọc ô quyền đã gán.
    await page.getByLabel("Lọc quyền đã gán").fill("Report");
    await expect(page.getByRole("button", { name: "Gỡ quyền BookCopyController/add" })).toHaveCount(0);
    await page.getByLabel("Lọc quyền đã gán").fill("");

    await revoke.click();
    await popover(page).getByRole("button", { name: "Gỡ quyền", exact: true }).click();
    await expect(revoke).toHaveCount(0);
    await expect(page.getByText("Quyền đã gán (1)")).toBeVisible();
  });

  test("tạo vai trò: bỏ trống thì báo bắt buộc; trùng tên hiện lỗi của BE trong hộp thoại", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Nhập tên vai trò")).toBeVisible();
    await expect(dlg.getByText("Nhập mô tả")).toBeVisible();

    await dlg.getByLabel("Tên vai trò").fill("CATALOGER");
    await dlg.getByLabel("Mô tả").fill("Biên mục viên, trùng tên vai trò đã có");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Vai trò đã tồn tại")).toBeVisible();
  });

  test("quản trị viên tạo vai trò quản trị viên: phải xác nhận lần hai, rồi trang chi tiết không có bảng gán quyền", async ({ page }) => {
    const role = roleSpec();
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm vai trò" });
    await dialogSettled(page);
    await dlg.getByLabel("Tên vai trò").fill(role.name);
    await dlg.getByLabel("Mô tả").fill(role.description);
    await dlg.getByRole("switch").click();
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();

    const confirm = page.getByRole("dialog", { name: "Tạo vai trò quản trị viên?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Tạo vai trò quản trị viên" }).click();

    await expect(page).toHaveURL(/\/admin\/roles\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Đây là vai trò quản trị viên: có toàn quyền")).toBeVisible();
  });

  test("hủy ở bước xác nhận vai trò quản trị viên thì không tạo vai trò, hộp thoại còn mở", async ({ page }) => {
    const role = roleSpec();
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm vai trò" });
    await dialogSettled(page);
    await dlg.getByLabel("Tên vai trò").fill(role.name);
    await dlg.getByLabel("Mô tả").fill(role.description);
    await dlg.getByRole("switch").click();
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await page.getByRole("dialog", { name: "Tạo vai trò quản trị viên?" }).getByRole("button", { name: "Không" }).click();
    await expect(page.getByRole("dialog", { name: "Tạo vai trò quản trị viên?" })).toHaveCount(0);
    await expect(dlg).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/roles$/);
    await expect(dlg.getByLabel("Tên vai trò")).toHaveValue(role.name);
    await dlg.getByRole("button", { name: "Hủy" }).click();
    await expect(page.getByRole("cell", { name: role.name })).toHaveCount(0);
  });

  test("hủy ở bước xác nhận vai trò quản trị viên: hộp thoại hiện câu 'Đã hủy tạo vai trò quản trị viên.'", async ({ page }) => {
    const role = roleSpec();
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm vai trò" });
    await dialogSettled(page);
    await dlg.getByLabel("Tên vai trò").fill(role.name);
    await dlg.getByLabel("Mô tả").fill(role.description);
    await dlg.getByRole("switch").click();
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await page.getByRole("dialog", { name: "Tạo vai trò quản trị viên?" }).getByRole("button", { name: "Không" }).click();
    await expect(dlg.getByText("Đã hủy tạo vai trò quản trị viên.")).toBeVisible();
  });

  test("vai trò quản trị viên không có bảng gán quyền", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles/1");
    await expect(page.getByText("Đây là vai trò quản trị viên: có toàn quyền")).toBeVisible();
    await expect(page.getByText("Danh mục quyền")).toHaveCount(0);
  });

  test("vai trò không tồn tại hiện 404 trong modal và nút Đóng về danh sách", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles/khong-co");
    const detail = page.getByRole("dialog");
    await expect(detail.getByText("Không tìm thấy vai trò", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Đóng", exact: true }).last().click();
    await expect(page).toHaveURL(/\/admin\/roles$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("mở vai trò từ danh sách: hiện modal chi tiết, danh sách còn ở nền, đóng (X) về URL danh sách", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("link", { name: "CATALOGER", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/roles\/[^/]+$/);
    const detail = page.getByRole("dialog");
    await expect(detail.getByRole("heading", { name: "CATALOGER" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vai trò và quyền", exact: true })).toBeVisible();
    await detail.locator(".ant-modal-close").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/roles$/);
  });

  test("thêm khóa quyền thủ công rồi thấy nó trong danh mục", async ({ page }) => {
    const key = `KhoController/${person().username.replace(".", "")}`;
    await gotoAs(page, "admin", "/admin/roles/2");
    await page.getByRole("button", { name: "Thêm khóa quyền thủ công" }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm khóa quyền thủ công" });
    await dialogSettled(page);
    await dlg.getByRole("button", { name: "Thêm", exact: true }).click();
    await expect(dlg.getByText("Nhập khóa quyền")).toBeVisible();
    await dlg.getByLabel("Khóa quyền").fill(key);
    await dlg.getByLabel("Mô tả").fill("Khóa thêm tay để thử");
    await dlg.getByRole("button", { name: "Thêm", exact: true }).click();
    await expect(dlg).toBeHidden();

    await page.getByLabel("Lọc danh mục quyền").fill(key);
    await expect(page.getByRole("checkbox", { name: new RegExp(key.replace("/", "\\/")) })).toBeVisible();
  });
});

test.describe("admin: phòng ban", () => {
  test("hiện cây (ẩn phòng ban ngừng dùng), tạo phòng ban gốc rồi ngừng dùng", async ({ page }) => {
    const dept = departmentSpec();
    await gotoAs(page, "admin", "/admin/departments");
    await expect(page.getByText("Khoa Công nghệ thông tin")).toBeVisible();
    await expect(page.getByText("Bộ môn Hệ thống thông tin")).toBeVisible();
    await expect(page.getByText("Khoa Ngoại ngữ")).toHaveCount(0);

    await page.getByRole("button", { name: /Thêm phòng ban$/ }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByLabel("Mã", { exact: true }).fill(dept.code);
    await dlg.getByLabel("Tên", { exact: true }).fill(dept.name);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(page.getByText(dept.name)).toBeVisible();

    await page.locator(".ant-tree-treenode").filter({ hasText: `${dept.name}` }).getByRole("button", { name: "Ngừng dùng", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ngừng dùng" }).click();
    await expect(page.getByText(dept.name)).toHaveCount(0);
  });

  test("công tắc hiện cả phòng ban ngừng dùng (inactive=1), rồi dùng lại một phòng ban", async ({ page }) => {
    const dept = departmentSpec();
    await gotoAs(page, "admin", "/admin/departments");
    await page.getByRole("button", { name: /Thêm phòng ban$/ }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByLabel("Mã", { exact: true }).fill(dept.code);
    await dlg.getByLabel("Tên", { exact: true }).fill(dept.name);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await page.locator(".ant-tree-treenode").filter({ hasText: `${dept.name}` }).getByRole("button", { name: "Ngừng dùng", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ngừng dùng" }).click();
    await expect(page.getByText(dept.name)).toHaveCount(0);

    await page.getByRole("switch", { name: "Hiện cả phòng ban ngừng dùng" }).click();
    await expect(page).toHaveURL(/[?&]inactive=1/);
    await expect(page.getByText("Khoa Ngoại ngữ")).toBeVisible();
    await expect(page.getByText(dept.name)).toBeVisible();

    await page.locator(".ant-tree-treenode").filter({ hasText: `${dept.name}` }).getByRole("button", { name: "Dùng lại", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Dùng lại" }).click();
    await expect(page.getByText("Đã dùng lại phòng ban.")).toBeVisible();
  });

  test("thêm phòng ban con từ menu: ô phòng ban cha đã chọn sẵn; sửa tên thì ô có sẵn giá trị", async ({ page }) => {
    const dept = departmentSpec();
    const renamed = departmentSpec();
    await gotoAs(page, "admin", "/admin/departments");

    await page.locator(".ant-tree-treenode").filter({ hasText: "Khoa Công nghệ thông tin" }).getByRole("button", { name: "Thêm phòng ban con", exact: true }).click();
    const dlg = page.getByRole("dialog", { name: "Thêm phòng ban" });
    await dialogSettled(page);
    await expect(dlg.locator(".ant-form-item").filter({ hasText: "Phòng ban cha" })).toContainText("Khoa Công nghệ thông tin");
    await dlg.getByLabel("Mã", { exact: true }).fill(dept.code);
    await dlg.getByLabel("Tên", { exact: true }).fill(dept.name);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(page.getByText(dept.name)).toBeVisible();

    await page.locator(".ant-tree-treenode").filter({ hasText: `${dept.name}` }).getByRole("button", { name: "Sửa", exact: true }).click();
    const edit = page.getByRole("dialog", { name: `Sửa phòng ban «${dept.name}»` });
    await dialogSettled(page);
    await expect(edit.getByLabel("Tên", { exact: true })).toHaveValue(dept.name);
    await expect(edit.getByText(dept.code)).toBeVisible();
    await expect(edit.locator(".ant-form-item").filter({ hasText: "Phòng ban cha" })).toContainText("Khoa Công nghệ thông tin");
    await edit.getByLabel("Tên", { exact: true }).fill(renamed.name);
    await edit.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(renamed.name)).toBeVisible();
    await expect(page.getByText(dept.name, { exact: true })).toHaveCount(0);
  });

  test("tạo phòng ban: bỏ trống báo bắt buộc; trùng mã hiện lỗi của BE", async ({ page }) => {
    const dept = departmentSpec();
    await gotoAs(page, "admin", "/admin/departments");
    await page.getByRole("button", { name: /Thêm phòng ban$/ }).click();
    const dlg = page.getByRole("dialog");
    await dialogSettled(page);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Nhập mã phòng ban")).toBeVisible();
    await expect(dlg.getByText("Nhập tên phòng ban")).toBeVisible();

    await dlg.getByLabel("Mã", { exact: true }).fill("KHOA-CNTT");
    await dlg.getByLabel("Tên", { exact: true }).fill(dept.name);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Mã phòng ban đã tồn tại")).toBeVisible();
  });

  test("Thu gọn và Mở rộng tất cả điều khiển cây", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/departments");
    await expect(page.getByText("Bộ môn Hệ thống thông tin")).toBeVisible();
    await page.getByRole("button", { name: "Thu gọn", exact: true }).click();
    await expect(page.getByText("Bộ môn Hệ thống thông tin")).toBeHidden();
    await page.getByRole("button", { name: "Mở rộng tất cả" }).click();
    await expect(page.getByText("Bộ môn Hệ thống thông tin")).toBeVisible();
  });
});

test.describe("admin: nhật ký hoạt động", () => {
  test("phân trang theo query page (từ 1) và mở rộng hàng để xem payload JSON", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/audit-logs");
    await expect(page.getByText("Hiển thị 1–20 trên tổng 45")).toBeVisible();

    await page.locator(".ant-table-row-expand-icon").first().click();
    await expect(page.locator("pre").first()).toContainText('"seq": 45');

    await page.getByRole("listitem", { name: "2", exact: true }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByText("Hiển thị 21–40 trên tổng 45")).toBeVisible();

    await gotoApp(page, "/admin/audit-logs?page=3");
    await expect(page.getByText("Hiển thị 41–45 trên tổng 45")).toBeVisible();
  });

  test("lọc theo loại sự kiện qua form; không khớp thì báo rỗng do lọc; Xóa bộ lọc trả về đầy đủ", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/audit-logs");
    await page.getByLabel("Loại sự kiện").fill("UserCreated");
    await page.getByRole("button", { name: "Tìm", exact: true }).click();
    await expect(page).toHaveURL(/[?&]eventType=UserCreated/);
    await expect(page.getByText("UserCreated").first()).toBeVisible();
    await expect(page.getByText("BorrowingCreated")).toHaveCount(0);

    await page.getByLabel("Mã đối tượng").fill("khong-co");
    await page.getByRole("button", { name: "Tìm", exact: true }).click();
    await expect(page.getByText("Không có sự kiện nào khớp.")).toBeVisible();

    await page.getByRole("link", { name: "Xóa bộ lọc" }).click();
    await expect(page).toHaveURL(/\/admin\/audit-logs$/);
    await expect(page.getByLabel("Loại sự kiện")).toHaveValue("");
    await expect(page.getByText("Hiển thị 1–20 trên tổng 45")).toBeVisible();
  });

  test("lọc theo URL (eventType, aggregateId) điền sẵn vào ô tìm", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/audit-logs?eventType=UserCreated");
    await expect(page.getByLabel("Loại sự kiện")).toHaveValue("UserCreated");
    await gotoApp(page, "/admin/audit-logs?aggregateId=khong-co");
    await expect(page.getByLabel("Mã đối tượng")).toHaveValue("khong-co");
    await expect(page.getByText("Không có sự kiện nào khớp.")).toBeVisible();
  });

  test("nhật ký lỗi 500: hiện lỗi và Thử lại tải lại được", async ({ page }) => {
    let broken = true;
    await page.route(/\/api\/audit-logs\?/, (route) =>
      broken
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL", message: "Nhật ký tạm ngưng" }) })
        : route.fallback(),
    );
    await gotoAs(page, "admin", "/admin/audit-logs");
    await expect(page.getByText("Nhật ký tạm ngưng")).toBeVisible();
    broken = false;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByText("Hiển thị 1–20 trên tổng 45")).toBeVisible();
  });
});
