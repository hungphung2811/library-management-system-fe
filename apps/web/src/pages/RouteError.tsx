import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button, Result } from "@/ui";

/**
 * Error boundary của router (lỗi ném lúc render hoặc lỗi tải chunk lazy). Nằm trong Providers nên dùng được antd,
 * nhưng không dựa vào router hay AuthProvider để vẫn hiện được khi chính chúng lỗi: nút dùng điều hướng trình duyệt thường.
 * `inline`: dùng làm errorElement bên trong khung ứng dụng (không căn giữa cả trang).
 */
export default function RouteError({ inline = false }: { inline?: boolean }) {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className={inline ? "" : "mx-auto mt-16 max-w-xl px-4"}>
      <Result
        status={notFound ? "404" : "error"}
        title={notFound ? "Không tìm thấy trang" : "Đã có lỗi xảy ra"}
        subTitle={notFound ? undefined : "Không tải được trang. Vui lòng thử lại."}
        extra={[
          <Button key="retry" type="primary" onClick={() => location.reload()}>
            Tải lại trang
          </Button>,
          <Button key="home" href="/">
            Về trang chủ
          </Button>,
        ]}
      />
    </div>
  );
}
