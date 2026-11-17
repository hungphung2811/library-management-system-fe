import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { PORTS, url } from "./ports";

/** Origin của app web (vite preview), cũng là baseURL của test. */
export const WEB = url(PORTS.web);
/** Origin của mock gateway (thay lms-api). Test thường gọi API qua WEB (`/api/...`, proxy), chỉ dùng cái này khi cần chạm thẳng mock. */
export const GATEWAY = url(PORTS.gateway);

/** Khóa localStorage giữ refresh token của SPA (src/api/token-store.ts). */
export const REFRESH_KEY = "lms_rt";

/** Đơn vị (tenant) của mock, khớp e2e/mock/data.mjs. */
export const TENANT_A = "11111111-1111-4111-8111-111111111111";
export const TENANT_B = "22222222-2222-4222-8222-222222222222";

export const USERS = {
  /** Quản trị viên: claim admin=true, không có permission nào. */
  admin: { username: "admin", password: "Admin@12345" },
  /** Thủ thư kiểu cũ: có khóa AccessControlController/listRoles và BorrowingController/borrow, không phải admin. */
  staff: { username: "staff", password: "Staff@12345" },
  member: { username: "member", password: "Member@12345" },
  /** Phải đổi mật khẩu (mật khẩu tạm). Không bao giờ đổi mật khẩu trong test. */
  newbie: { username: "newbie", password: "Temp@12345" },
  /** Phải đổi mật khẩu; dành riêng cho test đổi mật khẩu thật (mock không tự khôi phục, chạy một lần). */
  newbie2: { username: "newbie2", password: "Temp@12345" },
  /** Thủ thư đầy đủ: catalog + circulation + tìm người dùng + xem hồ sơ độc giả, không phải admin. */
  librarian: { username: "librarian", password: "Librarian@12345" },
  /** Độc giả: tra sách, xem chi tiết, đặt trước. */
  reader: { username: "reader", password: "Reader@12345" },
  /** Thuộc 2 đơn vị (dùng cho test chuyển đơn vị); chuyển đơn vị làm đổi trạng thái mock dùng chung, đừng giả định đơn vị hiện tại. */
  multi: { username: "multi", password: "Multi@12345" },
  /** Thủ thư mượn trả đầy đủ + phạt (xem/thu) + tìm người dùng (gắn trong e2e/mock/circulation.mjs). */
  clerk: { username: "clerk", password: "Clerk@12345" },
  /** Chỉ xem phạt của độc giả, không có quyền thu phạt (gắn trong e2e/mock/circulation.mjs). */
  finelook: { username: "finelook", password: "Finelook@12345" },
  /** Như multi, riêng cho test chuyển đơn vị qua giao diện (tránh đua trạng thái với test API dùng multi). */
  multi2: { username: "multi2", password: "Multi2@12345" },
  /** Platform admin: token không có tenantId, claim platformAdmin (CMS, yêu cầu liên hệ). */
  platform: { username: "platform", password: "Platform@12345" },
  /** Xem và sửa mô tả/preview đầu sách (TitleController/preview + updatePreview). */
  previewer: { username: "previewer", password: "Previewer@12345" },
  /** Chỉ xem mô tả/preview, không sửa. */
  previewviewer: { username: "previewviewer", password: "Previewviewer@12345" },
  /** Thu ngân: module SALES, chỉ bán tại quầy (không giảm giá) + xem tồn + in phiếu + tra sách (e2e/mock/sales.mjs). */
  seller: { username: "seller", password: "Seller@12345" },
  /** Quản lý bán hàng: mọi khóa SALES trừ xem liên hệ đầy đủ (e2e/mock/sales.mjs). */
  salesmgr: { username: "salesmgr", password: "Salesmgr@12345" },
  /** Admin có module SALES (e2e/mock/sales.mjs). */
  salesadmin: { username: "salesadmin", password: "Salesadmin@12345" },
  /** Thu ngân thao tác đơn online + trả trong hạn; KHÔNG có hủy đơn, áp giảm giá, trả quá hạn, hoàn tiền, nhật ký (e2e/mock/sales.mjs). */
  cashier: { username: "cashier", password: "Cashier@12345" },
  /** Quản trị của đơn vị chưa có hợp đồng nào (e2e/mock/platform-contracts.mjs). */
  nocontract: { username: "nocontract", password: "Nocontract@12345" },
} as const;

export type UserKey = keyof typeof USERS;

type Tokens = { accessToken: string; refreshToken: string; mustChangePassword: boolean };

/**
 * Gọi POST /api/auth/login (qua proxy của app, như SPA làm) và trả cặp token.
 * Dùng khi test cần gọi API trực tiếp (`request.get("/api/...", { headers: bearer(t) })`) hoặc kiểm claim.
 */
