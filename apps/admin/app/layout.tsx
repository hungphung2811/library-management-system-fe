import type { ReactNode } from "react";
import { getSession } from "@mfe/api";
import { AppShell, Providers } from "@mfe/ui";
import "./globals.css";

export const metadata = { title: "Quản trị - Quản lý thư viện" };

/**
 * Khung (sidebar, thanh trên) nằm ở layout để luôn hiện khi trang con đang tải: loading.tsx chỉ thay phần nội dung.
 * getSession() không chuyển hướng; việc chặn người chưa đăng nhập vẫn do requireSession ở từng trang.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSession();
  return (
    <html lang="vi">
      <body>
        <Providers>
          <AppShell current="/admin" session={s}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
