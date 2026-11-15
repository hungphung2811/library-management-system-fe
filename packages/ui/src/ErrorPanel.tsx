"use client";
import type { ErrorInfo } from "@mfe/api/client";
import { Alert, Button, Result } from "./antd";
import { describeError } from "./error-messages";

/**
 * Hiển thị lỗi gọi API. 401 không redirect ở đây (server đã xử lý, client do bffFetch xử lý): chỉ hiện link /login.
 * `error` là object thuần nên server component truyền được (kèm `retryHref`); `onRetry` chỉ dùng từ client component.
 */
export function ErrorPanel({
  error,
  retryHref,
  onRetry,
  messages,
}: {
  error: ErrorInfo;
  retryHref?: string;
  onRetry?: () => void;
  /** Bảng mã lỗi riêng của zone (mã -> câu hiển thị). */
  messages?: Record<string, string>;
}) {
  const d = describeError(error, messages);
  const retry =
    onRetry || retryHref ? (
      <Button href={onRetry ? undefined : retryHref} onClick={onRetry}>
        Thử lại
      </Button>
    ) : null;

  if (error.status === 401) {
    return (
      <Result
        status="warning"
        title="Phiên đã hết hạn"
        subTitle="Vui lòng đăng nhập lại để tiếp tục."
        extra={
          <Button type="primary" href="/login">
            Đăng nhập
          </Button>
        }
      />
    );
  }
  if (error.status === 403) {
    return <Result status="403" title="Bạn chưa có quyền" subTitle={d.text} extra={<Button href="/">Về trang chủ</Button>} />;
  }
  if (error.status === 404 && !error.code) {
    return <Result status="404" title="Không tìm thấy" subTitle={d.text} extra={retry} />;
  }
  return (
    <Alert
      type="error"
      showIcon
      title={d.text}
      description={
        d.detail || d.details?.length ? (
          <div>
            {d.detail && <div>{d.detail}</div>}
            {d.details?.length ? (
              <ul className="m-0 mt-1 pl-5">
                {d.details.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : undefined
      }
      action={retry}
    />
  );
}
