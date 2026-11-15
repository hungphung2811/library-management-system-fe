import { expect, test, type Page } from "@playwright/test";
import { SHELL, loginAs } from "./helpers";

// 3 test đầu chuyển nguyên văn từ authorization.spec.ts ở pha 0 (giữ nguyên).
// Phân quyền động của BE (ADR-0003): quản trị viên là claim admin=true (bỏ qua kiểm khóa),
// người khác cần khóa "Controller/method" trong claim permissions.
test.describe("zone admin: phân quyền theo BE động", () => {
  test("quản trị viên (admin=true, không có permission nào) vẫn thấy danh sách role", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");

    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "MEMBER" })).toBeVisible();
  });

  test("người có khóa AccessControlController/listRoles thấy danh sách role", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/admin");

    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
  });

  test("người không có khóa thấy cảnh báo, không có danh sách và không có link Quản trị", async ({ page }) => {
    await loginAs(page, "member");
    await page.goto("/admin");

    await expect(page.getByText("Cần quyền AccessControlController/listRoles")).toBeVisible();
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toHaveCount(0);
    await expect(page.getByRole("navigation").getByRole("button", { name: "Quản trị" })).toHaveCount(0);
  });
});

// ---- Các màn hình quản trị (pha 1). Mock: e2e/mock/admin.mjs; dữ liệu dùng chung nên mỗi test dùng tên riêng. ----
// CHƯA CHẠY: các test dưới đây viết bám mock và code, chưa được chạy với Playwright.

