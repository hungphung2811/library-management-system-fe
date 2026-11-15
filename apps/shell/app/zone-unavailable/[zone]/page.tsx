import { getSession } from "@mfe/api";
import { AppShell, PageHeader, Result } from "@mfe/ui";

const ZONE_PATHS = ["catalog", "circulation", "admin"];

/**
 * Nội dung hiển thị khi một zone chết/chậm. Không ai vào trực tiếp: `lib-zone-proxy.ts` tự lấy HTML của trang này
 * (kèm cookie) rồi trả về với status 503 tại đúng URL người dùng đang mở, nên sidebar và header vẫn còn,
 * chỉ vùng nội dung báo lỗi.
 */
export default async function ZoneUnavailablePage({ params }: { params: Promise<{ zone: string }> }) {
  const { zone } = await params;
  const s = await getSession();
  const current = ZONE_PATHS.includes(zone) ? `/${zone}` : "/";

  return (
    <AppShell current={current} session={s}>
      <PageHeader title={`Module "${zone}" tạm thời không khả dụng`} />
      <Result
        status="warning"
        title="Chưa kết nối được tới module này"
        subTitle="Các phần khác của hệ thống vẫn hoạt động bình thường. Vui lòng thử lại sau ít phút."
        extra={
          <>
            <a href={current}>Thử lại</a>
            <span className="mx-3 text-muted">|</span>
            <a href="/">Về trang chủ</a>
          </>
        }
      />
    </AppShell>
  );
}
