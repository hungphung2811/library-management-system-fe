import { expect, test, type Page } from "@playwright/test";
import { bearer, gotoAs, loginApi, sidebar, type UserKey } from "./helpers";

// Thông báo theo sự kiện (ADR-0030 gói C): trang quản trị /admin/notifications (kênh, mẫu, lịch sử gửi) và "Tùy chọn nhận thông báo" trong /profile.
// Mock: e2e/mock/notifications.mjs. Mock dùng chung 2 worker và test chạy song song: mỗi test dùng loại thông báo, lượt gửi hoặc người dùng riêng.
// Lượt DEAD mẫu: ...000a (test gửi lại qua giao diện) và ...000b (test API gửi lại hai lần); lượt SKIPPED/RETRY mẫu không test nào đổi.

const DEAD_A = "d0000000-0000-4000-8000-00000000000a";
const DEAD_B = "d0000000-0000-4000-8000-00000000000b";
const main = (page: Page) => page.getByRole("main");
const dlg = (page: Page) => page.getByRole("dialog").last();
const hdr = async (page: Page, user: UserKey) => bearer(await loginApi(page.request, user));
const tab = (page: Page, name: string) => main(page).getByRole("tab", { name });

test.describe("thông báo (admin): kênh gửi", () => {
  test("sidebar có mục Thông báo; bật/tắt kênh email theo loại, lưu rồi tải lại vẫn giữ", async ({ page }) => {
    await gotoAs(page, "notiadmin", "/admin/notifications");
    await expect(sidebar(page).getByRole("link", { name: "Thông báo", exact: true })).toHaveAttribute("href", "/admin/notifications");
    await expect(tab(page, "Kênh gửi")).toBeVisible();
    await expect(tab(page, "Mẫu nội dung")).toBeVisible();
    await expect(tab(page, "Lịch sử gửi")).toBeVisible();
    const sw = main(page).getByRole("switch", { name: "Email: Đơn đang giao" });
    await expect(sw).toBeChecked();
    const save = main(page).getByRole("button", { name: "Lưu thay đổi" });
    await expect(save).toBeDisabled();
    await sw.click();
    await expect(main(page)).toContainText("1 thay đổi chưa lưu");
    await save.click();
    await expect(page.getByText("Đã lưu cấu hình kênh.")).toBeVisible();
    await page.reload();
    await expect(main(page).getByRole("switch", { name: "Email: Đơn đang giao" })).not.toBeChecked();
    // Khôi phục để lần chạy sau (cùng mock) cũng bắt đầu từ bật.
    await main(page).getByRole("switch", { name: "Email: Đơn đang giao" }).click();
    await main(page).getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByText("Đã lưu cấu hình kênh.")).toBeVisible();
  });

  test("chỉ có khóa xem: công tắc bị khóa, không có nút Lưu; mẫu mở ở chế độ chỉ đọc", async ({ page }) => {
    await gotoAs(page, "notiview", "/admin/notifications");
    await expect(main(page).getByRole("switch", { name: "Email: Đơn hàng vừa đặt" })).toBeDisabled();
    await expect(main(page).getByRole("button", { name: "Lưu thay đổi" })).toHaveCount(0);
    await tab(page, "Mẫu nội dung").click();
    await main(page).getByRole("row", { name: /Sắp đến hạn trả sách/ }).getByRole("button", { name: "Xem mẫu" }).click();
    await expect(dlg(page).getByTestId("template-readonly")).toContainText("Bạn có {{item_count}} cuốn đến hạn trả");
    await expect(dlg(page).getByRole("button", { name: /Lưu phiên bản mới/ })).toHaveCount(0);
  });

  test("người không có khóa thông báo thấy trang không có quyền và không có mục sidebar", async ({ page }) => {
    await gotoAs(page, "notinone", "/admin/notifications");
    await expect(page.getByText("Bạn chưa có quyền xem trang này")).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Thông báo", exact: true })).toHaveCount(0);
  });
});

