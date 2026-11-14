"use client";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { theme } from "./theme";

/**
 * Bọc ở root layout của MỌI app: SSR style antd + theme + tiếng Việt.
 * `layer` đưa CSS của antd vào @layer antd (khai báo trong tailwind.css) để cùng sống với Tailwind:
 * preflight của Tailwind không đè antd, còn utility class của Tailwind luôn thắng antd.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry layer>
      <ConfigProvider theme={theme} locale={viVN}>
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
