# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FE của hệ thống quản lý thư viện: **một SPA** React 19 + Vite 7 + TypeScript (một package ở gốc repo, không còn npm workspaces), UI bằng antd 6 + Tailwind v4, routing bằng react-router v7 (`createBrowserRouter`), dữ liệu bằng `@tanstack/react-query`. Không SSR. BE ở repo anh em `../library-management-system` (Spring Boot, xem CLAUDE.md và ADR-0003/0004 ở đó). README.md có bảng cấu trúc và cách deploy; quyết định chuyển đổi và lý do ở `docs/design/2026-11-17-chuyen-vite-spa.md`.

## Lệnh thường dùng

```bash
npm install
npm run dev                              # http://localhost:3000, proxy /api -> http://localhost:8085
npm run dev -- --port 3100   # cổng khác (khi 3000 đang bận)
npm run typecheck
npm run build                # tsc --noEmit + vite build -> dist/
npm run preview              # phục vụ dist/ với cùng proxy (thêm -- --port 3000 --strictPort nếu cần)
npm run typecheck:e2e                    # typecheck thư mục e2e/
npm run test:e2e                         # build rồi chạy Playwright
npm run test:e2e:only                    # chỉ chạy test, dùng bản build sẵn (dist)
npx playwright test e2e/auth.spec.ts     # một file (hoặc -g "tên test"); khởi động 2 server mất vài giây
```

- Không có lint. Kiểm tra gồm `typecheck` và E2E Playwright.
- Đích proxy `/api` đổi bằng biến `VITE_API_TARGET` (ví dụ `VITE_API_TARGET=http://localhost:8080 npm run dev`). Mặc định là lms-api `http://localhost:8085`. Cần BE thật chạy (repo BE: `scripts/dev-start.ps1`, hoặc `docker compose --profile apps up -d --build` rồi trỏ `VITE_API_TARGET` tới nginx 8080). Dev account: `admin` / `Admin@12345`.
- E2E chạy trên bản **build tĩnh** của app (`vite preview` + proxy `/api` -> mock, qua `VITE_API_TARGET`), BE được thay bằng `e2e/mock-gateway.mjs` (user `admin` (admin=true), `staff` (có khóa), `member`, `newbie`/`newbie2` (phải đổi mật khẩu), `librarian`, `reader`, `multi`/`multi2` (2 đơn vị)), không cần docker. Chỉ 2 server: web ở `E2E_PORT_BASE` (mặc định 4200) và mock ở base+1; không đụng 3000/3100/8085-8090. Chạy song song nhiều bộ thì đặt `E2E_PORT_BASE` khác nhau (4200, 4300...). Sửa code `apps/web` thì phải build lại (`test:e2e` đã tự build). Helper và cách đăng nhập nhanh (`loginAs`: ghi `lms_rt`) xem `e2e/README-e2e.md`.
- `workers: 2` là chủ ý (mỗi worker một Chromium). Test form login phải mở trang bằng `openLogin` (đợi sẵn sàng). Cả bộ e2e (26 file spec, 266 test, gồm catalog/circulation/admin) đã chạy được trên app Vite; `platform.spec.ts` "mô tả và đoạn đọc thử" từng fail một lần khi chạy song song (hai test cùng ghi mô tả của một sách trong mock), chạy lại đơn lẻ thì pass.

## Kiến trúc

Mã nguồn app nằm ở gốc repo (`src/`, `index.html`, `vite.config.ts`); trình duyệt chỉ cầm SPA tĩnh và gọi `/api/**` cùng origin (dev qua proxy Vite, production qua nginx). Mọi link là route client, không còn khái niệm zone hay `basePath`.

```
(gốc repo)
  index.html, vite.config.ts, tsconfig.json (alias @/ -> src)
  src/
    main.tsx          gốc: RootErrorBoundary > Providers > RouterProvider
    index.css         Tailwind + CSS layer + token thương hiệu + CSS in phiếu (data-print-scope)
    api/              errors, session (decode JWT bằng atob, can), permissions (PERMISSIONS),
                      token-store, client (apiFetch, refresh), hooks (useApi, useApiMutation), index
    auth/             AuthProvider (useAuth/useSession/useTenants), ProtectedRoute (+ BootScreen, safeNext)
    ui/               điểm vào duy nhất "@/ui": antd, icon, Providers, AppShell/ShellFrame, DataTable,
                      SearchBar, FormModal, ConfirmAction, ScanInput, RemoteSelect, QueryBoundary,
                      LinkButton, ErrorPanel, NoPermission, PageSkeleton, StatusTag, KeyValueList, format...
    routes/router.tsx khai báo MỌI đường dẫn
    pages/            Home, Login, ChangePassword, Profile, Notifications, NotFound, RouteError
                      catalog/, circulation/, admin/ (theo nhóm, xem "Việc chuyển đổi" về tiến độ port)
```