test.describe("thông báo (admin): mẫu nội dung", () => {
  test("xem trước bằng dữ liệu giả; tham số lạ bị từ chối; lưu tạo phiên bản mới, nguồn chuyển sang Của đơn vị", async ({ page }) => {
    await gotoAs(page, "notiadmin", "/admin/notifications?tab=templates");
    const row = main(page).getByRole("row", { name: /Phát sinh tiền phạt/ });
    await expect(row).toContainText("Mặc định");
    await row.getByRole("button", { name: "Sửa mẫu" }).click();
    const d = dlg(page);
    await expect(d.getByTestId("template-params")).toContainText("amount");
    await expect(d.getByTestId("template-params")).toContainText("recipient_name");
    await d.getByLabel("Tiêu đề thư").fill("Phạt {{amount}} cho {{recipient_name}}");
    await d.getByRole("button", { name: "Xem trước" }).click();
    await expect(d.getByTestId("template-preview")).toContainText("Phạt [amount] cho Nguyễn Văn A");
    await expect(d.getByTestId("template-preview")).toContainText("Dữ liệu giả, không gửi thư thật");

    // Tham số ngoài danh sách cho phép: BE từ chối cả xem trước lẫn lưu.
    await d.getByLabel("Nội dung thư").fill("Xin chào {{khong_hop_le}}");
    await d.getByRole("button", { name: "Xem trước" }).click();
    await expect(d).toContainText("tham số không được phép");
    await d.getByRole("button", { name: /Lưu phiên bản mới$/ }).click();
    await expect(d).toContainText("tham số không được phép");

    await d.getByRole("button", { name: "Chèn tham số reason" }).click();
    await d.getByLabel("Nội dung thư").fill("Bạn bị phạt {{amount}}. Lý do: {{reason}}.");
    await d.getByRole("button", { name: /Lưu phiên bản mới$/ }).click();
    await expect(page.getByText("Đã lưu mẫu (phiên bản mới).")).toBeVisible();
    const updated = main(page).getByRole("row", { name: /Phát sinh tiền phạt/ });
    await expect(updated).toContainText("Của đơn vị");
    await expect(updated).toContainText("Phạt {{amount}} cho {{recipient_name}}");
  });

  test("cú pháp {{ sai bị từ chối bằng thông điệp tiếng Việt", async ({ page }) => {
    await gotoAs(page, "notiadmin", "/admin/notifications?tab=templates");
    await main(page).getByRole("row", { name: /Hợp đồng sắp hết hạn/ }).getByRole("button", { name: "Sửa mẫu" }).click();
    const d = dlg(page);
    await d.getByLabel("Nội dung thư").fill("Hợp đồng {{contract_name hết hạn");
    await d.getByRole("button", { name: /Lưu phiên bản mới$/ }).click();
    await expect(d).toContainText("sai cú pháp");
  });
});