const uniq = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Mở trang và đợi hydrate xong (bấm nút khi React chưa hydrate thì không có tác dụng). */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Tạo người dùng qua BFF (cookie của page đã đăng nhập) để test không phụ thuộc form tạo. */
async function createUser(page: Page, sfx: string) {
  const res = await page.request.post(`${SHELL}/api/bff/users`, {
    data: { username: `e2e.${sfx}`, fullName: `Người Thử ${sfx}`, email: `e2e.${sfx}@example.test` },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; username: string; fullName: string };
}

const popover = (page: Page) => page.locator(".ant-popover");

test.describe("zone admin: lối vào và phân quyền hiển thị", () => {
  test("sidebar có đủ 4 mục quản trị, href không bị nhân đôi basePath (/admin/admin/...)", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");
    const nav = page.getByRole("navigation");
    for (const [name, href] of [["Người dùng", "/admin/users"], ["Vai trò và quyền", "/admin/roles"], ["Phòng ban", "/admin/departments"], ["Nhật ký hoạt động", "/admin/audit-logs"]]) {
      await expect(nav.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    // Không còn thanh mục riêng của zone
    await page.goto("/admin/users");
    await expect(page.getByRole("group", { name: "Các mục quản trị" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link", { name: "Vai trò và quyền" })).toHaveCount(0);
  });

  test("staff (chỉ có listRoles): thấy vai trò, không có nút thêm; trang người dùng báo thiếu quyền", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/admin/roles");
    await expect(page.getByRole("cell", { name: "SUPER_ADMIN" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm vai trò" })).toHaveCount(0);

    await page.goto("/admin/users");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await page.goto("/admin/audit-logs");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });

  test("thủ thư (có USER_SEARCH): xem danh sách người dùng nhưng không có nút thêm", async ({ page }) => {
    await loginAs(page, "librarian");
    await page.goto("/admin/users");
    await expect(page.getByRole("link", { name: "Lê Văn Một" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm người dùng" })).toHaveCount(0);
  });
});

test.describe("zone admin: người dùng", () => {
  test("danh sách hiện người dùng mẫu và trạng thái bằng chữ", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    await expect(page.getByRole("link", { name: "Lê Văn Một" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "doc.gia.mot" })).toBeVisible();
    await expect(page.getByText("Đang hoạt động").first()).toBeVisible();
  });

  test("tạo người dùng kèm mật khẩu rồi chuyển sang trang chi tiết", async ({ page }) => {
    const sfx = uniq();
    await loginAs(page, "admin");
    await open(page, "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Tên đăng nhập").fill(`tao.${sfx}`);
    await dlg.getByLabel("Họ tên").fill(`Tạo Mới ${sfx}`);
    await dlg.getByLabel("Email").fill(`tao.${sfx}@example.test`);
    await dlg.getByLabel("Mật khẩu tạm").fill("MatKhau@12345");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();

    await expect(page).toHaveURL(/localhost:\d+\/admin\/users\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: `Tạo Mới ${sfx}` })).toBeVisible();
  });

  test("form tạo người dùng báo lỗi bắt buộc ngay dưới ô", async ({ page }) => {
    await loginAs(page, "admin");
    await open(page, "/admin/users");
    await page.getByRole("button", { name: "Thêm người dùng" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Nhập tên đăng nhập")).toBeVisible();
    await expect(dlg.getByText("Nhập họ tên")).toBeVisible();
  });

  test("sửa thông tin, vô hiệu hóa rồi kích hoạt lại", async ({ page }) => {
    const sfx = uniq();
    await loginAs(page, "admin");
    const u = await createUser(page, sfx);
    await open(page, `/admin/users/${u.id}`);

    await page.getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Họ tên").fill(`Đã Sửa ${sfx}`);
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByRole("heading", { name: `Đã Sửa ${sfx}` })).toBeVisible();

    await page.getByRole("button", { name: "Vô hiệu hóa" }).click();
    await popover(page).getByRole("button", { name: "Vô hiệu hóa" }).click();
    await expect(page.getByText("Đã vô hiệu").first()).toBeVisible();

    await page.getByRole("button", { name: "Kích hoạt lại" }).click();
    await popover(page).getByRole("button", { name: "Kích hoạt lại" }).click();
    await expect(page.getByText("Đang hoạt động").first()).toBeVisible();
  });

  test("trang chi tiết: người dùng không tồn tại hiện 404", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users/khong-ton-tai");
    await expect(page.getByText("Không tìm thấy người dùng")).toBeVisible();
  });

  test("thêm rồi gỡ vai trò cho người dùng", async ({ page }) => {
    const sfx = uniq();
    await loginAs(page, "admin");
    const u = await createUser(page, sfx);
    await open(page, `/admin/users/${u.id}?tab=roles`);

    await expect(page.getByText("Thay đổi vai trò có hiệu lực khi người dùng đăng nhập lại.")).toBeVisible();
    await expect(page.getByText("Người dùng này chưa có vai trò nào.")).toBeVisible();

    await page.getByRole("tabpanel").locator(".ant-select").click();
    await page.locator('.ant-select-item-option[title="CATALOGER"]').click();
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const revoke = page.getByRole("button", { name: "Gỡ vai trò «CATALOGER»" });
    await expect(revoke).toBeVisible();

    await revoke.click();
    await popover(page).getByRole("button", { name: "Gỡ vai trò" }).click();
    await expect(revoke).toHaveCount(0);
  });

  test("cấp thẻ độc giả, khóa thẻ rồi mở khóa", async ({ page }) => {
    const sfx = uniq();
    await loginAs(page, "admin");
    const u = await createUser(page, sfx);
    await open(page, `/admin/users/${u.id}?tab=reader`);

    await expect(page.getByText("Người này chưa có thẻ độc giả.")).toBeVisible();
    const dlg = page.getByRole("dialog");
    // Máy tải nặng: lần bấm đầu có thể rơi vào lúc tab chưa hydrate xong nên thử lại đến khi hộp thoại mở.
    await expect(async () => {
      await page.getByRole("button", { name: "Cấp thẻ độc giả" }).click();
      await expect(dlg).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20_000 });
    await dlg.getByLabel("Số thẻ").fill(`RD-${sfx}`);
    await dlg.locator(".ant-select").click();
    await page.locator('.ant-select-item-option[title="Sinh viên"]').click();
    await dlg.getByLabel("Hạn thẻ").fill("31/12/2035");
    await dlg.getByLabel("Hạn thẻ").press("Enter");
    await dlg.getByRole("button", { name: "Cấp thẻ" }).click();

    await expect(page.getByText(`RD-${sfx}`)).toBeVisible();
    await expect(page.getByText("Hợp lệ", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Khóa thẻ" }).click();
    await popover(page).getByRole("button", { name: "Khóa thẻ" }).click();
    await expect(page.getByText("Bị khóa", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Mở khóa thẻ" }).click();
    await popover(page).getByRole("button", { name: "Mở khóa" }).click();
    await expect(page.getByText("Hợp lệ", { exact: true })).toBeVisible();
  });
});

test.describe("zone admin: vai trò và quyền", () => {
  test("tạo vai trò, gán rồi gỡ một quyền", async ({ page }) => {
    const sfx = uniq().toUpperCase();
    await loginAs(page, "admin");
    await open(page, "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Tên vai trò").fill(`VAITRO_${sfx}`);
    await dlg.getByLabel("Mô tả").fill("Vai trò thử nghiệm");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();

    await expect(page).toHaveURL(/localhost:\d+\/admin\/roles\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: `VAITRO_${sfx}` })).toBeVisible();
    await expect(page.getByText("Vai trò này chưa có quyền nào.")).toBeVisible();

    await page.getByLabel("Lọc danh mục quyền").fill("ReportController");
    await page.getByRole("checkbox", { name: /ReportController\/exportAll/ }).check();
    await page.getByRole("button", { name: "Gán 1 quyền đã chọn" }).click();

    const revoke = page.getByRole("button", { name: "Gỡ quyền ReportController/exportAll" });
    await expect(revoke).toBeVisible();
    await revoke.click();
    await popover(page).getByRole("button", { name: "Gỡ quyền", exact: true }).click();
    await expect(revoke).toHaveCount(0);
  });

  test("vai trò quản trị viên không có bảng gán quyền", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/roles/1");
    await expect(page.getByText("Đây là vai trò quản trị viên: có toàn quyền")).toBeVisible();
    await expect(page.getByText("Danh mục quyền")).toHaveCount(0);
  });

  test("tạo vai trò trùng tên hiện lỗi của BE trong hộp thoại", async ({ page }) => {
    await loginAs(page, "admin");
    await open(page, "/admin/roles");
    await page.getByRole("button", { name: "Thêm vai trò" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Tên vai trò").fill("CATALOGER");
    await dlg.getByLabel("Mô tả").fill("Trùng tên");
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg.getByText("Vai trò đã tồn tại")).toBeVisible();
  });
});

test.describe("zone admin: phòng ban", () => {
  test("hiện cây, tạo phòng ban gốc rồi ngừng dùng", async ({ page }) => {
    const sfx = uniq();
    const name = `Phòng thử ${sfx}`;
    await loginAs(page, "admin");
    await open(page, "/admin/departments");
    await expect(page.getByText("Khoa Công nghệ thông tin")).toBeVisible();
    await expect(page.getByText("Bộ môn Hệ thống thông tin")).toBeVisible();
    // Phòng ban ngừng dùng bị ẩn mặc định.
    await expect(page.getByText("Khoa Ngoại ngữ")).toHaveCount(0);

    await page.getByRole("button", { name: /Thêm phòng ban$/ }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Mã", { exact: true }).fill(`E2E-${sfx}`);
    await dlg.getByLabel("Tên", { exact: true }).fill(name);
    await dlg.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.getByRole("button", { name: `Thao tác với «${name}»` }).click();
    await page.getByRole("menuitem", { name: "Ngừng dùng" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ngừng dùng" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});

test.describe("zone admin: nhật ký hoạt động", () => {
  test("phân trang theo query page (từ 1) và mở rộng hàng để xem payload JSON", async ({ page }) => {
    await loginAs(page, "admin");
    await open(page, "/admin/audit-logs");
    await expect(page.getByText("Hiển thị 1–20 trên tổng 45")).toBeVisible();

    await page.locator(".ant-table-row-expand-icon").first().click();
    await expect(page.locator("pre").first()).toContainText('"seq": 45');

    await page.goto("/admin/audit-logs?page=3");
    await expect(page.getByText("Hiển thị 41–45 trên tổng 45")).toBeVisible();
  });

  test("lọc theo loại sự kiện; không khớp thì báo rỗng do lọc", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/audit-logs?eventType=UserCreated");
    await expect(page.getByText("UserCreated").first()).toBeVisible();
    await expect(page.getByText("BorrowingCreated")).toHaveCount(0);

    await page.goto("/admin/audit-logs?aggregateId=khong-co");
    await expect(page.getByText("Không có sự kiện nào khớp.")).toBeVisible();
  });
});
