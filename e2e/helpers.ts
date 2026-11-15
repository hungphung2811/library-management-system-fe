import { expect, type Page } from "@playwright/test";
import { PORTS, url } from "./ports";

export const SHELL = url(PORTS.shell);
/** Shell thứ hai có zone admin trỏ vào cổng chết. */
export const SHELL_ZONE_DOWN = url(PORTS.shellDown);
/** Zone admin gọi thẳng cổng của nó (không qua shell). */
export const ADMIN_DIRECT = url(PORTS.admin);

export const USERS = {
  /** Quản trị viên: claim admin=true, không có permission nào. */
  admin: { username: "admin", password: "Admin@12345" },
  /** Thủ thư: có khóa AccessControlController/listRoles và BorrowingController/borrow, không phải admin. */
  staff: { username: "staff", password: "Staff@12345" },
  member: { username: "member", password: "Member@12345" },
  /** Phải đổi mật khẩu (mật khẩu tạm). Không bao giờ đổi mật khẩu trong test. */
  newbie: { username: "newbie", password: "Temp@12345" },
  /** Phải đổi mật khẩu; dành riêng cho test đổi mật khẩu thật. */
  newbie2: { username: "newbie2", password: "Temp@12345" },
  /** Thủ thư đầy đủ: catalog + circulation + tìm người dùng + xem hồ sơ độc giả, không phải admin. */
  librarian: { username: "librarian", password: "Librarian@12345" },
  /** Độc giả: tra sách, xem chi tiết, đặt trước. */
  reader: { username: "reader", password: "Reader@12345" },
  /** Thuộc 2 đơn vị (dùng cho test chuyển đơn vị); chuyển đơn vị làm đổi trạng thái mock dùng chung, đừng giả định đơn vị hiện tại. */
  multi: { username: "multi", password: "Multi@12345" },
} as const;

/**
 * Mở trang login và đợi hydrate xong. Nếu bấm nút khi React chưa hydrate thì form gửi kiểu HTML thuần
 * (test sẽ flaky khi máy tải nặng); networkidle nghĩa là các chunk JS đã tải xong.
 */
export async function openLogin(page: Page, query = "") {
  await page.goto(`/login${query}`);
  await page.waitForLoadState("networkidle");
}

/** Đăng nhập bằng API (nhanh, không qua form) rồi cookie nằm sẵn trong context của page. */
export async function loginAs(page: Page, user: keyof typeof USERS, shell = SHELL) {
  const res = await page.request.post(`${shell}/api/session/login`, { data: USERS[user] });
  expect(res.ok(), `đăng nhập ${user} qua ${shell}`).toBeTruthy();
}
