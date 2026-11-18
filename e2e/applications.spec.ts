import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoApp, gotoAs, loginApi, sidebar } from "./helpers";

// Developer Portal (/admin/applications): quản lý Application, scope, credential, domain, lịch sử. Mock: e2e/mock/applications.mjs.
// Dữ liệu mock dùng chung giữa 2 worker: mỗi test tạo Application tên riêng (hậu tố duy nhất) và không giả định số lượng.

let n = 0;
const uid = () => `${(Date.now() % 1e7).toString(36)}${process.env.TEST_PARALLEL_INDEX ?? 0}${++n}`;
const main = (page: Page) => page.getByRole("main");
const dlg = (page: Page) => page.getByRole("dialog").last();

type App = { id: string; name: string; clientId: string };

async function createApi(page: Page, kind: "PUBLIC_SITE" | "INTEGRATION", name = `App ${uid()}`) {
  const res = await page.request.post("/api/applications", {
    headers: bearer(await loginApi(page.request, "admin")),
    data: { name, kind },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as App;
}

/** Mở trang chi tiết (modal) của Application và chọn tab. */
async function openDetail(page: Page, user: "admin" | "appviewer" | "appdev", id: string, tab?: string) {
  await gotoAs(page, user, `/admin/applications/${id}${tab ? `?tab=${tab}` : ""}`);
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("developer portal: danh sách và tạo", () => {
  test("danh sách hiện Application seed với loại, trạng thái, scope và số credential; sidebar có mục Developer Portal", async ({ page }) => {
    await gotoAs(page, "admin", "/admin/applications");
    await expect(sidebar(page).getByRole("link", { name: "Developer Portal" })).toHaveAttribute("href", "/admin/applications");
    const row = main(page).getByRole("row", { name: /ERP kế toán \(seed\)/ });
    await expect(row).toContainText("Tích hợp backend");
    await expect(row).toContainText("Đang hoạt động");
    await expect(row).toContainText("books:read");
    const site = main(page).getByRole("row", { name: /Website thư viện \(seed\)/ });
    await expect(site).toContainText("Website công khai");
  });

  test("tạo Application INTEGRATION rồi vào chi tiết; tên trùng báo lỗi tiếng Việt", async ({ page }) => {
    const name = `ERP ${uid()}`;
    await gotoAs(page, "admin", "/admin/applications");
    await main(page).getByRole("button", { name: "Tạo ứng dụng" }).click();
    await dlg(page).getByLabel("Tên ứng dụng").fill(name);
    await dlg(page).getByText("Tích hợp backend").click();
    await dlg(page).getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/applications\/[0-9a-f-]+$/);
    await expect(page.getByRole("dialog").getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Đang hoạt động")).toBeVisible();

    // tên trùng (khác hoa thường) qua API: 409 -> thông điệp trong form
    await gotoApp(page, "/admin/applications");
    await main(page).getByRole("button", { name: "Tạo ứng dụng" }).click();
    await dlg(page).getByLabel("Tên ứng dụng").fill(name.toUpperCase());
    await dlg(page).getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg(page)).toContainText("Đã có ứng dụng trùng tên");
  });

  test("đơn vị chưa có hợp đồng: tạo INTEGRATION báo CONTRACT_REQUIRED bằng tiếng Việt", async ({ page }) => {
    await gotoAs(page, "nocontract", "/admin/applications");
    await main(page).getByRole("button", { name: "Tạo ứng dụng" }).click();
    await dlg(page).getByLabel("Tên ứng dụng").fill(`NoContract ${uid()}`);
    await dlg(page).getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(dlg(page)).toContainText("chưa có hợp đồng thuê đang hiệu lực");
  });

  test("sửa tên và giới hạn tốc độ; thu hồi Application khỏi danh sách", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    await gotoAs(page, "admin", "/admin/applications");
    await main(page).getByRole("button", { name: `Sửa ứng dụng ${a.name}` }).click();
    const renamed = `${a.name} v2`;
    await dlg(page).getByLabel("Tên ứng dụng").fill(renamed);
    await dlg(page).getByLabel("Giới hạn tốc độ (yêu cầu/phút)").fill("120");
    await dlg(page).getByRole("button", { name: "Lưu" }).click();
    await expect(main(page).getByRole("row", { name: new RegExp(renamed) })).toBeVisible();

    await main(page).getByRole("button", { name: `Thu hồi ứng dụng ${renamed}` }).click();
    await page.getByRole("button", { name: "Thu hồi", exact: true }).last().click();
    await expect(main(page).getByRole("row", { name: new RegExp(renamed) })).toHaveCount(0);
  });
});

test.describe("developer portal: scope", () => {
  test("cấp scope đọc; scope ghi và customers:* bị khóa kèm chú thích chưa mở", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    await openDetail(page, "admin", a.id, "scopes");
    const panel = page.getByTestId("scopes-panel");
    for (const k of ["books:write", "inventory:write", "orders:write", "customers:read", "customers:write"]) {
      await expect(panel.getByRole("checkbox", { name: `Scope ${k}` })).toBeDisabled();
    }
    await expect(panel.getByText("chưa mở", { exact: true })).toHaveCount(5);
    await panel.getByRole("checkbox", { name: "Scope books:read" }).check();
    await panel.getByRole("checkbox", { name: "Scope inventory:read" }).check();
    await panel.getByRole("button", { name: "Lưu scope" }).click();
    await expect(page.getByText("Đã cập nhật scope")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Lưu scope" })).toBeDisabled();

    const res = await page.request.get(`/api/applications/${a.id}`, { headers: bearer(await loginApi(page.request, "admin")) });
    expect(((await res.json()) as { scopes: string[] }).scopes.sort()).toEqual(["books:read", "inventory:read"]);
  });

  test("SCOPE_NOT_GRANTABLE (BE thu hẹp danh sách cấp được) hiện thông điệp tiếng Việt", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION", `khoa-orders ${uid()}`);
    await openDetail(page, "admin", a.id, "scopes");
    const panel = page.getByTestId("scopes-panel");
    await panel.getByRole("checkbox", { name: "Scope orders:read" }).check();
    await panel.getByRole("button", { name: "Lưu scope" }).click();
    await expect(page.getByTestId("scopes-error")).toContainText("chưa mở cấp");
  });

  test("hợp đồng API: scope ghi trả 422 SCOPE_NOT_GRANTABLE, scope lạ trả 400 INVALID_SCOPE", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    const headers = bearer(await loginApi(page.request, "admin"));
    const w = await page.request.put(`/api/applications/${a.id}/scopes`, { headers, data: { scopes: ["books:write"] } });
    expect(w.status()).toBe(422);
    expect((await w.json()).code).toBe("SCOPE_NOT_GRANTABLE");
    const bad = await page.request.put(`/api/applications/${a.id}/scopes`, { headers, data: { scopes: ["nope:read"] } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).code).toBe("INVALID_SCOPE");
  });
});

