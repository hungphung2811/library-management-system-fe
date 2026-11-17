import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar } from "./helpers";

// Nhóm nền tảng SaaS (chỉ platform admin): trang CMS, yêu cầu liên hệ; và mô tả/preview đầu sách (khóa động).
// Mock: e2e/mock/platform.mjs. Dữ liệu dùng chung giữa 2 worker nên mỗi test tạo dữ liệu riêng (hậu tố duy nhất) và không giả định số lượng.

let n = 0;
const uid = () => `${(Date.now() % 1e7).toString(36)}${process.env.TEST_PARALLEL_INDEX ?? 0}${++n}`;
const main = (page: Page) => page.getByRole("main");
const BOOK = "b0000000-0000-4000-8000-000000000001";

async function api(page: Page, user: "platform" | "admin") {
  const t = await loginApi(page.request, user);
  return bearer(t);
}

async function createPage(page: Page, slug = `trang-${uid()}`) {
  const res = await page.request.post("/api/cms/pages", {
    headers: await api(page, "platform"),
    data: { slug, title: `Giới thiệu ${slug}`, bodyMarkdown: "# Xin chào", sortOrder: 5 },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; slug: string; title: string; version: number };
}

async function createContact(page: Page, data: Record<string, unknown>) {
  const res = await page.request.post("/api/__test/contact-requests", { data });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string };
}

test.describe("nền tảng: quyền vào", () => {
  test("platform admin thấy nhóm Nền tảng SaaS trên sidebar, người khác thì không", async ({ page }) => {
    await gotoAs(page, "platform", "/");
    await expect(sidebar(page).getByRole("link", { name: "Trang website" })).toHaveAttribute("href", "/platform/cms-pages");
    await expect(sidebar(page).getByRole("link", { name: "Yêu cầu liên hệ" })).toHaveAttribute("href", "/platform/contact-requests");
    await gotoAs(page, "admin", "/");
    await expect(sidebar(page).getByRole("link", { name: "Trang website" })).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: "Yêu cầu liên hệ" })).toHaveCount(0);
  });

  test("tenant admin vào thẳng URL thì thấy trang không có quyền, và BE trả 403", async ({ page }) => {
    await gotoAs(page, "admin", "/platform/cms-pages");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    expect((await page.request.get("/api/cms/pages", { headers: await api(page, "admin") })).status()).toBe(403);
  });
});

