# Chuyển sang một app React + Vite (SPA)

Trạng thái: pha 1 (nền tảng) xong; pha 2/3 chưa làm. `apps/shell`, `apps/admin`, `packages/*` giữ nguyên để đối chiếu cho tới khi port xong.

## Quyết định

Bỏ Next.js multi-zone (shell + admin) và BFF, thay bằng **một SPA** `apps/web` (`@lms/web`): Vite 7, React 19, TypeScript, react-router v7 (`createBrowserRouter`, chế độ declarative/data router không SSR), antd 6, Tailwind v4 (`@tailwindcss/vite`), lucide-react, `@tanstack/react-query`.

Lý do: hai app build/deploy riêng, zone proxy, `basePath` và `<a>` thay `next/link` tốn công mà hệ thống này là công cụ nội bộ sau đăng nhập, không cần SSR/SEO. Một app thì mọi link là route client, không còn khái niệm zone, `basePath`, `assetPrefix`, `MFE_NAV_LINKS`.

## Cấu trúc `apps/web`

```
index.html, vite.config.ts, tsconfig.json (alias @/ -> src)
public/favicon.svg
src/
  main.tsx            gốc: RootErrorBoundary > Providers > RouterProvider
  index.css           Tailwind + layer + token thương hiệu + CSS in phiếu (data-print-scope)
  api/                errors, session (decode JWT bằng atob, can), permissions (PERMISSIONS),
                      token-store, client (apiFetch, refresh), hooks (useApi, useApiMutation), index
  auth/               AuthProvider (useAuth/useSession/useTenants), ProtectedRoute (+ BootScreen, safeNext)
  ui/                 index.ts là điểm vào duy nhất ("@/ui"): antd, icon, Providers, AppShell/ShellFrame,
                      DataTable, SearchBar, FormModal, ConfirmAction, ScanInput, RemoteSelect, QueryBoundary,
                      LinkButton, ErrorPanel, NoPermission, PageSkeleton, StatusTag, KeyValueList, format...
  routes/router.tsx   khai báo MỌI đường dẫn
  pages/              Home, Login, ChangePassword, Profile, Notifications, NotFound, RouteError (đã port)
                      catalog/, circulation/, admin/ (stub, xem dưới)
```

Import trong trang: `@/ui` (UI), `@/api` (`apiFetch`, `useApi`, `useApiMutation`, `PERMISSIONS`, `can`, `toErrorInfo`, `ApiCallError`, `useSession`), `@/auth/AuthProvider` (cùng hook phiên). Khác với bản cũ: không còn `@mfe/ui`, `@mfe/api`.

### Tuyến đường và khung

- `/login` công khai. `/change-password` dưới `ProtectedRoute allowMustChange` (ngoài khung). Mọi trang còn lại: `ProtectedRoute` > `AppShell` (layout route, `<Outlet/>`) > trang.
- `ProtectedRoute`: đợi boot xong (màn hình chờ `BootScreen`), chưa đăng nhập -> `/login?next=<đường dẫn+query>`; `mustChangePassword` -> `/change-password`. `safeNext` chỉ nhận đường dẫn bắt đầu bằng `/` và không phải `//` (chống open redirect).
- Nhóm `catalog`, `circulation`, `admin` dùng `React.lazy` + `Suspense` (skeleton chỉ thay vùng nội dung, khung giữ nguyên). `vite.config.ts` gom chunk theo thư mục `pages/<nhóm>`, thư viện vào `vendor`, phần còn lại của `src` vào chunk chính.
- Tiêu đề tab lấy từ `handle.title` của route khớp sâu nhất. Lỗi của trang: `errorElement` trong khung (giữ sidebar); lỗi ngoài khung và lỗi `Providers` có lưới an toàn riêng.
- Nav: chỉ `DEFAULT_NAV_LINKS` (`ui/nav-links.ts`) gồm Sách, Mượn trả, Quản trị (`/admin/...` cùng app), mở sẵn mọi nhóm. Breadcrumb cho trang ngoài sidebar ở `CRUMBS` trong `ui/AppShell.tsx`. Thêm mục nav thì sửa `nav-links.ts` và `ICONS` trong `ShellFrame.tsx`.

## Xác thực (không còn BFF)

SPA gọi thẳng `/api/**` cùng origin; dev đi qua proxy Vite, production qua nginx.

