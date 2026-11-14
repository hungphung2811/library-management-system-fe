# Library Management System - FE

Micro-frontend theo Next.js Multi-Zones (npm workspaces). Gọi BE qua API Gateway (`library-management-system`).

| App | Cổng | Đường dẫn | Vai trò |
|---|---|---|---|
| `apps/shell` | 3000 | `/`, `/login` | Điểm vào, đăng nhập, BFF, proxy tới các zone (có trang fallback khi zone chết) |
| `apps/catalog` | 3001 | `/catalog` | Sách |
| `apps/circulation` | 3002 | `/circulation` | Mượn trả |
| `apps/admin` | 3003 | `/admin` | Quản trị (role, audit) |
| `packages/ui` | - | - | UI dùng chung: Tailwind v4 (layout, spacing, tokens `@theme`) + antd 6 (control) + `Nav`, `Page`, `Providers` |
| `packages/api` | - | - | Session từ JWT, `requireSession`, `gatewayFetch` |

## Chạy

```bash
npm install
npm run dev          # cả 4 app
```

BE: `docker compose --profile apps up -d --build` ở repo `library-management-system`. Tài khoản dev `admin` / `Admin@12345`.

## Biến môi trường

| Biến | Dùng ở | Mặc định | Ý nghĩa |
|---|---|---|---|
| `GATEWAY_URL` | mọi app | `http://localhost:8080` | API Gateway |
| `SHELL_URL` | zone | `http://localhost:3000` | URL công khai của shell, nơi zone chuyển người chưa đăng nhập tới |
| `CATALOG_URL`, `CIRCULATION_URL`, `ADMIN_URL` | shell | `http://localhost:300x` | Địa chỉ từng zone |
| `MFE_NAV_LINKS` | mọi app | xem `packages/ui/src/nav-links.ts` | JSON `[{href,label,permission?}]`; đặt cùng giá trị cho mọi app |

## Thêm zone mới

1. Copy `apps/circulation`, đổi tên, `basePath`, `assetPrefix`, cổng.
2. Shell: thêm URL vào `ZONES` ([lib-zone-proxy.ts](apps/shell/lib-zone-proxy.ts)), thêm `app/<zone>/[[...path]]/route.ts` và `<zone>` vào `matcher` của `proxy.ts`.
3. Thêm link vào `MFE_NAV_LINKS`.

## Quy ước

- Điều hướng giữa các zone dùng thẻ `<a>`, không dùng `next/link`.
- Mỗi trang zone gọi `requireSession(path)`; không chỉ dựa vào proxy của shell.
- Token nằm trong cookie `httpOnly` do shell đặt; client component gọi BE qua `/api/bff/...`.

## UI: Tailwind + antd

- **antd** cho control (Button, Form, Input, Table, Menu, Alert...), theme ở [theme.ts](packages/ui/src/theme.ts). Import từ `@mfe/ui` (đã bọc client module), không import `antd` trực tiếp trong server component.
- **Tailwind v4** cho layout, khoảng cách, màu nền; tokens (`brand-*`, `surface`, `ink`) ở [tailwind.css](packages/ui/src/tailwind.css). Đổi màu thương hiệu thì sửa cả `@theme` và `brand` trong `theme.ts`.
- Hai bên sống chung nhờ CSS layer: `theme, base, antd, components, utilities` (`<AntdRegistry layer>` trong `Providers`). Utility của Tailwind luôn thắng antd, preflight không phá antd.
- Mỗi app có `postcss.config.mjs` và `app/globals.css` (import `@mfe/ui/tailwind.css` + `@source` trỏ vào `packages/ui/src`). Zone mới copy 2 file này.
- Server component truyền props cho component antd phải serialize được (Table dùng `dataIndex`, không dùng `render`).