test.describe("thông báo (admin): lịch sử gửi", () => {
  test("danh sách che địa chỉ, có phân trang; lọc theo trạng thái và loại; lỗi hiện bằng mã đã dịch", async ({ page }) => {
    await gotoAs(page, "notiadmin", "/admin/notifications?tab=deliveries");
    const t = main(page).getByTestId("deliveries-tab");
    await expect(t).toContainText(/\d+ lượt gửi/);
    await expect(t.getByRole("row", { name: /n\*\*\*@gmail\.com/ }).first()).toBeVisible();
    await expect(t).not.toContainText(/[a-z0-9]{2}@gmail/); // không lộ địa chỉ đầy đủ
    await gotoAs(page, "notiadmin", "/admin/notifications?tab=deliveries&page=2");
    await expect(main(page).getByTestId("deliveries-tab").getByRole("row").nth(1)).toBeVisible();

    await gotoAs(page, "notiadmin", "/admin/notifications?tab=deliveries&status=SKIPPED");
    const skipped = main(page).getByRole("row", { name: /Bỏ qua/ }).first();
    await expect(skipped).toContainText("Người nhận đã tắt");
    await expect(main(page).getByRole("row", { name: /Đã gửi/ })).toHaveCount(0);

    await gotoAs(page, "notiadmin", "/admin/notifications?tab=deliveries&status=RETRY&type=FINE_ISSUED");
    const retry = main(page).getByRole("row", { name: /Chờ thử lại/ }).first();
    await expect(retry).toContainText("Hết thời gian chờ");
    await expect(retry).toContainText("Phát sinh tiền phạt");
  });

  test("gửi lại thư DEAD qua giao diện: xác nhận, báo thành công, lượt chuyển sang Chờ gửi và hết nút Gửi lại", async ({ page }) => {
    await gotoAs(page, "notiadmin", "/admin/notifications?tab=deliveries&type=INVOICE_ISSUED&status=DEAD");
    const row = main(page).getByRole("row", { name: /k\*\*\*@hotmail\.com/ });
    await expect(row).toContainText("Thất bại hẳn");
    await expect(row).toContainText("Máy chủ thư từ chối hẳn (5xx)");
    await row.getByRole("button", { name: "Gửi lại" }).click();
    await page.getByRole("button", { name: "Gửi lại", exact: true }).last().click();
    await expect(page.getByText("Đã xếp lại hàng chờ gửi.")).toBeVisible();
    await gotoAs(page, "notiadmin", "/admin/notifications?tab=deliveries&type=INVOICE_ISSUED");
    const after = main(page).getByRole("row", { name: /k\*\*\*@hotmail\.com/ });
    await expect(after).toContainText("Chờ gửi");
    await expect(after.getByRole("button", { name: "Gửi lại" })).toHaveCount(0);
  });

  test("API: gửi lại lượt không phải DEAD hoặc lần hai là 409 DELIVERY_NOT_RETRYABLE; id lạ là 404", async ({ page }) => {
    const h = await hdr(page, "notiadmin");
    const first = await page.request.post(`/api/notification-deliveries/${DEAD_B}/retry`, { headers: h });
    const second = await page.request.post(`/api/notification-deliveries/${DEAD_B}/retry`, { headers: h });
    expect([200, 409]).toContain(first.status());
    expect(second.status()).toBe(409);
    expect((await second.json()).code).toBe("DELIVERY_NOT_RETRYABLE");
    const missing = await page.request.post(`/api/notification-deliveries/${crypto.randomUUID()}/retry`, { headers: h });
    expect(missing.status()).toBe(404);
    expect(DEAD_A).toBeTruthy();
  });

  test("tenant chưa có lượt gửi nào: trạng thái rỗng; người chỉ xem không có nút Gửi lại", async ({ page }) => {
    await gotoAs(page, "notiempty", "/admin/notifications?tab=deliveries");
    await expect(main(page).getByText("Chưa có lượt gửi nào.")).toBeVisible();
    await gotoAs(page, "notiview", "/admin/notifications?tab=deliveries&status=DEAD");
    await expect(main(page).getByRole("button", { name: "Gửi lại" })).toHaveCount(0);
    await expect(main(page).getByRole("columnheader", { name: "Thao tác" })).toHaveCount(0);
  });
});

test.describe("thông báo: tùy chọn nhận trong hồ sơ", () => {
  test("nhóm bắt buộc không tắt được; tắt nhóm thường, lưu rồi tải lại vẫn giữ", async ({ page }) => {
    await gotoAs(page, "notipref1", "/profile");
    const card = main(page).getByTestId("notification-preferences");
    await expect(card).toBeVisible();
    for (const name of ["Tài khoản qua Email", "Hoàn tiền qua Email"]) {
      await expect(card.getByRole("switch", { name })).toBeDisabled();
      await expect(card.getByRole("switch", { name })).toBeChecked();
    }
    await expect(card.getByText("Bắt buộc, không tắt được")).toHaveCount(2);
    const save = card.getByRole("button", { name: "Lưu tùy chọn" });
    await expect(save).toBeDisabled();
    await card.getByRole("switch", { name: "Nhắc hạn mượn sách qua Email" }).click();
    await expect(card).toContainText("1 thay đổi chưa lưu");
    await save.click();
    await expect(page.getByText("Đã lưu tùy chọn nhận thông báo.")).toBeVisible();
    await page.reload();
    await expect(main(page).getByTestId("notification-preferences").getByRole("switch", { name: "Nhắc hạn mượn sách qua Email" })).not.toBeChecked();
    await expect(main(page).getByTestId("notification-preferences").getByRole("switch", { name: "Đơn hàng qua Email" })).toBeChecked();
  });

  test("API: tắt nhóm bắt buộc bị từ chối cả yêu cầu bằng 400 PREFERENCE_MANDATORY, không ghi gì", async ({ page }) => {
    const h = await hdr(page, "notipref2");
    const bad = await page.request.put("/api/notifications/me/preferences", {
      headers: h,
      data: { items: [{ category: "ORDER", channel: "EMAIL", enabled: false }, { category: "REFUND", channel: "EMAIL", enabled: false }] },
    });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).code).toBe("PREFERENCE_MANDATORY");
    const cur = (await (await page.request.get("/api/notifications/me/preferences", { headers: h })).json()) as { category: string; enabled: boolean }[];
    expect(cur.find((p) => p.category === "ORDER")?.enabled).toBe(true);
  });
});
