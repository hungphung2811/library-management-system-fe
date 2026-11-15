import type { ReactNode } from "react";

// Tiêu đề tab "Mượn trả - Quản lý thư viện" nhờ template ở root layout. Khung do (app)/layout.tsx lo.
export const metadata = { title: "Mượn trả" };

// data-print-scope: dấu hiệu để globals.css chỉ ẩn khung ứng dụng khi in các trang Mượn trả.
export default function CirculationLayout({ children }: { children: ReactNode }) {
  return <div data-print-scope="circulation">{children}</div>;
}
