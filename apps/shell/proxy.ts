import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@mfe/api/config";

// Lớp chặn đầu tiên: chưa đăng nhập thì không cho vào các trang cần đăng nhập (Sách, Mượn trả, hồ sơ...) và zone admin.
// Mỗi trang vẫn tự kiểm tra lại bằng requireSession; riêng admin vì có thể được gọi thẳng cổng của nó, không qua shell.
export function proxy(req: NextRequest) {
  if (req.cookies.has(ACCESS_COOKIE)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const next = encodeURIComponent(pathname + search);
  // Access token hết hạn (cookie biến mất) nhưng còn refresh token -> thử làm mới.
  const target = req.cookies.has(REFRESH_COOKIE)
    ? `/api/session/refresh?next=${next}`
    : `/login?next=${next}`;
  return NextResponse.redirect(new URL(target, req.url));
}

export const config = {
  matcher: ["/catalog/:path*", "/circulation/:path*", "/admin/:path*", "/change-password", "/profile", "/notifications"],
};