export async function loginApi(request: APIRequestContext, user: UserKey): Promise<Tokens> {
  const res = await request.post("/api/auth/login", { data: USERS[user] });
  expect(res.ok(), `đăng nhập ${user} qua API`).toBeTruthy();
  return (await res.json()) as Tokens;
}

/** Header Authorization cho `request`/`page.request`. */
export const bearer = (t: Pick<Tokens, "accessToken">) => ({ Authorization: `Bearer ${t.accessToken}` });

/** Giải mã payload JWT (không verify) để kiểm claim như tenantId, admin, permissions. */
export function claimsOf(accessToken: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
}

/**
 * Đăng nhập NHANH, không qua form: lấy refresh token từ API rồi ghi vào localStorage (`lms_rt`).
 * SPA khi boot thấy `lms_rt` mà chưa có access token thì tự gọi /api/auth/refresh, nên chỉ cần `page.goto(...)` sau đó.
 * Access token chỉ nằm trong bộ nhớ của trang, nên mỗi lần goto/reload đều đi qua refresh (giống người dùng F5).
 * Gọi lại với user khác trong cùng page để đổi người (ghi đè `lms_rt`). Trả Tokens để test dùng tiếp nếu cần.
 * Ghi chú: ghi localStorage cần một trang cùng origin; hàm tự mở `/favicon.svg` (nhẹ, không chạy SPA) để ghi.
 */
export async function loginAs(page: Page, user: UserKey): Promise<Tokens> {
  const tokens = await loginApi(page.request, user);
  await page.goto("/favicon.svg");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [REFRESH_KEY, tokens.refreshToken]);
  return tokens;
}

/** Đã có `lms_rt` trong localStorage của trang hiện tại không (dùng để kiểm đăng xuất xóa phiên). */
export const hasRefreshToken = (page: Page) =>
  page.evaluate((k) => localStorage.getItem(k) !== null, REFRESH_KEY);

/**
 * Mở trang login và đợi nó sẵn sàng. Nếu thao tác khi React chưa hydrate/boot xong thì nút bấm không có tác dụng
 * (flaky khi máy tải nặng); chờ ô "Tên đăng nhập" hiện (SPA render form sau khi boot) và networkidle (các chunk JS đã tải).
 */
export async function openLogin(page: Page, query = "") {
  await page.goto(`/login${query}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByPlaceholder("Nhập tên đăng nhập")).toBeVisible();
}

/** Đăng nhập BẰNG FORM trên trang login (đang ở /login), rồi bấm "Đăng nhập". Không đợi điều hướng, test tự kiểm URL. */
export async function submitLogin(page: Page, username: string, password: string) {
  await page.getByPlaceholder("Nhập tên đăng nhập").fill(username);
  await page.getByPlaceholder("Nhập mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

/** Mở /login, đăng nhập bằng form như người dùng thật (đường dẫn `next` tùy chọn). Dùng khi muốn kiểm luồng form. */
export async function login(page: Page, user: UserKey, next?: string) {
  await openLogin(page, next ? `?next=${encodeURIComponent(next)}` : "");
  await submitLogin(page, USERS[user].username, USERS[user].password);
}

/**
 * Đăng nhập nhanh rồi vào `path` và đợi khung ứng dụng sẵn sàng (hết màn hình chờ boot, thấy sidebar và <main>).
 * Không dùng cho trang ngoài khung (/change-password, /login): dùng loginAs + page.goto.
 */
export async function gotoAs(page: Page, user: UserKey, path = "/") {
  await loginAs(page, user);
  await gotoApp(page, path);
}

/** Vào `path` (đã có phiên) và đợi khung ứng dụng: sidebar `nav` và `<main>` hiện. */
export async function gotoApp(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
}

/** Sidebar chính (chỉ có một <nav>). */
export const sidebar = (page: Page): Locator => page.getByRole("navigation", { name: "Điều hướng chính" });

/** Mở menu người dùng ở header (nút "Tài khoản của tôi"). */
export async function openUserMenu(page: Page) {
  await page.getByRole("button", { name: "Tài khoản của tôi" }).click();
}

/** Đăng xuất qua menu người dùng ở header (không còn nút đăng xuất trong sidebar). */
export async function logoutViaMenu(page: Page) {
  await openUserMenu(page);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
}

/**
 * Đánh dấu "SPA chưa tải lại": đặt cờ trên window; sau khi điều hướng, cờ còn nghĩa là chuyển trang phía client
 * (react-router), mất nghĩa là đã tải lại cả trang.
 */
export const markSpa = (page: Page) => page.evaluate(() => ((window as unknown as { __spa?: number }).__spa = 1));
export const readSpa = (page: Page) => page.evaluate(() => (window as unknown as { __spa?: number }).__spa);