Import trong trang: `@/ui` (UI), `@/api` (`apiFetch`, `useApi`, `useApiMutation`, `PERMISSIONS`, `can`, `toErrorInfo`, `ApiCallError`, `useSession`), `@/auth/AuthProvider` (cùng hook phiên).

### Tuyến đường và khung

- `/login` công khai. `/change-password` dưới `ProtectedRoute allowMustChange` (ngoài khung). Mọi trang còn lại: `ProtectedRoute` > `AppShell` (layout route, `<Outlet/>`) > trang.
- `ProtectedRoute` đợi boot xong (`BootScreen`); chưa đăng nhập thì `/login?next=<đường dẫn+query>`; `mustChangePassword` thì `/change-password`. `safeNext` chỉ nhận đường dẫn bắt đầu bằng `/` và không phải `//` (chống open redirect); giữ nguyên khi sửa.
- Nhóm `catalog`, `circulation`, `admin` dùng `React.lazy` + `Suspense` (skeleton chỉ thay vùng nội dung, khung giữ nguyên); `vite.config.ts` gom chunk theo thư mục `pages/<nhóm>`.
- Tiêu đề tab lấy từ `handle.title` của route khớp sâu nhất. Lỗi của trang: `errorElement` trong khung (giữ sidebar).
- Nav: `DEFAULT_NAV_LINKS` trong `ui/nav-links.ts` (Sách, Mượn trả, Bán hàng, Quản trị, Nền tảng SaaS), mục thêm thì sửa file này và `ICONS` trong `ShellFrame.tsx`; breadcrumb cho trang ngoài sidebar ở `CRUMBS` trong `ui/AppShell.tsx`. Danh sách link là hằng số trong code, không còn đọc từ biến môi trường.

### Thêm trang mới

1. Tạo component trong `src/pages/<nhóm>/` (nhóm lazy) hoặc `src/pages/`.
2. Khai báo route trong `routes/router.tsx` (đặt `handle.title`; dưới `AppShell` nếu cần khung).
3. Lấy dữ liệu bằng `useApi`, bọc `QueryBoundary`; ghi bằng `useApiMutation`. Ẩn/hiện nút theo `can(session, PERMISSIONS.x)`.
4. Cần mục sidebar thì thêm vào `nav-links.ts`.

### Xác thực (không còn BFF, không còn cookie httpOnly)

- Access token **chỉ trong bộ nhớ** (`api/token-store.ts`, đẩy vào `AuthProvider` qua `useSyncExternalStore`); refresh token ở **localStorage khóa `lms_rt`**. Boot: có `lms_rt` mà chưa có access token thì `POST /api/auth/refresh {refreshToken}` (F5 không mất phiên); BE từ chối (4xx) thì xóa phiên, lỗi mạng/5xx giữ `lms_rt`.
- `apiFetch(path, {json, ...})` gắn Bearer; 401 thì refresh một lần (gọi đồng thời dùng chung một promise) rồi gọi lại; vẫn 401 thì xóa phiên và ném `ApiCallError(401)`. 204 trả `undefined`. Bảng lỗi tiếng Việt ở `ui/error-messages.ts` (`describeError`, `toErrorInfo`, `ErrorPanel`).
- `useSession()` chỉ dùng trong vùng `ProtectedRoute`; trang công khai dùng `useSessionOptional()`. Session chỉ decode payload JWT (không verify chữ ký); BE là nơi verify và kiểm quyền. Hiển thị tên bằng claim `username`, không dùng `sub` (UUID).
- Chuyển tenant: `useAuth().switchTenant(id)` (`POST /api/auth/switch-tenant {tenantId, refreshToken}`) thay token, bỏ cache của tenant cũ, rồi điều hướng `/?switched=1`.
- Platform admin làm việc thay đơn vị (ADR-0016 ở BE): `ActingTenantPicker` (thanh trên, thay `TenantSwitcher` cho platform admin) gọi `useAuth().actAsTenant(id|null)`; id lưu ở localStorage `lms_act_tenant` (`api/acting-tenant.ts`). `apiFetch` gắn `X-Tenant-Id` khi token là platform admin, trừ `/api/auth/**`, `/api/platform/**`, `/api/cms/**` (`skipsActingTenant`). `useSession()` trả session hiệu lực (`withActingTenant` ở `api/session.ts`: `tenantId` = đơn vị đã chọn, `admin=true`, đủ module, `platformAdmin` vẫn `true`) nên khóa cache, menu và `can()` đổi theo; `useNavItems` gọi `/api/menus/me` (BE trả menu đơn vị cho platform admin kèm header) và nối thêm khu "Nền tảng SaaS". Đăng nhập/đăng xuất xóa lựa chọn. Cần BE bật kiểm quyền (`dev-start.ps1` đã bật); e2e: `e2e/platform-acting-tenant.spec.ts`.
- Đánh đổi: refresh token ở localStorage nên một lỗ XSS đọc được nó. Giảm thiểu: không dùng `dangerouslySetInnerHTML`, nên thêm CSP ở nginx, `switch-tenant`/đăng xuất thu hồi refresh token cũ.

