import { apiFetch, toErrorInfo, useApi, useInvalidateApi } from "@/api";
import { useAuth } from "@/auth/AuthProvider";
import { Alert, App, Button, ConfirmAction, DataTable, LogOut, QueryBoundary, RefreshCw, Tag, Trash2, actionsColumn, describeError, type DataColumn } from "@/ui";

type DeviceSession = {
  sessionId: string;
  channel: "STAFF" | "STOREFRONT";
  tenantId: string | null;
  tenantName: string | null;
  deviceSummary: string | null;
  ipAddress: string | null;
  startedAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
};

const PATH = "/api/auth/sessions";
const CHANNEL: Record<string, string> = { STAFF: "Quản trị", STOREFRONT: "Cửa hàng" };

/** Thẻ "Thiết bị đăng nhập" (ADR-0017): chủ thể là chính người đăng nhập; không tự làm mới định kỳ, chỉ tải khi mở trang hoặc bấm "Tải lại". */
export function DeviceSessions() {
  const { logout } = useAuth();
  const { message } = App.useApp();
  const invalidate = useInvalidateApi();
  const q = useApi<DeviceSession[]>(PATH, { refetchOnWindowFocus: false, staleTime: Infinity });

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      message.error(describeError(toErrorInfo(e)).text);
    }
  };
  const revokeOne = (s: DeviceSession) =>
    run(async () => {
      await apiFetch(`${PATH}/${encodeURIComponent(s.sessionId)}`, { method: "DELETE" });
      if (s.current) return void (await logout()); // xóa phiên hiện tại tương đương đăng xuất
      await invalidate(PATH);
      message.success("Đã đăng xuất thiết bị.");
    });
  const revokeAll = (keepCurrent: boolean) =>
    run(async () => {
      const r = await apiFetch<{ revokedSessions: number }>(`${PATH}/revocation`, { method: "POST", json: { keepCurrent } });
      if (!keepCurrent) return void (await logout());
      await invalidate(PATH);
      message.success(`Đã đăng xuất ${r.revokedSessions} thiết bị khác.`);
    });

  const columns: DataColumn[] = [
    {
      key: "device",
      title: "Thiết bị",
      dataIndex: "deviceSummary",
      render: (v, r) => (
        <span className="flex flex-wrap items-center gap-2">
          {String(v ?? "Không rõ")}
          {r.current ? <Tag color="green">Thiết bị này</Tag> : null}
        </span>
      ),
    },
    { key: "ip", title: "Địa chỉ IP", dataIndex: "ipAddress", kind: "mono" },
    {
      key: "scope",
      title: "Kênh / đơn vị",
      dataIndex: "channel",
      render: (v, r) => `${CHANNEL[String(v)] ?? String(v)} · ${r.tenantName ?? (r.tenantId ? "Cửa hàng/thư viện" : "Nền tảng")}`,
    },
    { key: "startedAt", title: "Đăng nhập lúc", dataIndex: "startedAt", kind: "datetime" },
    { key: "lastUsedAt", title: "Dùng gần nhất", dataIndex: "lastUsedAt", kind: "datetime" },
    actionsColumn(
      (r) => [
        {
          key: "revoke",
          label: "Đăng xuất thiết bị",
          icon: <Trash2 size={16} />,
          danger: true,
          confirm: {
            title: "Đăng xuất thiết bị này?",
            description: (r as unknown as DeviceSession).current ? "Bạn sẽ phải đăng nhập lại." : "Thiết bị đó có thể còn truy cập tối đa 15 phút.",
            okText: "Đăng xuất",
          },
          onClick: () => revokeOne(r as unknown as DeviceSession),
        },
      ],
      1,
    ),
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="device-sessions">
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={<RefreshCw size={16} />} onClick={() => void q.refetch()} loading={q.isFetching}>
          Tải lại
        </Button>
        <ConfirmAction title="Đăng xuất các thiết bị khác?" description="Thiết bị đó có thể còn truy cập tối đa 15 phút." okText="Đăng xuất" danger onConfirm={() => revokeAll(true)}>
          <Button>Đăng xuất các thiết bị khác</Button>
        </ConfirmAction>
        <ConfirmAction title="Đăng xuất tất cả thiết bị?" description="Kể cả thiết bị này; bạn sẽ phải đăng nhập lại." okText="Đăng xuất tất cả" danger onConfirm={() => revokeAll(false)}>
          <Button danger icon={<LogOut size={16} />}>
            Đăng xuất tất cả
          </Button>
        </ConfirmAction>
      </div>
      <Alert type="info" showIcon title="Thiết bị bị đăng xuất vẫn có thể truy cập tối đa 15 phút cho tới khi phiên truy cập hết hạn." />
      <QueryBoundary query={q}>
        {(items) => (
          <DataTable
            columns={columns}
            rows={items as unknown as Record<string, unknown>[]}
            rowKey="sessionId"
            mobileTitleKey="device"
            embedded
            pagination={{ mode: "client", pageSize: 10 }}
            empty={{ title: "Không có phiên đăng nhập nào." }}
          />
        )}
      </QueryBoundary>
    </div>
  );
}
