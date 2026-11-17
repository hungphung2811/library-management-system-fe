import { useApi } from "@/api";
import { PageHeader, QueryBoundary } from "@/ui";
import { NotificationList, type NotificationItem } from "./notifications/NotificationList";

export default function NotificationsPage() {
  const q = useApi<NotificationItem[]>("/api/notifications/me");
  return (
    <>
      <PageHeader title="Thông báo" description="Các thông báo gửi tới tài khoản của bạn." />
      <div className="max-w-[820px]">
        <QueryBoundary query={q}>{(list) => <NotificationList items={Array.isArray(list) ? list : []} />}</QueryBoundary>
      </div>
    </>
  );
}
