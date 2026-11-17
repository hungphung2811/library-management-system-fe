import { useState, type ReactNode } from "react";
import { StyleProvider } from "@ant-design/cssinjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { ApiCallError } from "@/api/errors";
import { AuthProvider } from "@/auth/AuthProvider";
import { antdTheme } from "@/theme";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        // Chỉ thử lại lỗi mạng/5xx một lần; 4xx (401, 403, 404, 400) thì hiện lỗi ngay.
        retry: (count, e) => count < 1 && (!(e instanceof ApiCallError) || e.status === 0 || e.status >= 500),
      },
    },
  });
}

/**
 * Bọc ở gốc app: CSS layer cho antd + theme + tiếng Việt + <App> (để App.useApp() lấy message/modal đúng theme)
 * + react-query + AuthProvider (phiên).
 * `StyleProvider layer` đưa CSS của antd vào @layer antd (khai báo trong index.css) để cùng sống với Tailwind:
 * preflight của Tailwind không đè antd, còn utility class của Tailwind luôn thắng antd. Đừng bỏ `layer`.
 * <App> bọc ngoài ConfigProvider; `component={false}` để không thêm thẻ div bọc.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <StyleProvider layer>
      <ConfigProvider theme={antdTheme} locale={viVN}>
        <App component={false}>
          <QueryClientProvider client={client}>
            <AuthProvider>{children}</AuthProvider>
          </QueryClientProvider>
        </App>
      </ConfigProvider>
    </StyleProvider>
  );
}
