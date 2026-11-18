import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar } from "./helpers";

// Liên hệ khách gửi cửa hàng (ADR-0015, nhân viên xử lý): ma trận khóa, che PII, đổi trạng thái, ẩn danh, xung đột version.
// Mock: e2e/mock/sales-contacts.mjs. Khách gửi qua customer-api (ngoài FE) nên yêu cầu được dựng bằng POST /api/sales/_mock/contacts.
// salesmgr có 4 khóa (không có getContact); salesadmin bỏ qua kiểm khóa (xem đầy đủ); cashier không có khóa nào.

const main = (page: Page) => page.getByRole("main");
// Chi tiết là modal giữ URL (danh sách ở nền): locator của chi tiết scope vào dialog.
const detail = (page: Page) => page.getByRole("dialog");
type Contact = { id: string; version: number; status: string };

async function seed(request: APIRequestContext, data: Record<string, unknown> = {}): Promise<Contact> {
  const res = await request.post("/api/sales/_mock/contacts", { data });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Contact;
}

const uid = () => Math.random().toString(36).slice(2, 8);
const openContact = async (page: Page, user: "salesmgr" | "salesadmin" | "cashier", c: Contact) => {
  await gotoAs(page, user, `/sales/contacts/${c.id}`);
  await expect(detail(page).getByTestId("contact-status")).toBeVisible();
};