### Dữ liệu

`useApi<T>("/api/...")` (khóa `["api", tenantId, path]`, đổi tenant là khóa mới và tự tải lại). `useApiMutation(fn, { invalidate: ["/api/x"] })` tải lại các truy vấn có path bắt đầu bằng tiền tố. `<QueryBoundary query={q}>{(data) => ...}</QueryBoundary>`: đang tải là `PageSkeleton`, lỗi là `ErrorPanel` có "Thử lại". Mặc định chỉ thử lại lỗi mạng/5xx một lần. Bộ lọc và phân trang nằm trên URL (`useSearchParams`): `SearchBar`, `DataTable` (`pagination.mode: "server"` dựng link `?page=n`). Nút trỏ route dùng `LinkButton`, không dùng `<Button href>`.

### UI: antd + Tailwind

- antd cho control, Tailwind cho layout/khoảng cách. Hai bên cùng sống nhờ CSS layer `theme, base, antd, components, utilities` (khai báo đầu `index.css`) và `<StyleProvider layer>` (`@ant-design/cssinjs`) trong `Providers`; đừng bỏ prop `layer` hay đổi thứ tự layer, preflight sẽ đè antd. Tailwind v4 qua plugin `@tailwindcss/vite` tự quét `src`, không cần `@source`.
- Import UI từ `@/ui` (antd, icon, component dùng chung). Icon điều hướng/trang dùng `lucide-react` (re-export ở `ui/icons.ts`, thêm icon mới vào đó); icon antd chỉ còn trong control của antd. Theme ở `ui/theme.ts` (token, `componentSize="small"`), font Inter (`@fontsource-variable/inter`).
- Màu thương hiệu nằm ở hai nơi phải sửa cùng lúc: `@theme` trong `index.css` và `brand`/`theme` trong `ui/theme.ts`.

### Deploy

Build tĩnh `dist/`, phục vụ bằng nginx, proxy `/api` tới lms-api (cùng origin nên không cần CORS). **Bắt buộc fallback SPA** (`try_files $uri /index.html`), nếu không F5 trên `/catalog/...` ra 404; `assets/` cache dài (tên file có hash), `index.html` không cache lâu. Mẫu cấu hình ở README.md (chưa tích hợp vào `docker-compose` của BE).

## Khu vực nghiệp vụ mới (SaaS, bán hàng)

- **platform** (`/platform/*`, chỉ platform admin: claim không có `tenantId`, trang tự chặn bằng `PlatformGate`): đơn vị (tenant, `tenants/`, chi tiết có module bật/tắt, hợp đồng, website/origin), tổ chức (`organizations/`), hợp đồng sắp hết hạn (`contracts/`), trang website CMS (`CmsPages`, `CmsPageDetail`), yêu cầu liên hệ. Thuật ngữ UI: tenant gọi là "đơn vị"; "tổ chức" chỉ dành cho organization (nhóm nhiều đơn vị). Danh sách tenant của BE không trả hợp đồng nên chưa cảnh báo "đơn vị chưa có hợp đồng". Trang CMS chưa có xem trước Markdown (node_modules chưa có react-markdown/dompurify; không thêm phụ thuộc khi chưa được duyệt), nội dung đã xuất bản hiển thị dạng văn bản thô.
- **admin** (`/admin/*`, theo đơn vị đang chọn): người dùng, vai trò (sửa/xóa role: `PUT/DELETE /api/roles/{id}`), phòng ban, nhật ký, menu (`Menus`), hợp đồng của đơn vị mình (`MyContract`, chỉ đọc), website (`StorefrontOrigins`, cần module SALES).
- **sales** (`/sales/*`, module SALES, pha 1-2: bán tại quầy, đơn hàng, hoàn tiền, nhật ký, tồn kho, phiếu nhập, nhà cung cấp, cấu hình): mỗi trang tự kiểm module và khóa (`SalesGate`); BE quyết định cuối.
- **Điều hướng động**: `ui/useNavItems.ts` lấy menu từ `GET /api/menus/me`; lỗi hoặc rỗng thì dùng `DEFAULT_NAV_LINKS`. Mục có thể khai báo `module`, `platformOnly`, `tenantOnly`, `permission` (any-of); thêm mục mới phải có route trong `routes/router.tsx` và không trùng `href` với mục khác.
- **Lỗi theo đơn vị/module**: `MODULE_NOT_ENABLED` (403, đơn vị chưa bật module; claim `modules` đổi sau khi đăng nhập/refresh lại) và `TENANT_REQUIRED` (token chưa có `tenantId`, cần chọn đơn vị) có thông điệp ở `ui/error-messages.ts`.

