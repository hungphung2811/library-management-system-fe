"use client";
import { Button, Result } from "@mfe/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Result
      status="error"
      title="Đã có lỗi xảy ra"
      subTitle="Không tải được trang. Vui lòng thử lại."
      extra={[
        <Button key="retry" type="primary" onClick={reset}>
          Thử lại
        </Button>,
        <Button key="home" href="/circulation">
          Về trang mượn trả
        </Button>,
      ]}
    />
  );
}
