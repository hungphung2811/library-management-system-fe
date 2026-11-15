import type { ReactNode } from "react";
import { Providers } from "@mfe/ui";
import "./globals.css";

export const metadata = { title: { default: "Quản lý thư viện", template: "%s - Quản lý thư viện" } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
