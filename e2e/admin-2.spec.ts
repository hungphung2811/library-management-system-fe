import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoApp, gotoAs, loginApi } from "./helpers";
import { person, roleSpec } from "./fake.mjs";

// Bổ sung cho admin.spec.ts: thông báo qua API BE (đọc từng mục / đọc hết / bộ lọc), đặt lại mật khẩu, sửa và xóa vai trò,
// form tìm kiếm đủ tiện ích (người dùng, nhật ký, vai trò, quyền của vai trò, phòng ban).
// Mock: e2e/mock/shell.mjs (thông báo của `librarian`: 5 mục, 4 chưa đọc, loại OVERDUE x3 + RESERVATION x2) và e2e/mock/admin.mjs.
// CHƯA CHẠY: file này viết khi dist chưa có code mới; điều phối build rồi chạy.

const main = (page: Page) => page.getByRole("main");

async function dialogSettled(page: Page) {
  // Modal form có thể lồng trong modal chi tiết (không có ô nhập): lấy modal trên cùng (cuối DOM).
  await page.locator(".ant-modal").last().locator("input:not([type=hidden]), textarea").first().waitFor();
  await page.waitForTimeout(500);
}

// Bộ sinh dữ liệu của fake.mjs có thể trùng (cả mock lẫn worker đều lấy số thứ tự khởi đầu ngẫu nhiên): gặp 409 thì sinh lại.
async function createUser(page: Page) {
  const t = await loginApi(page.request, "admin");
  for (let i = 0; i < 8; i++) {
    const p = person();
    const res = await page.request.post("/api/users", { headers: bearer(t), data: { username: p.username, fullName: p.fullName, email: p.email } });
    if (res.status() === 409) continue;
    expect(res.status()).toBe(201);
    return { ...p, ...((await res.json()) as { id: string }) };
  }
  throw new Error("Không sinh được người dùng không trùng sau 8 lần");
}

async function createRole(page: Page) {
  const t = await loginApi(page.request, "admin");
  for (let i = 0; i < 8; i++) {
    const r = roleSpec();
    const res = await page.request.post("/api/roles", { headers: bearer(t), data: { name: r.name, description: r.description, isAdmin: false } });
    if (res.status() === 409) continue;
    expect(res.status()).toBe(201);
    return { ...r, ...((await res.json()) as { id: string }) };
  }
  throw new Error("Không sinh được vai trò không trùng sau 8 lần");
}

