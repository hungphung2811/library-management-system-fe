import { Result } from "./antd";
import { LinkButton } from "./LinkButton";

/** Trang/khối thiếu quyền xem (đặc tả 0.2.1). Quản trị viên luôn qua can() nên không bao giờ thấy thành phần này. */
export function NoPermission({ feature }: { feature: string }) {
  return (
    <Result
      status="403"
      title="Bạn chưa có quyền xem trang này"
      subTitle={`Liên hệ quản trị viên để được cấp quyền «${feature}».`}
      extra={<LinkButton to="/">Về trang chủ</LinkButton>}
    />
  );
}
