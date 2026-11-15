import type { ReactNode } from "react";

// Tiêu đề tab "Sách - Quản lý thư viện" nhờ template ở root layout. Khung do (app)/layout.tsx lo.
export const metadata = { title: "Sách" };

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return children;
}