test.describe("liên hệ khách: nav và ma trận khóa", () => {
  test("quản lý thấy mục Liên hệ khách; thu ngân không thấy và vào thẳng URL bị chặn", async ({ page }) => {
    await gotoAs(page, "salesmgr", "/");
    await expect(sidebar(page).getByRole("link", { name: "Liên hệ khách" })).toHaveAttribute("href", "/sales/contacts");
    await gotoAs(page, "cashier", "/");
    await expect(sidebar(page).getByRole("link", { name: "Đơn hàng" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Liên hệ khách" })).toHaveCount(0);
    await page.goto("/sales/contacts");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    const c = await seed(page.request);
    await page.goto(`/sales/contacts/${c.id}`);
    await expect(detail(page).getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
  });
});

test.describe("liên hệ khách: danh sách", () => {
  test("hiển thị chủ đề, trạng thái, người liên hệ đã che và lọc theo trạng thái/chủ đề", async ({ page }) => {
    const name = `Trần Thị ${uid()}`;
    const c = await seed(page.request, { topic: "PAYMENT", fullName: name, email: "lien.he@example.vn", phone: "0987654321" });
    await gotoAs(page, "salesmgr", "/sales/contacts?topic=PAYMENT&status=NEW");
    await expect(main(page).getByText(/chỉ được ghi nhận/)).toBeVisible();
    const row = main(page).getByRole("row").filter({ hasText: "T*** T*** " }).first();
    await expect(row).toContainText("Thanh toán");
    await expect(row).toContainText("Mới");
    await expect(row).toContainText("l***@example.vn");
    await expect(row).toContainText("*******321");
    await expect(main(page).getByText("lien.he@example.vn")).toHaveCount(0);
    await expect(main(page).getByText("0987654321")).toHaveCount(0);
    await page.goto(`/sales/contacts?topic=ORDER&status=CLOSED`);
    await expect(main(page).getByText("Không có yêu cầu liên hệ nào.")).toBeVisible();
    expect(c.id).toBeTruthy();
  });

  test("đã ẩn danh hiện cờ trong danh sách", async ({ page }) => {
    const c = await seed(page.request, { topic: "OTHER", fullName: `Ẩn ${uid()}` });
    const t = await loginApi(page.request, "salesadmin");
    const res = await page.request.post(`/api/sales/contact-requests/${c.id}/anonymization`, { headers: bearer(t) });
    expect(res.ok()).toBeTruthy();
    await gotoAs(page, "salesmgr", "/sales/contacts?topic=OTHER");
    await expect(main(page).getByText("Đã ẩn danh").first()).toBeVisible();
  });
});

test.describe("liên hệ khách: chi tiết", () => {
  test("quản lý chỉ thấy thông tin che, không có nút xem đầy đủ; admin xem đầy đủ kèm cảnh báo", async ({ page }) => {
    const c = await seed(page.request, { fullName: "Lê Văn Mẫu", email: "mau.le@example.vn", phone: "0901234567", message: "Cần xuất hóa đơn <b>gấp</b>" });
    await openContact(page, "salesmgr", c);
    const who = detail(page).getByTestId("contact-person");
    await expect(who).toContainText("L*** V*** M***");
    await expect(who).toContainText("m***@example.vn");
    await expect(who).not.toContainText("mau.le@example.vn");
    await expect(who.getByRole("button", { name: "Xem thông tin liên hệ đầy đủ" })).toHaveCount(0);
    // Nội dung hiển thị dạng văn bản thuần (không dựng HTML).
    await expect(detail(page).getByTestId("contact-message")).toHaveText("Cần xuất hóa đơn <b>gấp</b>");

    const logs: string[] = [];
    page.on("console", (m) => logs.push(m.text()));
    await openContact(page, "salesadmin", c);
    await expect(detail(page).getByTestId("contact-pii-warning")).toHaveCount(0);
    await detail(page).getByRole("button", { name: "Xem thông tin liên hệ đầy đủ" }).click();
    await expect(detail(page).getByTestId("contact-email")).toHaveText("mau.le@example.vn");
    await expect(detail(page).getByTestId("contact-phone")).toHaveText("0901234567");
    await expect(detail(page).getByTestId("contact-pii-warning")).toContainText("dữ liệu cá nhân");
    expect(logs.join("\n")).not.toContain("mau.le@example.vn");
  });

  test("đổi trạng thái đúng thứ tự, đã đóng thì không mở lại", async ({ page }) => {
    const c = await seed(page.request);
    await openContact(page, "salesmgr", c);
    await expect(detail(page).getByTestId("contact-status")).toHaveText("Mới");
    await expect(detail(page).getByRole("button", { name: "Bắt đầu xử lý" })).toBeVisible();
    await expect(detail(page).getByRole("button", { name: "Đóng yêu cầu" })).toBeVisible();
    await detail(page).getByRole("button", { name: "Bắt đầu xử lý" }).click();
    await expect(detail(page).getByTestId("contact-status")).toHaveText("Đang xử lý");
    // Đang xử lý: chỉ còn đóng, không quay lại "Bắt đầu xử lý".
    await expect(detail(page).getByRole("button", { name: "Bắt đầu xử lý" })).toHaveCount(0);
    await detail(page).getByRole("button", { name: "Đóng yêu cầu" }).click();
    await expect(detail(page).getByTestId("contact-status")).toHaveText("Đã đóng");
    await expect(detail(page).getByRole("button", { name: "Bắt đầu xử lý" })).toHaveCount(0);
    await expect(detail(page).getByRole("button", { name: "Đóng yêu cầu" })).toHaveCount(0);
  });

  test("không có khóa updateStatus thì không thấy nút đổi trạng thái", async ({ page }) => {
    const c = await seed(page.request);
    await openContact(page, "salesadmin", c);
    await expect(detail(page).getByRole("button", { name: "Bắt đầu xử lý" })).toBeVisible();
    // Bản mock không có user chỉ-xem; kiểm bằng API: thu ngân gọi đổi trạng thái bị 403.
    const t = await loginApi(page.request, "cashier");
    const res = await page.request.put(`/api/sales/contact-requests/${c.id}/status`, { headers: bearer(t), data: { status: "CLOSED", version: c.version } });
    expect(res.status()).toBe(403);
  });

  test("ẩn danh ngay cần xác nhận; sau đó hiển thị đã ẩn danh và không còn thao tác", async ({ page }) => {
    const c = await seed(page.request, { email: "xoa.toi@example.vn", message: "Nội dung cần xóa" });
    await openContact(page, "salesmgr", c);
    await detail(page).getByRole("button", { name: "Ẩn danh ngay" }).click();
    const pop = page.locator(".ant-popover");
    await expect(pop).toContainText("Không hoàn tác được");
    // Hủy xác nhận: chưa ẩn danh.
    await pop.getByRole("button", { name: "Không" }).click();
    await expect(detail(page).getByTestId("contact-anonymized")).toHaveCount(0);
    await detail(page).getByRole("button", { name: "Ẩn danh ngay" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Ẩn danh" }).click();
    await expect(detail(page).getByTestId("contact-anonymized")).toContainText("Đã ẩn danh lúc");
    await expect(detail(page).getByTestId("contact-message")).toHaveText("Đã ẩn danh");
    await expect(detail(page).getByText("Nội dung cần xóa")).toHaveCount(0);
    await expect(detail(page).getByRole("button", { name: "Ẩn danh ngay" })).toHaveCount(0);
  });

  test("xung đột version: báo lỗi, tải lại bản mới", async ({ page }) => {
    const c = await seed(page.request);
    await openContact(page, "salesmgr", c);
    // Người khác đã chuyển sang "Đang xử lý" trước (version tăng).
    const t = await loginApi(page.request, "salesadmin");
    const r = await page.request.put(`/api/sales/contact-requests/${c.id}/status`, { headers: bearer(t), data: { status: "IN_PROGRESS", version: c.version } });
    expect(r.ok()).toBeTruthy();
    await detail(page).getByRole("button", { name: "Bắt đầu xử lý" }).click();
    await expect(detail(page).getByText(/vừa được người khác xử lý/)).toBeVisible();
    await expect(detail(page).getByTestId("contact-status")).toHaveText("Đang xử lý");
    await expect(detail(page).getByRole("button", { name: "Bắt đầu xử lý" })).toHaveCount(0);
  });

  test("chi tiết mở dạng modal: danh sách vẫn ở nền, đóng (X) quay về URL danh sách", async ({ page }) => {
    const c = await seed(page.request, { topic: "OTHER" });
    await gotoAs(page, "salesmgr", "/sales/contacts");
    await page.goto(`/sales/contacts/${c.id}`);
    const dlg = detail(page);
    await expect(dlg.getByTestId("contact-status")).toBeVisible();
    await expect(dlg.getByRole("heading", { name: "Chi tiết liên hệ" })).toBeVisible();
    await expect(dlg.getByText("Quay lại danh sách")).toHaveCount(0);
    await expect(main(page).getByText(/chỉ được ghi nhận/)).toBeAttached(); // danh sách vẫn ở nền
    await dlg.locator(".ant-modal-close").click();
    await expect(dlg).toHaveCount(0);
    await expect(page).toHaveURL(/\/sales\/contacts$/);
  });

  test("id không tồn tại: báo không tìm thấy", async ({ page }) => {
    await gotoAs(page, "salesmgr", "/sales/contacts/00000000-0000-4000-8000-00000000dead");
    await expect(detail(page).getByText("Không tìm thấy yêu cầu liên hệ.")).toBeVisible();
  });
});