test.describe("developer portal: credential", () => {
  test("tạo credential: client_id + client_secret hiện một lần, đóng thì mất khỏi DOM, storage và URL; bảng chỉ có secretHint", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    await openDetail(page, "admin", a.id, "credentials");
    const panel = page.getByTestId("credentials-panel");

    await panel.getByRole("button", { name: "Tạo credential" }).first().click();
    await dlg(page).getByRole("button", { name: "Tạo credential" }).click();

    const once = page.getByTestId("secret-once");
    await expect(once).toBeVisible();
    await expect(page.getByTestId("secret-once-warning")).toContainText("Chỉ hiện một lần");
    await expect(page.getByTestId("once-client_id")).toHaveText(a.id);
    const secret = (await page.getByTestId("once-client_secret").innerText()).trim();
    expect(secret).toMatch(/^lms_sk_[A-Za-z0-9]{43}$/);
    await expect(page.getByRole("button", { name: "Sao chép client_secret" })).toBeVisible();

    // Chưa đóng: bấm Esc không đóng (phải chủ ý bấm "Tôi đã lưu, đóng").
    await page.keyboard.press("Escape");
    await expect(once).toBeVisible();

    await page.getByRole("button", { name: "Tôi đã lưu, đóng" }).click();
    await expect(once).toHaveCount(0);

    // Secret không còn ở DOM, storage, URL; bảng chỉ hiện 4 ký tự cuối.
    expect(await page.content()).not.toContain(secret);
    const stored = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
    expect(stored).not.toContain(secret);
    expect(page.url()).not.toContain(secret);
    await expect(panel.getByRole("table").getByText(`lms_sk_…${secret.slice(-4)}`)).toBeVisible();
    await expect(panel.getByTestId("credential-usage")).toHaveText("Đang dùng được 1/2");

    // Tải lại trang: không có cách đọc lại secret.
    await page.reload();
    await expect(page.getByTestId("credentials-panel")).toBeVisible();
    expect(await page.content()).not.toContain(secret);
  });

  test("hợp đồng API: tạo credential trả secret + Cache-Control no-store; GET chi tiết không chứa secret", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    const headers = bearer(await loginApi(page.request, "admin"));
    const res = await page.request.post(`/api/applications/${a.id}/credentials`, { headers, data: {} });
    expect(res.status()).toBe(201);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const c = (await res.json()) as { clientSecret: string; secretHint: string; clientId: string };
    expect(c.clientId).toBe(a.id);
    expect(c.clientSecret.endsWith(c.secretHint)).toBe(true);
    const get = await page.request.get(`/api/applications/${a.id}`, { headers });
    expect(get.headers()["cache-control"]).toContain("no-store");
    expect(await get.text()).not.toContain(c.clientSecret);
  });

  test("xoay vòng: tạo credential mới (secret hiện một lần), rồi thu hồi cái cũ; quá 2 credential báo lỗi", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    const headers = bearer(await loginApi(page.request, "admin"));
    const first = (await (await page.request.post(`/api/applications/${a.id}/credentials`, { headers, data: {} })).json()) as { secretHint: string };
    await openDetail(page, "admin", a.id, "credentials");
    const panel = page.getByTestId("credentials-panel");

    await panel.getByRole("button", { name: `Xoay vòng credential lms_sk_…${first.secretHint}` }).click();
    await page.getByRole("button", { name: "Tạo credential mới" }).click();
    await expect(page.getByTestId("secret-once")).toContainText(`thay lms_sk_…${first.secretHint}`);
    await page.getByRole("button", { name: "Tôi đã lưu, đóng" }).click();
    await expect(panel.getByTestId("credential-usage")).toHaveText("Đang dùng được 2/2");

    // Đã đủ 2: không tạo thêm được (409 CREDENTIAL_LIMIT_EXCEEDED).
    await panel.getByRole("button", { name: "Tạo credential" }).first().click();
    await dlg(page).getByRole("button", { name: "Tạo credential" }).click();
    await expect(dlg(page)).toContainText("đã có 2 credential đang dùng được");
    await dlg(page).getByRole("button", { name: "Hủy" }).click();

    await panel.getByRole("button", { name: `Thu hồi credential lms_sk_…${first.secretHint}`, exact: true }).click();
    await page.getByRole("button", { name: "Thu hồi", exact: true }).last().click();
    await expect(panel.getByTestId("credential-usage")).toHaveText("Đang dùng được 1/2");
    await expect(panel.getByRole("row", { name: new RegExp(`lms_sk_…${first.secretHint}`) })).toContainText("Đã thu hồi");
    await expect(panel.getByRole("row", { name: new RegExp(`lms_sk_…${first.secretHint}`) })).toContainText("Thu hồi thủ công");
  });

  test("lịch sử ghi lại tạo ứng dụng, cấp scope và thu hồi credential", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    const headers = bearer(await loginApi(page.request, "admin"));
    await page.request.put(`/api/applications/${a.id}/scopes`, { headers, data: { scopes: ["orders:read"] } });
    const c = (await (await page.request.post(`/api/applications/${a.id}/credentials`, { headers, data: {} })).json()) as { credentialId: string };
    await page.request.post(`/api/applications/${a.id}/credentials/${c.credentialId}/revocation`, { headers, data: { reason: "COMPROMISED" } });
    await openDetail(page, "admin", a.id, "history");
    const t = page.getByRole("dialog").getByRole("table");
    await expect(t).toContainText("Tạo ứng dụng");
    await expect(t).toContainText("Cập nhật scope");
    await expect(t).toContainText("Tạo credential");
    await expect(t).toContainText("Thu hồi credential");
  });
});

