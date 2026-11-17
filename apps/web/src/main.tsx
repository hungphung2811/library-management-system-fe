import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Providers } from "@/ui/Providers";
import { router } from "@/routes/router";
import "./index.css";

/** Lưới an toàn cuối cùng (thay global-error của Next): lỗi ném từ chính Providers/AuthProvider, chỉ dùng HTML thường. */
class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto mt-24 max-w-md rounded-xl border border-line p-8">
        <h1 className="m-0 text-xl font-medium">Đã có lỗi xảy ra</h1>
        <p className="mt-2 mb-6 text-sm text-muted">Không tải được ứng dụng. Vui lòng thử lại.</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="cursor-pointer rounded-control border-0 bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Tải lại trang
        </button>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </RootErrorBoundary>
  </StrictMode>,
);