- Access token **chỉ trong bộ nhớ** (`api/token-store.ts`; `useSyncExternalStore` đẩy vào `AuthProvider`). Refresh token ở **localStorage khóa `lms_rt`**.
- Boot: có `lms_rt` mà chưa có access token -> `POST /api/auth/refresh {refreshToken}`; xong mới quyết định chuyển trang (F5 không mất phiên). Refresh bị BE từ chối (4xx) thì xóa phiên; lỗi mạng/5xx giữ `lms_rt` để thử lại.
- `apiFetch(path, {json, ...})` gắn Bearer; 401 -> refresh một lần (mọi lời gọi đồng thời dùng chung một promise) rồi gọi lại; vẫn 401 -> xóa phiên (ProtectedRoute đưa về `/login?next=`) và ném `ApiCallError(401)`. 204 trả `undefined`. Lỗi ném `ApiCallError`; bảng lỗi tiếng Việt ở `ui/error-messages.ts` (`describeError`, `toErrorInfo`, `ErrorPanel`) giữ nguyên.
- Endpoint BE dùng: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout {refreshToken}` (best-effort), `/api/auth/switch-tenant {tenantId, refreshToken}` (cần Bearer, thu hồi token cũ, trả token mới), `/api/auth/password`, `/api/me/tenants`.
- `useSession()` trả `Session` (userId, username, roles, permissions, departmentId, tenantId, admin, mustChangePassword, accessToken) và **chỉ dùng trong vùng ProtectedRoute**; trang công khai dùng `useSessionOptional()`. `can(session, key)` và `PERMISSIONS` copy nguyên từ bản cũ (đổi tên controller/method ở BE thì sửa `api/permissions.ts`).
- Chuyển tenant: `useAuth().switchTenant(id)` thay token, bỏ cache dữ liệu của tenant cũ, rồi điều hướng `/?switched=1`. Giao diện giữ `TenantSwitcher` (header) và `TenantSwitchModal` (menu người dùng, khi có từ 2 đơn vị).

### Đánh đổi bảo mật

Cookie `httpOnly` của bản cũ chống đọc token từ JS. Lưu refresh token ở localStorage thì **một lỗ XSS đọc được refresh token** và dùng được tới khi hết hạn/bị thu hồi. Giảm thiểu: access token chỉ ở bộ nhớ và ngắn hạn; React escape mặc định, không dùng `dangerouslySetInnerHTML`; nên thêm CSP ở nginx; `switch-tenant`/đăng xuất thu hồi refresh token cũ; BE vẫn là nơi kiểm quyền. Nếu cần mạnh hơn: BE đặt refresh token ở cookie `httpOnly` + `SameSite` và có endpoint refresh đọc cookie (ngoài phạm vi pha này). Hệ quả khác: luồng liên kết OIDC cần cookie `lms_ext` do BE đặt (nút "Liên kết" vẫn chưa có như bản cũ).

## Dữ liệu

`useApi<T>("/api/...")` (react-query; khóa `["api", tenantId, path]`, nên đổi tenant là khóa mới và tự tải lại). `useApiMutation(fn, { invalidate: ["/api/x"] })` tải lại các truy vấn có path bắt đầu bằng tiền tố. `<QueryBoundary query={q}>{(data) => ...}</QueryBoundary>`: đang tải = `PageSkeleton` (đổi bằng `skeleton`), lỗi = `ErrorPanel` có "Thử lại". Mặc định chỉ thử lại lỗi mạng/5xx một lần. Bộ lọc và phân trang nằm trên URL (`useSearchParams`): `SearchBar`, `DataTable` (`pagination.mode: "server"` dựng link `?page=n`; cột có thêm `render` tuỳ ý; `kind: "link"` dùng `Link`). Nút trỏ route dùng `LinkButton` thay vì `<Button href>`.

Lưu ý khi port: `app/api/session/*`, `bffFetch`, `gatewayFetch`, `requireSession`, `getSession`, `router.refresh()` không còn. Server component gọi `gatewayFetch` thành client page dùng `useApi`; `router.refresh()` thành `invalidate` hoặc `refetch`.

## CSS và theme

Giữ nguyên: `@layer theme, base, antd, components, utilities` ở đầu `index.css`; `<StyleProvider layer>` (`@ant-design/cssinjs`) thay `AntdRegistry layer`, đừng bỏ prop `layer`; `ui/theme.ts` (token, `componentSize="small"`, cỡ heading), font Inter (`@fontsource-variable/inter`). Màu thương hiệu vẫn ở hai nơi (`@theme` trong `index.css` và `brand`/`theme` trong `ui/theme.ts`). Tailwind v4 qua plugin Vite tự quét `src`, không cần `@source`.

## Chạy và deploy

```bash
npm install
npm run dev                          # = npm run dev -w @lms/web, http://localhost:3000, proxy /api -> http://localhost:8085
npm run dev -w @lms/web -- --port 3100   # cổng khác (khi 3000 đang bận)
npm run typecheck -w @lms/web
npm run build -w @lms/web            # tsc + vite build -> apps/web/dist/
npm run preview -w @lms/web          # phục vụ dist/ với cùng proxy
npm run dev:legacy                   # chạy hai app Next cũ (shell + admin)
```

Đổi đích proxy: biến `VITE_API_TARGET` (ví dụ `VITE_API_TARGET=http://localhost:8080 npm run dev`). Cần BE chạy (lms-api 8085); dev account `admin` / `Admin@12345`.

Production: build tĩnh `apps/web/dist/`, phục vụ bằng nginx, proxy `/api` tới lms-api (cùng origin nên không cần CORS). **Bắt buộc fallback SPA**, nếu không F5 trên `/catalog/...` ra 404:

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;          # nội dung apps/web/dist
  location /api/ { proxy_pass http://lms-api:8085; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }
  location / { try_files $uri /index.html; }
}
```

`index.html` không nên cache lâu (tên file trong `assets/` có hash). Ví dụ trên là bản tham khảo, chưa tích hợp vào `docker-compose` của BE.

## Kiểm chứng pha 1

Đã chạy thật (Vite cổng 3100, BE thật): typecheck và build sạch; chưa đăng nhập vào `/catalog` bị đẩy về `/login?next=%2Fcatalog`; đăng nhập admin thì quay về `/catalog` với khung và menu mở sẵn mọi nhóm; tải lại `/profile` vẫn còn phiên; đổi tenant ở header đổi tên đơn vị và giữ sau khi tải lại; đăng xuất xóa `lms_rt` và về `/login`; 404 hiện trong khung. Chưa kiểm: `mustChangePassword` trên BE thật (không có tài khoản tái hiện), 401 giữa phiên khi access token hết hạn (code có, chưa ép hết hạn), `TenantSwitchModal` (menu "Chuyển đơn vị"), thông báo (BE trả 503 cho `/api/notifications/me` lúc thử, cùng như bản cũ vì support-service không lên), e2e Playwright (chưa viết lại).

## Việc còn lại

Pha 2 (port trang; mỗi stub trong `src/pages/<nhóm>/` có ghi đường dẫn nguồn cũ ở dòng đầu; không sửa `router.tsx` trừ khi thêm route):

- `catalog/`: `CatalogList`, `BookNew`, `BookDetail`, `Barcode` (kèm `_components` cũ: BooksTable, CopiesPanel, NewBookForm, ReserveButton, BarcodeLookup...).
- `circulation/`: `CirculationHome`, `Borrow`, `Return`, `Borrowings`, `BorrowingDetail`, `Reservations`, `Fines` (kèm BorrowDesk, ReturnDesk, LookupForm, FineReaderPicker, CollectFinesButton, `_lib/circulation.ts`; giữ `data-print-scope` đã có ở layout route cho in phiếu).
- `admin/`: `AdminHome`, `Users`, `UserDetail`, `Roles`, `RoleDetail`, `Departments`, `AuditLogs` (kèm các `_components` và `data.ts` cũ).

Pha 3: viết lại e2e Playwright cho SPA (mock gateway giữ được: `/api/auth/*` khớp; cấu hình `playwright.config.ts` và `e2e/ports.ts` đang dựng 4 server Next, cần đổi sang `vite preview` + mock ở 8090 qua `VITE_API_TARGET`); sau đó xóa `apps/shell`, `apps/admin`, `packages/*`, cập nhật `CLAUDE.md` và `README.md` (hiện vẫn mô tả multi-zone, `@mfe/*`, `MFE_NAV_LINKS`), đổi `dev`/`build` gốc, thêm cấu hình nginx/Docker cho `dist/`.