test.describe("developer portal: website công khai và domain", () => {
  test("hiện site key, đổi site key, thêm và xóa domain; lỗi ORIGIN_INVALID, ORIGIN_DUPLICATED", async ({ page }) => {
    const a = await createApi(page, "PUBLIC_SITE");
    await openDetail(page, "admin", a.id);
    const before = (await page.getByTestId("site-key").innerText()).trim();
    expect(before).toMatch(/^lms_pk_/);
    await page.getByRole("button", { name: "Đổi site key", exact: true }).click();
    await page.getByRole("button", { name: "Đổi site key", exact: true }).last().click();
    await expect(page.getByTestId("site-key")).not.toHaveText(before);

    await page.getByRole("tab", { name: "Domain" }).click();
    const panel = page.getByTestId("domains-panel");
    const host = `shop-${uid()}.example.vn`;
    const add = async (v: string) => {
      await panel.getByRole("textbox", { name: "Địa chỉ domain (origin)" }).fill(v);
      await panel.getByRole("button", { name: "Thêm domain" }).click();
    };
    await add("shop.example.vn");
    await expect(page.getByTestId("domain-input-error")).toContainText("bắt đầu bằng https://");
    await add(`https://${host}/duong-dan`);
    await expect(page.getByTestId("domain-error")).toContainText("không được có đường dẫn");

    await add(`  HTTPS://${host.toUpperCase()}/ `);
    const origin = `https://${host}`;
    await expect(panel.getByRole("cell", { name: origin, exact: true })).toBeVisible();
    await add(origin);
    await expect(page.getByTestId("domain-error")).toContainText("đã được khai báo");

    await panel.getByRole("button", { name: `Xóa domain ${origin}` }).click();
    await page.getByRole("button", { name: "Xóa", exact: true }).last().click();
    await expect(panel.getByRole("cell", { name: origin, exact: true })).toHaveCount(0);
  });

  test("Application INTEGRATION không có tab Domain; PUBLIC_SITE không có tab Scope và Credential", async ({ page }) => {
    const i = await createApi(page, "INTEGRATION");
    await openDetail(page, "admin", i.id);
    await expect(page.getByRole("tab", { name: "Credential" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Domain" })).toHaveCount(0);
    const w = await createApi(page, "PUBLIC_SITE");
    await openDetail(page, "admin", w.id);
    await expect(page.getByRole("tab", { name: "Domain" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Scope" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Credential" })).toHaveCount(0);
  });
});

test.describe("developer portal: phân quyền", () => {
  test("người chỉ có khóa xem: thấy danh sách nhưng không có nút tạo, sửa, thu hồi", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    await gotoAs(page, "appviewer", "/admin/applications");
    await expect(main(page).getByRole("row", { name: new RegExp(a.name) })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Tạo ứng dụng" })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: `Sửa ứng dụng ${a.name}` })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: `Thu hồi ứng dụng ${a.name}` })).toHaveCount(0);

    await openDetail(page, "appviewer", a.id);
    const d = page.getByRole("dialog");
    await expect(d.getByRole("button", { name: "Sửa", exact: true })).toHaveCount(0);
    await expect(d.getByRole("button", { name: "Thu hồi ứng dụng" })).toHaveCount(0);
    await d.getByRole("tab", { name: "Credential" }).click();
    await expect(d.getByRole("button", { name: "Tạo credential" })).toHaveCount(0);
    await d.getByRole("tab", { name: "Scope" }).click();
    await expect(d.getByRole("button", { name: "Lưu scope" })).toHaveCount(0);
    await expect(d.getByText("Bạn không có quyền đổi scope.")).toBeVisible();
  });

  test("người không có khóa nào: không thấy mục Developer Portal, vào thẳng báo thiếu quyền", async ({ page }) => {
    await gotoAs(page, "appnone", "/admin/applications");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Developer Portal" })).toHaveCount(0);
  });

  test("người có đủ khóa nhưng không phải admin vẫn tạo được credential", async ({ page }) => {
    const a = await createApi(page, "INTEGRATION");
    await openDetail(page, "appdev", a.id, "credentials");
    await page.getByTestId("credentials-panel").getByRole("button", { name: "Tạo credential" }).first().click();
    await dlg(page).getByRole("button", { name: "Tạo credential" }).click();
    await expect(page.getByTestId("once-client_secret")).toBeVisible();
    await page.getByRole("button", { name: "Tôi đã lưu, đóng" }).click();
  });

  test("platform admin không dùng màn này của tenant", async ({ page }) => {
    await gotoAs(page, "platform", "/admin/applications");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Developer Portal" })).toHaveCount(0);
  });

  test("chưa đăng nhập hoặc token không tenant: API trả 401/403", async ({ page }) => {
    const anon = await page.request.get("/api/applications");
    expect(anon.status()).toBe(401);
    const res = await page.request.get("/api/applications", { headers: bearer(await loginApi(page.request, "platform")) });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe("TENANT_REQUIRED");
  });
});
