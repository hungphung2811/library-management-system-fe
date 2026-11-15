# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FE của hệ thống quản lý thư viện: micro-frontend theo Next.js 16 Multi-Zones (App Router, React 19, TypeScript, npm workspaces), UI bằng antd 6 + Tailwind v4. BE ở repo anh em `../library-management-system` (Spring Boot, xem CLAUDE.md và ADR-0003/0004 ở đó). README.md có bảng app/cổng, biến môi trường và các bước thêm zone; không lặp lại ở đây.

## Lệnh thường dùng

```bash
npm install
npm run dev                          # cả 4 app song song (npm-run-all)
npm run dev -w @mfe/admin            # một app
npm run build                        # build tất cả workspace
npm run typecheck                    # tsc --noEmit mọi workspace
npm run typecheck:e2e                # typecheck thư mục e2e/
npm run test:e2e                     # build tất cả rồi chạy Playwright (13 test)
npm run test:e2e:only                # chỉ chạy test, dùng bản build sẵn
npx playwright test -g "tên test"    # một test (vẫn dựng đủ 6 server nên mất ~20s khởi động)
```

- Không có lint. Kiểm tra gồm `typecheck` và E2E Playwright.
- E2E chạy trên bản **build** (`next start`), BE được thay bằng `e2e/mock-gateway.mjs` (cổng 8090, hai user `admin` và `member`), không cần docker. Cổng 3000-3003, 3100, 8090 phải trống (cấu hình không tái sử dụng server đang chạy). Sửa code app thì phải build lại, `test:e2e` đã tự build. Shell thứ hai ở cổng 3100 có zone catalog trỏ vào cổng chết để test zone chết.
- `workers: 2` và `ZONE_TIMEOUT_MS=30000` là chủ ý: 6 server Node + Chromium làm SSR chậm, 4 worker làm test flaky. Test form login phải mở trang bằng `openLogin` (đợi hydrate).
- Cần BE thật chạy ở `GATEWAY_URL` (mặc định `http://localhost:8080` = nginx của BE: `docker compose --profile apps up -d --build` trong repo BE) khi dùng `npm run dev`. Dev account: `admin` / `Admin@12345`.

## Kiến trúc

Bốn app độc lập, build và deploy riêng. Trình duyệt chỉ nói chuyện với **shell** (3000); shell chuyển tiếp tới zone:

- Zone (`catalog`, `circulation`, `admin`) đặt `basePath: "/<zone>"` và `assetPrefix: "/<zone>-static"` (kèm rewrite `/<zone>-static/_next/* → /_next/*` trong chính zone) để asset không đụng `/_next` của shell.
- Shell chuyển tiếp **trang** bằng route handler `app/<zone>/[[...path]]/route.ts` (logic ở `lib-zone-proxy.ts`), không dùng `rewrites`, vì rewrite không bắt được lỗi: zone chết/timeout 10s/5xx → trả trang 503 tiếng Việt thay vì 500 trần. Chỉ **asset** `/<zone>-static/*` đi qua `rewrites` trong `next.config.ts`. Hai danh sách này (route handler và `ZONES`) phải cùng đủ zone.
- `proxy.ts` của shell (tên file của Next 16, thay cho `middleware.ts`) chặn zone khi thiếu cookie access token: còn refresh token thì sang `/api/session/refresh`, không thì `/login`. Đây chỉ là lớp ngoài; mỗi trang zone vẫn phải gọi `requireSession(path)` vì zone gọi thẳng cổng của nó sẽ không qua shell.
- Giữa các zone là full page load: dùng `<a>`, không dùng `next/link`.

### Xác thực

Token nằm trong cookie `httpOnly` (`lms_at`, `lms_rt`) do shell đặt qua `/api/session/{login,refresh,logout}`; trình duyệt không cầm token. Cookie dùng chung cho mọi zone vì mọi thứ cùng origin qua shell.
- Server component gọi BE bằng `gatewayFetch` (`@mfe/api`, gắn Bearer từ cookie).
- Client component gọi `/api/bff/<đường dẫn BE>`; shell gắn Bearer rồi chuyển tiếp (không dính CORS).
- `getSession()` chỉ decode payload JWT, không verify chữ ký; BE là nơi verify và kiểm quyền. Ẩn/hiện UI theo `can()` chỉ là UX, không phải bảo mật.
- Redirect sau login/refresh chỉ chấp nhận đường dẫn bắt đầu bằng `/` và không phải `//` (chống open redirect); giữ nguyên khi sửa.

### Package dùng chung (nhúng ở mức source, mỗi app có bản riêng lúc build)

- `@mfe/api`: `config` (hằng số, **không** import `next/headers`, nên `proxy.ts` import được qua `@mfe/api/config`), `session`, `gateway`.
- `@mfe/ui`: `Providers` (bắt buộc ở root layout mọi app), `Nav`, `Page`, `PageHeader`, các component antd, `theme.ts`, `tailwind.css`.
- Sửa package dùng chung thì phải build lại và deploy lại mọi zone. Danh sách link `Nav` đọc lúc chạy từ env `MFE_NAV_LINKS` (JSON, đặt cùng giá trị cho mọi app), không phải sửa code.

### UI: antd + Tailwind

- antd cho control, Tailwind cho layout/khoảng cách. Hai bên cùng sống nhờ CSS layer `theme, base, antd, components, utilities` (khai báo đầu `tailwind.css`, và `<AntdRegistry layer>` trong `Providers`); đừng bỏ prop `layer` hay đổi thứ tự layer, preflight sẽ đè antd.
- Component antd được re-export từ `packages/ui/src/antd.tsx` (file `"use client"`) để server component dùng được. Server component chỉ truyền props serialize được: `Table` dùng `dataIndex`, không dùng `render`; cần tuỳ biến thì viết client component. Compound component (`Typography.Title`) phải export thành const riêng như `Title`/`Text`.
- Tailwind không tự quét package workspace: mỗi app cần `app/globals.css` có `@source "../../../packages/ui/src"` và `postcss.config.mjs`. Thiếu hai file này ở zone mới thì class của `@mfe/ui` không được sinh ra.
- Màu thương hiệu nằm ở hai nơi phải sửa cùng lúc: `@theme` trong `tailwind.css` và `brand`/`theme` trong `theme.ts`.

## Lệch với BE hiện tại (chưa xử lý)

BE đã đổi sang phân quyền động theo endpoint (ADR-0003): khóa quyền là `Controller/method`, quản trị viên là claim JWT `admin=true` (bỏ qua kiểm khóa), `TokenResponse` có thêm `mustChangePassword` (token của tài khoản đó không mang `admin`/`permissions`). FE vẫn dùng mã quyền cũ (`ROLE_VIEW`, `BORROW_BOOK`, `RETURN_BOOK` trong `can()` và `nav-links.ts`) và `Session` chưa có cờ `admin`, nên với BE mới trang admin/circulation có thể ẩn nội dung sai. API sách đã có thật (`/api/books`, `/api/book-copies` qua `lms-api`) nhưng zone `catalog` vẫn là trang chờ. Nginx của BE chỉ cho CORS origin `localhost:3000/5173`, không ảnh hưởng gọi server-side của FE.
