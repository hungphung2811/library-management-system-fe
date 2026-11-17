import { LinkButton, Result } from "@/ui";

/** 404 chung, hiện trong khung ứng dụng (route `*` nằm dưới AppShell). */
export default function NotFound() {
  return <Result status="404" title="Không tìm thấy trang" extra={<LinkButton to="/">Về trang chủ</LinkButton>} />;
}
