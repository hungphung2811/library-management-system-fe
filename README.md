# Library Management System - FE

Một SPA React 19 + Vite 7 + TypeScript (một package ở gốc repo, không còn npm workspaces): react-router v7, antd 6 + Tailwind v4, `@tanstack/react-query`. Gọi BE qua `lms-api` (`library-management-system`), cùng origin qua proxy `/api`. Không SSR.

## Cấu trúc

```
index.html, vite.config.ts, tsconfig.json (alias @/ -> src)
src/
  main.tsx            gốc: RootErrorBoundary > Providers > RouterProvider
  index.css           Tailwind + CSS layer + token thương hiệu + CSS in phiếu
  api/                apiFetch, useApi, useApiMutation, session (decode JWT), can, PERMISSIONS, token-store
  auth/               AuthProvider, ProtectedRoute
  ui/                 điểm vào "@/ui": antd, icon, AppShell, DataTable, SearchBar, FormModal, QueryBoundary...
  routes/router.tsx   khai báo mọi đường dẫn
  pages/              Home, Login, Profile, Notifications...; catalog/, circulation/, admin/ (lazy theo nhóm)
```

| Đường dẫn | Nội dung |
|---|---|
| `/login`, `/change-password` | Đăng nhập, đổi mật khẩu (ngoài khung) |
| `/`, `/profile`, `/notifications` | Trang chủ, hồ sơ, thông báo |
| `/catalog`, `/circulation` | Sách, Mượn trả |
| `/admin/...` | Quản trị: người dùng, vai trò và quyền, phòng ban, nhật ký |

## Chạy

```bash
npm install
npm run dev                              # http://localhost:3000, proxy /api -> http://localhost:8085
npm run dev -- --port 3100   # cổng khác khi 3000 bận
npm run typecheck
npm run build                # tsc + vite build -> dist/
npm run preview              # phục vụ dist/ với cùng proxy
```

BE: `scripts/dev-start.ps1` ở repo `library-management-system` (chạy Maven/jar, kèm FE), hoặc `docker compose --profile apps up -d --build` rồi `VITE_API_TARGET=http://localhost:8080 npm run dev`. Tài khoản dev `admin` / `Admin@12345`.

## Biến môi trường

| Biến | Dùng ở | Mặc định | Ý nghĩa |
|---|---|---|---|
| `VITE_API_TARGET` | `vite dev` / `vite preview` | `http://localhost:8085` | Đích proxy `/api` (lms-api hoặc nginx của BE). Không ảnh hưởng bản build tĩnh: production proxy ở nginx |
| `E2E_PORT_BASE` | Playwright | `4200` | Cổng web của E2E; mock gateway ở base+1 |

## Xác thực và phân quyền

- Access token chỉ trong bộ nhớ; refresh token ở localStorage khóa `lms_rt`. F5 thì khôi phục phiên bằng `POST /api/auth/refresh`. 401 giữa phiên thì refresh một lần rồi gọi lại, thất bại thì về `/login?next=...`.
- Phân quyền động theo BE (ADR-0003): khóa `TênController/tênMethod`, `can(session, PERMISSIONS.x)` chỉ ẩn/hiện UI, BE trả 403 mới là quyết định cuối. Danh sách ở `src/api/permissions.ts`.
- Dữ liệu: `useApi("/api/...")` + `QueryBoundary`, ghi bằng `useApiMutation(fn, { invalidate })`; bộ lọc và phân trang nằm trên URL.

## Thêm trang mới

1. Tạo component trong `src/pages/<nhóm>/`.
2. Khai báo route (và `handle.title`) trong `routes/router.tsx`.
3. Cần mục sidebar thì thêm vào `ui/nav-links.ts` (icon ở `ICONS` trong `ui/ShellFrame.tsx`).

## UI: Tailwind + antd

- **antd** cho control (Button, Form, Input, Table, Menu...), theme ở `src/ui/theme.ts`; import từ `@/ui`.
- **Tailwind v4** cho layout, khoảng cách, màu nền (plugin `@tailwindcss/vite`, tự quét `src`); token (`brand-*`, `surface`, `ink`) ở `@theme` trong `src/index.css`. Đổi màu thương hiệu thì sửa cả `@theme` và `brand` trong `theme.ts`.
- Hai bên sống chung nhờ CSS layer `theme, base, antd, components, utilities` (đầu `index.css`) và `<StyleProvider layer>` trong `Providers`. Đừng bỏ prop `layer`.

## Deploy

Build tĩnh `dist/`, phục vụ bằng nginx và proxy `/api` tới lms-api (cùng origin nên không cần CORS). Bắt buộc fallback SPA, nếu không F5 trên `/catalog/...` ra 404:

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;          # nội dung dist
  location /api/ { proxy_pass http://lms-api:8085; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }
  location / { try_files $uri /index.html; }
}
```

`index.html` không nên cache lâu (tên file trong `assets/` có hash). Mẫu tham khảo, chưa tích hợp vào `docker-compose` của BE.

## Test E2E (Playwright)

```bash
npm run test:e2e          # build rồi chạy Playwright
npm run test:e2e:only     # dùng bản build sẵn
```

Chạy trên bản build tĩnh (`vite preview`) với mock gateway (`e2e/mock-gateway.mjs`), không cần BE hay docker. Chỉ 2 server: web ở `E2E_PORT_BASE` (mặc định 4200) và mock ở base+1; không đụng 3000/3100/8085-8090. Báo cáo HTML ở `playwright-report/`. Chi tiết: `e2e/README-e2e.md`. Một số spec (`catalog`, `circulation`, `admin`) chưa viết lại cho app Vite.

## Việc chuyển đổi

Kiến trúc cũ (hai app Next.js multi-zone `apps/shell` + `apps/admin`, BFF `/api/bff`, cookie `httpOnly`, `@mfe/*`, `MFE_NAV_LINKS`, `basePath`) đã bỏ và đã xóa khỏi repo (cùng `packages/*`); mọi trang đã port sang `apps/web`. Xem `docs/design/2026-11-17-chuyen-vite-spa.md`.
