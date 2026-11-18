import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useSession } from "@/api";
import { NoPermission, PageHeader, Tabs } from "@/ui";
import { ChannelsTab } from "./_components/notifications/ChannelsTab";
import { DeliveriesTab } from "./_components/notifications/DeliveriesTab";
import { TemplatesTab } from "./_components/notifications/TemplatesTab";

/**
 * Quản trị thông báo của đơn vị (ADR-0030 gói C): cấu hình kênh gửi, mẫu nội dung, lịch sử gửi. Mỗi tab theo khóa riêng
 * (NotificationSettingsController, NotificationTemplateController, NotificationDeliveryController); mặc định chỉ quản trị viên có.
 */
export default function NotificationSettingsPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  if (s.platformAdmin && !s.tenantId) return <NoPermission feature="Thông báo của đơn vị (hãy chọn đơn vị làm việc)" />;
  const tabs = [
    { key: "channels", label: "Kênh gửi", show: can(s, PERMISSIONS.NOTIFICATION_CHANNELS_GET), node: <ChannelsTab /> },
    { key: "templates", label: "Mẫu nội dung", show: can(s, PERMISSIONS.NOTIFICATION_TEMPLATE_LIST), node: <TemplatesTab /> },
    { key: "deliveries", label: "Lịch sử gửi", show: can(s, PERMISSIONS.NOTIFICATION_DELIVERY_SEARCH), node: <DeliveriesTab /> },
  ].filter((t) => t.show);
  if (tabs.length === 0) return <NoPermission feature="Thông báo" />;
  const wanted = sp.get("tab");
  const active = tabs.find((t) => t.key === wanted)?.key ?? tabs[0].key;
  return (
    <>
      <PageHeader title="Thông báo" description="Cấu hình kênh gửi, mẫu nội dung và theo dõi lịch sử gửi email của đơn vị." />
      <Tabs
        activeKey={active}
        onChange={(k) => setSp(new URLSearchParams({ tab: k }), { replace: true })}
        items={tabs.map((t) => ({ key: t.key, label: t.label, children: t.node }))}
      />
    </>
  );
}
