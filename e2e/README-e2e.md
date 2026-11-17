# E2E Playwright cho apps/web (Vite SPA)

Hai server do `playwright.config.ts` dựng: mock gateway (`e2e/mock-gateway.mjs`, cổng base+1) và `vite preview` phục vụ bản build `apps/web/dist` (cổng base), proxy `/api` về mock. Test chạy trên origin của web (`baseURL`), gọi API qua `/api/...` như SPA.

## Chạy

```bash
npm run build -w @lms/web                       # BẮT BUỘC sau mỗi lần sửa apps/web/src (test chạy trên bản build)
npx playwright test e2e/auth.spec.ts            # một file
npx playwright test e2e/auth.spec.ts -g "next"  # một test theo tên
npm run test:e2e                                # build + toàn bộ (catalog/circulation/admin chỉ chạy được sau khi viết lại)
npm run typecheck:e2e
```

- Cổng: `E2E_PORT_BASE` (mặc định 4200) = web, base+1 = mock. Nhiều agent/phiên chạy cùng lúc thì mỗi bên một base cách nhau từ 2 trở lên, ví dụ 4200, 4300, 4400, 4500 (PowerShell: `$env:E2E_PORT_BASE=4300; npx playwright test ...`; bash: `E2E_PORT_BASE=4300 npx playwright test ...`). Kết quả/báo cáo ghi vào `test-results/<base>` và `playwright-report/<base>`, không đè nhau.
- `reuseExistingServer: false`: cổng phải trống. Build `apps/web/dist` dùng chung, đừng build lúc người khác đang chạy test.
- Mock giữ trạng thái trong bộ nhớ, dùng chung cho 2 worker: không giả định số bản ghi, mỗi test dùng dữ liệu riêng (xem `e2e/fake.mjs`), và test đổi trạng thái chung (đổi đơn vị, đổi mật khẩu) phải trả lại hoặc dùng user riêng.

## Helper (`e2e/helpers.ts`)

| Tên | Việc |
|---|---|
| `USERS`, `UserKey` | Tài khoản mock: `admin` (admin=true), `staff` (listRoles+borrow), `member` (không khóa), `newbie`/`newbie2` (phải đổi mật khẩu; newbie2 để đổi thật), `librarian`, `reader`, `multi` (test API 2 đơn vị), `multi2` (test UI đổi đơn vị) |
| `loginAs(page, user)` | Đăng nhập NHANH: gọi `/api/auth/login`, ghi `lms_rt` vào localStorage. Sau đó `page.goto(...)`; SPA tự refresh lúc boot. Dùng gần như mọi nơi |
| `gotoApp(page, path)` | `goto` rồi đợi sidebar và `<main>` (khung ứng dụng sẵn sàng). Không dùng cho `/login`, `/change-password` |
| `gotoAs(page, user, path)` | `loginAs` + `gotoApp` |
| `openLogin(page, query?)` | Mở `/login`, đợi form và networkidle |
| `submitLogin(page, u, p)` / `login(page, user, next?)` | Đăng nhập bằng form (kiểm luồng form) |
| `loginApi(request, user)` | Gọi API đăng nhập, trả `{accessToken, refreshToken, mustChangePassword}` |
| `bearer(tokens)`, `claimsOf(jwt)` | Header Authorization; giải mã claim |
| `sidebar(page)`, `openUserMenu(page)`, `logoutViaMenu(page)` | Sidebar `nav`; menu "Tài khoản của tôi" ở header; đăng xuất |
| `hasRefreshToken(page)` | Còn `lms_rt` không |
| `markSpa` / `readSpa` | Dấu hiệu "chưa tải lại trang" để kiểm điều hướng phía client |
| `WEB`, `GATEWAY`, `TENANT_A`, `TENANT_B`, `REFRESH_KEY` | Hằng số |

## Ghi chú về giao diện app Vite (khác bản Next cũ)

- Login: placeholder `Nhập tên đăng nhập` / `Nhập mật khẩu`. Lỗi đăng nhập là `.ant-alert-error`.
- Đăng xuất và đổi đơn vị nằm ở header (menu "Tài khoản của tôi", bộ chọn "Đơn vị làm việc: ..."), sidebar không có khối người dùng. Mọi nhóm sidebar mở sẵn.
- Strict mode: `Trang chủ`/`Về trang chủ` khớp cả logo ("Thư viện, về trang chủ"): dùng `{ exact: true }`. `Đổi mật khẩu` có cả ô trang chủ và menu: scope bằng `.ant-dropdown`.
- Mock còn thiếu các endpoint do nhóm nghiệp vụ tự bổ sung vào `e2e/mock/*.mjs` (xem README ở agent nhóm): `GET /api/borrowings/search`, `GET /api/fines`, `/api/fines/mine`, `POST /api/fines/payments`.
