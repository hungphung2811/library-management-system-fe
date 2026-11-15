import { gatewayFetch, requireSession, toErrorInfo, type ErrorInfo } from "@mfe/api";
import { AppShell, ErrorPanel, PageHeader } from "@mfe/ui";
import { NotificationList, type NotificationItem } from "./NotificationList";

export default async function NotificationsPage() {
  // requireSession ném redirect nên phải gọi ngoài try.
  const s = await requireSession("/notifications");

  let items: NotificationItem[] = [];
  let error: ErrorInfo | null = null;
  try {
    const list = await gatewayFetch<NotificationItem[]>("/api/notifications/me", { signal: AbortSignal.timeout(8000) });
    items = Array.isArray(list) ? list : [];
  } catch (e) {
    error = toErrorInfo(e);
  }

  return (
    <AppShell current="/notifications" crumb="Thông báo" session={s}>
      <PageHeader title="Thông báo" description="Các thông báo gửi tới tài khoản của bạn." />
      <div className="max-w-[720px]">
        {error ? <ErrorPanel error={error} retryHref="/notifications" /> : <NotificationList userId={s.userId} items={items} />}
      </div>
    </AppShell>
  );
}
