import { useNavigate } from "react-router";
import type { ErrorInfo } from "@/api";
import { Alert, Button, Result } from "./antd";
import { LinkButton } from "./LinkButton";
import { describeError } from "./error-messages";

/**
 * Hiển thị lỗi gọi API. 401 không redirect ở đây (apiFetch đã xóa phiên, ProtectedRoute đưa về /login): chỉ hiện nút đăng nhập.
 * `onRetry` gọi lại (thường là `query.refetch`); `retryHref` là route để điều hướng thử lại.
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
  /** Bảng mã lỗi riêng của trang (mã -> câu hiển thị). */
  messages?: Record<string, string>;
}) {
  const d = describeError(error, messages);
  const navigate = useNavigate();
  const retry =
    onRetry || retryHref ? <Button onClick={onRetry ?? (() => void navigate(retryHref!))}>Thử lại</Button> : null;

  if (error.status === 401) {
    return (
      <Result
        status="warning"
        title="Phiên đã hết hạn"
        subTitle="Vui lòng đăng nhập lại để tiếp tục."
        extra={
          <LinkButton type="primary" to="/login">
            Đăng nhập
          </LinkButton>
        }
      />
    );
  }
  if (error.status === 403) {
    return <Result status="403" title="Bạn chưa có quyền" subTitle={d.text} extra={<LinkButton to="/">Về trang chủ</LinkButton>} />;
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
