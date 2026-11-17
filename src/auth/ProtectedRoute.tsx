import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./AuthProvider";
import { Spin } from "@/ui/antd";

/** Màn hình chờ lúc boot (đang đổi refresh token lấy access token). */
export function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-live="polite">
      <Spin size="large" />
      <span className="sr-only">Đang khôi phục phiên đăng nhập…</span>
    </div>
  );
}

/**
 * Chặn route con khi chưa đăng nhập (-> /login?next=đường dẫn hiện tại) hoặc khi tài khoản phải đổi mật khẩu
 * (-> /change-password; riêng route đổi mật khẩu đặt `allowMustChange`). Chờ boot xong rồi mới quyết định,
 * nên mở lại trang bằng F5 vẫn giữ nguyên nhờ refresh token. Chỉ là lớp UX; BE mới kiểm quyền thật.
 */
export function ProtectedRoute({ allowMustChange = false }: { allowMustChange?: boolean }) {
  const { session, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <BootScreen />;
  if (!session) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (session.mustChangePassword && !allowMustChange) return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

/** Chỉ cho đường dẫn nội bộ (bắt đầu bằng "/" và không phải "//"), chống open redirect. */
export function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}
