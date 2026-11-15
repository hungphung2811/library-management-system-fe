import { getSession } from "@mfe/api";
import { AppShell, Button, Result } from "@mfe/ui";

/** 404 chung. Nằm ngoài (app) nên tự bọc khung; khách chưa đăng nhập vẫn thấy khung (không sidebar mục cần quyền). */
export default async function NotFound() {
  const s = await getSession();
  return (
    <AppShell session={s}>
      <Result status="404" title="Không tìm thấy trang" extra={<Button href="/">Về trang chủ</Button>} />
    </AppShell>
  );
}