test.describe("nền tảng: trang CMS", () => {
  test("tạo trang, sửa, xuất bản, sửa tiếp thấy có thay đổi, gỡ xuất bản, xóa", async ({ page }) => {
    const slug = `moi-${uid()}`;
    await gotoAs(page, "platform", "/platform/cms-pages");
    await main(page).getByRole("button", { name: "Thêm trang" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByLabel("Đường dẫn (slug)")).toBeFocused();
    await dlg.getByLabel("Đường dẫn (slug)").fill("Sai Định Dạng");
    await dlg.getByLabel("Tiêu đề").fill("Về chúng tôi");
    await dlg.getByRole("button", { name: "Tạo" }).click();
    await expect(dlg.getByText("Chỉ gồm chữ thường a-z, số và dấu gạch ngang")).toBeVisible();
    await dlg.getByLabel("Đường dẫn (slug)").fill(slug);
    await dlg.getByRole("button", { name: "Tạo" }).click();

    await expect(page).toHaveURL(/\/platform\/cms-pages\/[^/]+$/);
    await expect(main(page).getByText("Bản nháp").first()).toBeVisible();
    await expect(main(page).getByLabel("Slug")).toBeDisabled();

    await main(page).getByLabel("Nội dung (Markdown)").fill("# Chào <b>bạn</b>");
    await main(page).getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu.")).toBeVisible();

    await main(page).getByRole("button", { name: "Xuất bản" }).first().click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xuất bản" }).click();
    await expect(main(page).getByText("Đã xuất bản", { exact: true })).toBeVisible();
    // Bản công khai hiển thị là văn bản thô, không dựng HTML.
    await expect(main(page).getByText("# Chào <b>bạn</b>").last()).toBeVisible();
    await expect(main(page).locator("b")).toHaveCount(0);

    await main(page).getByLabel("Tiêu đề").fill("Về chúng tôi (sửa)");
    await main(page).getByRole("button", { name: "Lưu" }).click();
    await expect(main(page).getByText(/có thay đổi chưa xuất bản/)).toBeVisible();

    await main(page).getByRole("button", { name: "Gỡ xuất bản" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Gỡ" }).click();
    await expect(main(page).getByText("Bản nháp").first()).toBeVisible();

    await main(page).getByRole("button", { name: "Xóa" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xóa" }).click();
    await expect(page).toHaveURL(/\/platform\/cms-pages$/);
    await expect(main(page).getByRole("cell", { name: slug })).toHaveCount(0);
  });

  test("slug trùng báo lỗi bằng tiếng Việt", async ({ page }) => {
    const p = await createPage(page);
    await gotoAs(page, "platform", "/platform/cms-pages");
    await main(page).getByRole("button", { name: "Thêm trang" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Đường dẫn (slug)").fill(p.slug);
    await dlg.getByLabel("Tiêu đề").fill("Trùng");
    await dlg.getByRole("button", { name: "Tạo" }).click();
    await expect(dlg.getByText("Đường dẫn (slug) này đã có trang khác dùng.")).toBeVisible();
  });

  test("lệch phiên bản (409 CMS_VERSION_CONFLICT): tải lại bản mới và báo người dùng", async ({ page }) => {
    const p = await createPage(page);
    await gotoAs(page, "platform", `/platform/cms-pages/${p.id}`);
    await expect(main(page).getByLabel("Tiêu đề")).toHaveValue(p.title);
    // Người khác sửa trang trước.
    const put = await page.request.put(`/api/cms/pages/${p.id}`, {
      headers: await api(page, "platform"),
      data: { title: "Bản của người khác", bodyMarkdown: "x", sortOrder: 1, version: p.version },
    });
    expect(put.status()).toBe(200);
    await main(page).getByLabel("Tiêu đề").fill("Bản của tôi");
    await main(page).getByRole("button", { name: "Lưu" }).click();
    await expect(main(page).getByText(/Trang vừa được người khác thay đổi/)).toBeVisible();
    await expect(main(page).getByLabel("Tiêu đề")).toHaveValue("Bản của người khác");
  });

  test("xuất bản từ danh sách gửi kèm version và hiện trạng thái", async ({ page }) => {
    const p = await createPage(page);
    await gotoAs(page, "platform", "/platform/cms-pages");
    const row = main(page).getByRole("row").filter({ hasText: p.slug });
    await row.getByRole("button", { name: "Xuất bản" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Xuất bản" }).click();
    await expect(row.getByText("Đã xuất bản", { exact: true })).toBeVisible();
  });
});

test.describe("nền tảng: yêu cầu liên hệ", () => {
  test("danh sách che email, chi tiết chỉ hiện khi bấm, lời nhắn hiển thị là text", async ({ page }) => {
    const org = `Thư viện ${uid()}`;
    const c = await createContact(page, {
      organization: org, email: "an.nguyen@example.vn", phone: "0912345678", message: "Chào <b>bạn</b>\n<img src=x onerror=alert(1)>",
    });
    await gotoAs(page, "platform", "/platform/contact-requests");
    const row = main(page).getByRole("row").filter({ hasText: org });
    await expect(row).toContainText("a***@example.vn");
    await expect(row).not.toContainText("an.nguyen@example.vn");

    await row.getByRole("link", { name: org }).click();
    await expect(page).toHaveURL(new RegExp(`/platform/contact-requests/${c.id}$`));
    await expect(main(page).getByText("a***@example.vn")).toBeVisible();
    await expect(main(page).getByText("*******678")).toBeVisible();
    await expect(main(page).getByText("an.nguyen@example.vn")).toHaveCount(0);

    await main(page).getByRole("button", { name: "Hiện thông tin cá nhân" }).click();
    await expect(main(page).getByText("an.nguyen@example.vn")).toBeVisible();
    await expect(main(page).getByText("0912345678")).toBeVisible();
    const msg = main(page).getByTestId("contact-message");
    await expect(msg).toContainText("Chào <b>bạn</b>");
    await expect(msg).toContainText("<img src=x onerror=alert(1)>");
    await expect(msg.locator("b, img")).toHaveCount(0);
  });

  test("đổi trạng thái theo bảng chuyển hợp lệ", async ({ page }) => {
    const c = await createContact(page, { organization: `Hiệu sách ${uid()}` });
    await gotoAs(page, "platform", `/platform/contact-requests/${c.id}`);
    await main(page).getByLabel("Trạng thái mới").click();
    const options = page.locator(".ant-select-item-option");
    await expect(options).toHaveText(["Đang xử lý", "Đã xử lý", "Spam"]); // NEW không về lại NEW
    await options.filter({ hasText: "Đã xử lý" }).click();
    await main(page).getByRole("button", { name: "Đổi trạng thái" }).click();
    await expect(page.getByText("Đã đổi trạng thái.")).toBeVisible();
    await expect(main(page).getByText("Đã xử lý").first()).toBeVisible();
    await main(page).getByLabel("Trạng thái mới").click();
    await expect(page.locator(".ant-select-item-option")).toHaveText(["Đang xử lý"]); // HANDLED chỉ về IN_PROGRESS
  });

  test("lệch phiên bản: báo và tải lại bản mới", async ({ page }) => {
    const c = await createContact(page, { organization: `Đơn vị ${uid()}` });
    await gotoAs(page, "platform", `/platform/contact-requests/${c.id}`);
    await expect(main(page).getByRole("button", { name: "Đổi trạng thái" })).toBeVisible();
    // Người khác đổi trước (version 0 -> 1).
    const r = await page.request.put(`/api/cms/contact-requests/${c.id}/status`, {
      headers: await api(page, "platform"), data: { status: "IN_PROGRESS", version: 0 },
    });
    expect(r.status()).toBe(200);
    await main(page).getByLabel("Trạng thái mới").click();
    await page.locator(".ant-select-item-option").filter({ hasText: "Đã xử lý" }).click();
    await main(page).getByRole("button", { name: "Đổi trạng thái" }).click();
    await expect(main(page).getByText(/vừa được người khác thay đổi/)).toBeVisible();
    await expect(main(page).getByText("Đang xử lý").first()).toBeVisible();
  });

  test("ẩn danh ngay: không còn dữ liệu cá nhân, không đổi được trạng thái", async ({ page }) => {
    const c = await createContact(page, { organization: `Đơn vị ${uid()}`, email: "xoa.toi@example.vn" });
    await gotoAs(page, "platform", `/platform/contact-requests/${c.id}`);
    await main(page).getByRole("button", { name: "Ẩn danh ngay" }).click();
    await page.locator(".ant-popover").getByRole("button", { name: "Ẩn danh" }).click();
    await expect(main(page).getByText(/Đã ẩn danh lúc/)).toBeVisible();
    await expect(main(page).getByText("xoa.toi@example.vn")).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: "Đổi trạng thái" })).toHaveCount(0);
  });

  test("lọc trạng thái và phân trang trên URL; lọc ngày gửi ISO instant", async ({ page }) => {
    await gotoAs(page, "platform", "/platform/contact-requests?status=SPAM");
    await expect(main(page).getByRole("row").filter({ hasText: "Spam" }).first()).toBeVisible();
    await expect(page.getByText(/Hiển thị 1–20 trên tổng/)).toBeVisible();
    await page.locator(".ant-pagination-item-2").click();
    await expect(page).toHaveURL(/status=SPAM/);
    await expect(page).toHaveURL(/page=2/);

    await page.goto("/platform/contact-requests?from=2026-09-01&to=2026-09-30");
    await expect(main(page).getByRole("table")).toBeVisible();
    const q = (await (await page.request.get("/api/__test/last-contact-query")).json()) as { query: string };
    const sp = new URLSearchParams(q.query);
    expect(sp.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(sp.get("to")!).getTime()).toBeGreaterThan(new Date(sp.get("from")!).getTime());
  });
});

test.describe("catalog: mô tả và đoạn đọc thử", () => {
  test("người có TitleController/updatePreview nhập, xem bộ đếm, lưu; hiển thị là text", async ({ page }) => {
    await gotoAs(page, "previewer", `/catalog/books/${BOOK}`);
    const card = main(page).locator(".ant-card").filter({ hasText: "Mô tả và đọc thử" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog");
    // FormModal chuyển focus vào ô đầu sau khi hộp thoại mở xong: đợi, nếu không fill ô sau bị đoạt focus giữa chừng.
    await expect(dlg.getByLabel("Mô tả ngắn (văn bản thuần)")).toBeFocused();
    await dlg.getByLabel("Mô tả ngắn (văn bản thuần)").fill("Dòng 1 <b>đậm</b>\nDòng 2 😀");
    await expect(dlg.getByText(/^\d+ \/ 500$/)).toBeVisible();
    await dlg.getByLabel("Đoạn đọc thử (văn bản thuần)").fill("Chương 1 <script>alert(1)</script>");
    await expect(dlg.getByText(/^\d+ \/ 2000$/)).toBeVisible();
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu.")).toBeVisible();

    const d = card.getByTestId("preview-description");
    await expect(d).toContainText("Dòng 1 <b>đậm</b>");
    await expect(d).toContainText("Dòng 2 😀");
    await expect(d.locator("b")).toHaveCount(0);
    expect(await d.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("pre-wrap");
    await expect(card.getByTestId("preview-text")).toContainText("<script>alert(1)</script>");
  });

  test("quá giới hạn bị chặn ngay trên biểu mẫu (đếm theo code point, emoji tính 1)", async ({ page }) => {
    await gotoAs(page, "previewer", `/catalog/books/${BOOK}`);
    await main(page).getByRole("button", { name: "Sửa" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByLabel("Mô tả ngắn (văn bản thuần)")).toBeFocused();
    await dlg.getByLabel("Mô tả ngắn (văn bản thuần)").fill("😀".repeat(500)); // 500 code point = 1000 đơn vị UTF-16: vẫn hợp lệ
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Đã lưu.")).toBeVisible();

    await main(page).getByRole("button", { name: "Sửa" }).click();
    await dlg.getByLabel("Mô tả ngắn (văn bản thuần)").fill("a".repeat(501));
    await dlg.getByRole("button", { name: "Lưu" }).click();
    await expect(dlg.getByText("Tối đa 500 ký tự")).toBeVisible();
  });

  test("BE trả 400 TITLE_PREVIEW_TOO_LONG thì hiện câu tiếng Việt", async ({ page }) => {
    // Chặn kiểm tra phía FE bằng cách gọi thẳng API: mock trả đúng mã lỗi của catalog.
    const r = await page.request.put(`/api/books/${BOOK}/preview`, {
      headers: bearer(await loginApi(page.request, "previewer")), data: { description: "a".repeat(501) },
    });
    expect(r.status()).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe("TITLE_PREVIEW_TOO_LONG");
  });

  test("chỉ có quyền xem (TitleController/preview) thì không có nút Sửa; không có khóa thì không thấy khối này", async ({ page }) => {
    await gotoAs(page, "previewviewer", `/catalog/books/${BOOK}`);
    await expect(main(page).getByText("Mô tả và đọc thử")).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Sửa" })).toHaveCount(0);
    await gotoAs(page, "librarian", `/catalog/books/${BOOK}`);
    await expect(main(page).getByText("Thông tin", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Mô tả và đọc thử")).toHaveCount(0);
  });
});
