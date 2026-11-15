"use client";
import "./globals.css";

/**
 * Lỗi ném từ chính root layout (nơi error.tsx theo đoạn không bắt được). Thay hẳn root layout nên tự có <html>/<body>
 * và chỉ dùng HTML thường: Providers/antd có thể chính là thứ đang lỗi.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main className="mx-auto mt-24 max-w-md rounded-xl border border-line p-8">
          <h1 className="m-0 text-xl font-medium">Đã có lỗi xảy ra</h1>
          <p className="mt-2 mb-6 text-sm text-muted">Không tải được ứng dụng. Vui lòng thử lại.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer rounded-lg border-0 bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Thử lại
            </button>
            <a href="/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink no-underline hover:bg-subtle">
              Về trang chủ
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
