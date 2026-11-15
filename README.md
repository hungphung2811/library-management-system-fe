# Library Management System - FE

Hai app Next.js ghép bằng Multi-Zones (npm workspaces): app chính `shell` (nghiệp vụ thư viện) và zone `admin` (quản lý hệ thống). Gọi BE qua API Gateway (`library-management-system`).

| App | Cổng | Đường dẫn | Vai trò |
|---|---|---|---|
| `apps/shell` | 3000 | `/`, `/catalog`, `/circulation`, `/profile`, `/notifications`, `/login` | Điểm vào duy nhất của trình duyệt: nghiệp vụ Sách và Mượn trả, đăng nhập, hồ sơ, thông báo, BFF, proxy tới zone admin (có trang fallback khi zone chết) |
| `apps/admin` | 3003 | `/admin` | Quản trị: người dùng, vai trò và quyền, phòng ban, nhật ký (zone riêng) |
| `packages/ui` | - | - | UI dùng chung: Tailwind v4 (layout, spacing, tokens `@theme`) + antd 6 (control) + `AppShell`, `AuthShell`, `PageHeader`, `Providers` |
| `packages/api` | - | - | Session từ JWT, `requireSession`, `gatewayFetch` |

## Chạy

```bash
npm install
npm run dev          # cả 2 app
```

BE: `docker compose --profile apps up -d --build` ở repo `library-management-system`. Tài khoản dev `admin` / `Admin@12345`.

## Biến môi trường

| Biến | Dùng ở | Mặc định | Ý nghĩa |
|---|---|---|---|
| `GATEWAY_URL` | mọi app | `http://localhost:8080` | API Gateway |
| `SHELL_URL` | admin | `http://localhost:3000` | URL công khai của shell, nơi zone admin chuyển người chưa đăng nhập tới |
| `ADMIN_URL` | shell | `http://localhost:3003` | Địa chỉ zone admin. Rewrite asset `/admin-static` được tính lúc BUILD, nên biến này phải đặt cả khi build |
| `ZONE_TIMEOUT_MS` | shell | `10000` | Quá ngưỡng (ms) thì coi zone không khả dụng và trả trang 503 |
| `MFE_NAV_LINKS` | shell, admin | xem `packages/ui/src/nav-links.ts` | JSON `[{href,label,permission?,group?,children?}]`; đặt cùng giá trị cho cả hai app |

## Thêm zone mới

Trang nghiệp vụ mới (Sách, Mượn trả...) chỉ cần thêm thư mục trong `apps/shell/app/(app)/`; khung `AppShell` lấy từ layout của group. Chỉ tách thành zone riêng khi có lý do (đội riêng, hạ tầng riêng, xem `docs/design/2026-11-16-gom-zone.md`):

1. Copy `apps/admin`, đổi tên, `basePath`, `assetPrefix`, cổng.
2. Shell: thêm URL vào `ZONES` ([lib-zone-proxy.ts](apps/shell/lib-zone-proxy.ts)) và `ZONE_PATHS` ở `zone-unavailable/[zone]/page.tsx`, thêm `app/<zone>/[[...path]]/route.ts` và `<zone>` vào `matcher` của `proxy.ts`.
3. Thêm link vào `MFE_NAV_LINKS`.

## Quy ước

- Từ shell sang zone admin (và ngược lại) là tải trang đầy đủ: dùng thẻ `<a>`, không dùng `next/link`. Trong shell, Sách và Mượn trả là route của chính app.
- Mỗi trang gọi `requireSession(path)`; không chỉ dựa vào proxy của shell (zone admin còn có thể được gọi thẳng cổng của nó).
- Token nằm trong cookie `httpOnly` do shell đặt; client component gọi BE qua `/api/bff/...`.

## UI: Tailwind + antd

- **antd** cho control (Button, Form, Input, Table, Menu, Alert...), theme ở [theme.ts](packages/ui/src/theme.ts). Import từ `@mfe/ui` (đã bọc client module), không import `antd` trực tiếp trong server component.
- **Tailwind v4** cho layout, khoảng cách, màu nền; tokens (`brand-*`, `surface`, `ink`) ở [tailwind.css](packages/ui/src/tailwind.css). Đổi màu thương hiệu thì sửa cả `@theme` và `brand` trong `theme.ts`.
- Hai bên sống chung nhờ CSS layer: `theme, base, antd, components, utilities` (`<AntdRegistry layer>` trong `Providers`). Utility của Tailwind luôn thắng antd, preflight không phá antd.
- Mỗi app có `postcss.config.mjs` và `app/globals.css` (import `@mfe/ui/tailwind.css` + `@source` trỏ vào `packages/ui/src`). Zone mới copy 2 file này (trong shell, `globals.css` đã quét `app/`).
- Server component truyền props cho component antd phải serialize được (Table dùng `dataIndex`, không dùng `render`).

## Test E2E (Playwright)

```bash
npm run test:e2e          # build rồi chạy 93 test
npm run test:e2e:only     # dùng bản build sẵn
```

Chạy trên bản build với mock gateway (`e2e/mock-gateway.mjs`), không cần BE hay docker. Cần trống các cổng 3000, 3003, 3100 và 8090 (4 server). Dev server đang chiếm cổng thì đặt `E2E_PORT_BASE` (ví dụ `E2E_PORT_BASE=4200`: shell 4200, admin 4203, shell "zone chết" 4300, gateway 9290) và build shell với `ADMIN_URL=http://localhost:4203` vì rewrite asset tính lúc build (xem `e2e/ports.ts`). Báo cáo HTML ở `playwright-report/`.