## Chạy E2E an toàn khi nhiều agent làm chung

- `E2E_PORT_BASE=4700 npx playwright test` (hoặc `npm run test:e2e:only` sau khi build): web ở base, mock ở base+1; mỗi agent một base cách nhau từ 2 trở lên.
- Mọi bộ E2E dùng chung `dist`. Nhiều agent chạy `npm run build` cùng lúc sẽ ghi đè/xóa dist của nhau (test lỗi 404 asset hoặc trang trắng): build xong mới chạy test, build một lần rồi dùng `test:e2e:only`, và không build trong lúc bộ test khác đang chạy. Dừng đúng tiến trình `vite preview` do mình tạo, không dừng tiến trình của agent khác.

## Phân quyền theo BE động (ADR-0003)

- Khóa quyền là `TênController/tênMethod` của controller **nội bộ** xử lý endpoint (ví dụ `AccessControlController/listRoles`, `BorrowingController/borrow`), không phải mã cố định. Danh sách FE dùng nằm ở `src/api/permissions.ts` (`PERMISSIONS`); BE đổi tên controller/method thì phải sửa ở đó (và literal trong `ui/nav-links.ts`). Quyền mới của role chỉ có hiệu lực ở lần đăng nhập/refresh kế tiếp.
- `can(session, key)` đúng khi claim `admin=true` (quản trị viên, bỏ qua kiểm khóa, thường không có permission nào) hoặc `permissions` chứa khóa. Chỉ để ẩn/hiện UI; BE trả 403 mới là quyết định cuối.
- `mustChangePassword`: token của tài khoản này không mang `admin`/`permissions`. `ProtectedRoute` chuyển sang `/change-password` (gọi `POST /api/auth/password`), đổi xong thì xoá phiên và bắt đăng nhập lại để lấy token đầy đủ.
- API cho FE đi qua `lms-api`/nginx; nhiều API nghiệp vụ trong BE đã chuyển sang `/internal/**` (nginx trả 404), FE chỉ dùng `/api/**`. Phân hệ Sách (`/catalog`) dùng `/api/books`, `/api/book-copies`.

## Việc chuyển đổi

Kiến trúc cũ (hai app Next.js multi-zone `apps/shell` + `apps/admin`, BFF `/api/bff`, cookie `httpOnly`, `@mfe/ui`, `@mfe/api`, `MFE_NAV_LINKS`, `basePath`) đã được thay hoàn toàn bằng SPA này (từng nằm ở `apps/web`, đã gộp lên gốc repo) và **đã xóa** khỏi repo (cùng `packages/*` và script `dev:legacy`); xem lại qua lịch sử git nếu cần đối chiếu. Mọi trang `catalog/`, `circulation/`, `admin/` đã port và có E2E. Chi tiết quyết định: `docs/design/2026-11-17-chuyen-vite-spa.md`. Comment kiểu "port từ apps/shell/..." trong code chỉ là dấu vết lịch sử.

## Quy ước commit

Message tiếng Việt có dấu, không thêm `Co-Authored-By` hay attribution. Dòng đầu có prefix Conventional Commits, chỉ dùng 7 loại: `feat` (tính năng, đổi hành vi/giao diện), `fix` (sửa lỗi), `docs` (chỉ tài liệu), `refactor` (đổi cấu trúc, không đổi hành vi), `test`, `chore` (công cụ, skill), `build` (build, phụ thuộc). Scope tuỳ chọn theo khu vực (`fix(web):`, `feat(ui):`, `feat(api):`); thay đổi phá vỡ hợp đồng thêm `!` (`feat(api)!:`). Commit riêng từng nhóm thay đổi. Quy ước đầy đủ ở `~/.claude/CLAUDE.md`.