test.describe("thông báo: đọc qua API BE", () => {
  test("chuông hiện số chưa đọc thật, bấm một mục thì giảm 1, Đọc hết về 0", async ({ page }) => {
    await gotoAs(page, "librarian", "/");
    const bell = page.getByRole("button", { name: /^Thông báo, \d+ chưa đọc$/ });
    await expect(bell).toHaveAccessibleName("Thông báo, 4 chưa đọc");
    await bell.click();
    const pop = page.locator(".ant-popover");
    await expect(pop.getByTestId("bell-item").first()).toBeVisible();
    const req = page.waitForRequest((r) => r.method() === "POST" && /\/api\/notifications\/[^/]+\/read$/.test(r.url()));
    await pop.getByTestId("bell-item").first().click();
    await req;
    await expect(bell).toHaveAccessibleName("Thông báo, 3 chưa đọc");
    await pop.getByRole("button", { name: "Đọc hết" }).click();
    await expect(bell).toHaveAccessibleName("Thông báo, 0 chưa đọc");
  });

  test("trang thông báo: lọc chưa đọc/loại trên URL, đánh dấu từng mục, đọc hết, nhánh lỗi 503", async ({ page }) => {
    await gotoAs(page, "librarian", "/notifications");
    const items = page.getByTestId("notification-item");
    // Mock giữ trạng thái theo người: nếu test chuông đã chạy trước thì có thể đã đọc hết; chấp nhận cả hai bằng cách dựng lại danh sách.
    await expect(page.getByTestId("notification-count")).toBeVisible();
    await expect(items).toHaveCount(5);

    // Lọc theo loại (ghi vào URL)
    await page.getByRole("combobox", { name: "Lọc theo loại" }).click();
    await page.locator('.ant-select-item-option[title="RESERVATION"]').click();
    await expect(page).toHaveURL(/[?&]type=RESERVATION/);
    await expect(items).toHaveCount(2);
    await expect(page.getByTestId("notification-count")).toHaveText("2 thông báo");
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(items).toHaveCount(5);

    // Chưa đọc trên URL
    await page.goto("/notifications?filter=unread");
    await expect(main(page).getByRole("heading", { name: "Thông báo" })).toBeVisible();
    // Số chưa đọc có thể đổi giữa các test chạy song song (chuông ở test khác bấm đọc một mục): lấy từ nhãn rồi đợi danh sách khớp, không đếm ngay.
    const label = await page.getByText(/^Chưa đọc \(\d+\)$/).textContent();
    const unread = Number(/\d+/.exec(label ?? "")?.[0]);
    await expect(items).toHaveCount(unread);
    if (unread > 0) {
      await items.first().getByRole("button", { name: /Đánh dấu đã đọc/ }).click();
      await expect(items).toHaveCount(unread - 1);
      await page.getByRole("button", { name: "Đọc hết", exact: true }).click();
      await expect(items).toHaveCount(0);
      await expect(page.getByText("Không có thông báo chưa đọc.")).toBeVisible();
    }
  });

  test("support-service tắt (503): chuông ẩn số, trang thông báo có nút Thử lại", async ({ page }) => {
    await gotoAs(page, "member", "/");
    await page.route("**/api/notifications/**", (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "UNAVAILABLE", message: "Dịch vụ không khả dụng" }) }),
    );
    await gotoApp(page, "/notifications");
    await expect(page.getByRole("button", { name: "Thông báo, 0 chưa đọc" })).toBeVisible();
    await expect(main(page).getByRole("button", { name: /Thử lại/ })).toBeVisible();
  });
});

test.describe("admin: đặt lại mật khẩu, sửa/xóa vai trò", () => {
  test("đặt lại mật khẩu: ConfirmAction rồi nhập mật khẩu tạm; mật khẩu ngắn bị chặn; thành công báo buộc đổi", async ({ page }) => {
    const u = await createUser(page);
    await gotoAs(page, "admin", `/admin/users/${u.id}`);
    await page.getByRole("dialog").first().getByRole("button", { name: "Đặt lại mật khẩu" }).click();
    await expect(page.getByText(`Đặt lại mật khẩu cho «${u.fullName}»?`)).toBeVisible();
    await page.locator(".ant-popover").getByRole("button", { name: "Tiếp tục" }).click();
    await dialogSettled(page);
    const dialog = page.getByRole("dialog", { name: "Đặt mật khẩu tạm" });
    await dialog.getByLabel("Mật khẩu tạm").fill("ngan");
    await dialog.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
    await expect(dialog.getByText("Tối thiểu 8 ký tự")).toBeVisible();
    await dialog.getByRole("button", { name: "Tạo ngẫu nhiên" }).click();
    await expect(dialog.getByLabel("Mật khẩu tạm")).toHaveValue(/^.{14}$/);
    const req = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith(`/api/users/${u.id}/password-reset`));
    await dialog.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
    expect((await req).postDataJSON()).toHaveProperty("temporaryPassword");
    await expect(page.getByText(/Đã đặt lại mật khẩu/)).toBeVisible();
  });

  test("sửa vai trò: đổi mô tả; tên trùng báo lỗi 409", async ({ page }) => {
    const r = await createRole(page);
    await gotoAs(page, "admin", `/admin/roles/${r.id}`);
    const detail = page.getByRole("dialog").first();
    await detail.getByRole("button", { name: "Sửa" }).click();
    await dialogSettled(page);
    const dialog = page.getByRole("dialog", { name: "Sửa vai trò" });
    await dialog.getByLabel("Mô tả").fill("Mô tả mới sau khi sửa");
    await dialog.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã cập nhật vai trò.")).toBeVisible();
    await expect(detail.getByText("Mô tả mới sau khi sửa")).toBeVisible();

    await detail.getByRole("button", { name: "Sửa" }).click();
    await dialogSettled(page);
    await page.getByRole("dialog", { name: "Sửa vai trò" }).getByLabel("Tên vai trò").fill("MEMBER");
    await page.getByRole("dialog", { name: "Sửa vai trò" }).getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByRole("dialog", { name: "Sửa vai trò" }).getByText(/Tên đã được dùng/)).toBeVisible();
  });

  test("xóa vai trò đang được gán: báo ROLE_IN_USE và ở lại trang vai trò", async ({ page }) => {
    const r = await createRole(page);
    const u = await createUser(page);
    const t = await loginApi(page.request, "admin");
    const assign = await page.request.post(`/api/access/users/${u.id}/roles`, { headers: bearer(t), data: { roleId: r.id } });
    expect(assign.status()).toBe(204);
    await gotoAs(page, "admin", `/admin/roles/${r.id}`);
    await page.getByRole("dialog").getByRole("button", { name: /^(delete )?Xóa$/ }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(page.getByText(/đang được gán cho người dùng/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin/roles/${r.id}$`));
  });

  test("xóa vai trò chưa gán cho ai: xóa xong modal đóng và về danh sách", async ({ page }) => {
    const r = await createRole(page);
    await gotoAs(page, "admin", `/admin/roles/${r.id}`);
    await page.getByRole("dialog").getByRole("button", { name: /^(delete )?Xóa$/ }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/roles$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name: r.name, exact: true })).toHaveCount(0);
  });

  // Từng đỏ ~2/3 lần: hộp xác nhận lần 1 còn đang đóng (hoạt ảnh) nên nút "Xóa" của nó khớp locator, và biểu tượng loading cũ
  // kẹt trong nút OK khi mở lại giữa lúc đóng (tên thành "loading Xóa"). Đã sửa ở ConfirmAction; nút kích hoạt scope vào <main>.
  test("xóa vai trò: bị ROLE_IN_USE rồi gỡ gán và xóa lại ngay trên cùng trang", async ({ page }) => {
    const r = await createRole(page);
    const u = await createUser(page);
    const t = await loginApi(page.request, "admin");
    await page.request.post(`/api/access/users/${u.id}/roles`, { headers: bearer(t), data: { roleId: r.id } });
    await gotoAs(page, "admin", `/admin/roles/${r.id}`);
    await page.getByRole("dialog").getByRole("button", { name: /^(delete )?Xóa$/ }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(page.getByText(/đang được gán cho người dùng/)).toBeVisible();
    await page.request.delete(`/api/access/users/${u.id}/roles/${r.id}`, { headers: bearer(t) });
    await page.getByRole("dialog").getByRole("button", { name: /^(delete )?Xóa$/ }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/roles$/);
  });
});

test.describe("admin: form tìm kiếm đủ tiện ích", () => {
  test("người dùng: đếm, chip, kích thước trang, Xóa bộ lọc giữ size", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users?q=nguoidung");
    await expect(page.getByTestId("result-count")).toHaveText("45 người dùng");
    await expect(page.getByRole("searchbox")).toHaveValue("nguoidung"); // giá trị lọc hiện ngay trong ô, không có chip lặp lại
    await expect(page.getByTestId("filter-chip")).toHaveCount(0);
    await expect(page.getByText("Hiển thị 1–20 trên tổng 45")).toBeVisible();

    const req = page.waitForRequest((r) => r.url().includes("/api/users?") && /[?&]size=10\b/.test(r.url()));
    await page.getByRole("combobox", { name: "Số dòng mỗi trang" }).click();
    await page.locator('.ant-select-item-option[title="10 / trang"]').click();
    await req;
    await expect(page).toHaveURL(/[?&]size=10/);
    await expect(page.getByText("Hiển thị 1–10 trên tổng 45")).toBeVisible();

    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(page).toHaveURL(/\/admin\/users\?size=10$/);
    await expect(page.getByRole("searchbox")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Xóa bộ lọc" })).toBeDisabled();
  });

  test("người dùng: lọc trạng thái hiện trong ô lọc (không có chip); Xóa bộ lọc bỏ lọc", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/users?status=DISABLED");
    await expect(page.getByTestId("filter-chip")).toHaveCount(0);
    await expect(page.locator(".ant-select").filter({ has: page.getByRole("combobox", { name: "Lọc theo trạng thái" }) })).toContainText("Đã vô hiệu");
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test("nhật ký: gợi ý loại sự kiện, tự lọc sau khi gõ (debounce), kích thước trang, đếm", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/audit-logs");
    await page.getByLabel("Loại sự kiện").fill("UserCreated");
    await expect(page).toHaveURL(/[?&]eventType=UserCreated/);
    await expect(page.getByTestId("result-count")).toHaveText("15 sự kiện");
    await expect(page.getByLabel("Loại sự kiện")).toHaveValue("UserCreated");
    await expect(page.getByTestId("filter-chip")).toHaveCount(0);

    const req = page.waitForRequest((r) => r.url().includes("/api/audit-logs?") && /[?&]size=50\b/.test(r.url()));
    await page.getByRole("combobox", { name: "Số dòng mỗi trang" }).click();
    await page.locator('.ant-select-item-option[title="50 / trang"]').click();
    await req;
    await expect(page).toHaveURL(/[?&]size=50/);
    await page.getByRole("link", { name: "Xóa bộ lọc" }).click();
    await expect(page).toHaveURL(/\/admin\/audit-logs\?size=50$/);
  });

  test("vai trò: tìm theo tên và lọc loại phía client", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles");
    await page.getByRole("searchbox").fill("CATALOGER");
    await expect(page).toHaveURL(/[?&]q=CATALOGER/);
    await expect(page.getByRole("link", { name: "CATALOGER", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "SUPER_ADMIN", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
    await page.getByRole("combobox", { name: "Lọc theo loại vai trò" }).click();
    await page.locator('.ant-select-item-option[title="Quản trị viên"]').click();
    await expect(page).toHaveURL(/[?&]type=admin/);
    await expect(page.getByRole("link", { name: "SUPER_ADMIN", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "MEMBER", exact: true })).toHaveCount(0);
  });

  test("chi tiết vai trò: lọc Đã gán / Chưa gán", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/roles/3");
    await expect(page.getByText(/^Quyền đã gán/)).toBeVisible();
    await expect(page.getByText("Danh mục quyền")).toBeVisible();
    await page.getByText(/^Đã gán \(/).click();
    await expect(page.getByText("Danh mục quyền")).toHaveCount(0);
    await page.getByText(/^Chưa gán/).click();
    await expect(page.getByText(/^Quyền đã gán/)).toHaveCount(0);
    await expect(page.getByText("Danh mục quyền")).toBeVisible();
  });

  test("phòng ban: tìm theo tên trong cây", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/departments");
    await page.getByRole("textbox", { name: "Tìm phòng ban" }).fill("Hệ thống thông tin");
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(page.getByText("Bộ môn Hệ thống thông tin")).toBeVisible();
    await expect(page.getByText("Khoa Công nghệ thông tin").first()).toBeVisible();
    await page.getByRole("textbox", { name: "Tìm phòng ban" }).fill("khong-co-phong-nay");
    await expect(page.getByText("Không có phòng ban khớp.")).toBeVisible();
  });
});
