import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, DataTable, QueryBoundary, Switch, describeError, type DataColumn } from "@/ui";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, typeLabel, type ChannelSetting } from "../../_lib/notifications";

const keyOf = (r: { type: string; channel: string }) => `${r.type}:${r.channel}`;

function ChannelsTable({ data, canUpdate }: { data: ChannelSetting[]; canUpdate: boolean }) {
  const { message } = App.useApp();
  // Chỉ giữ ô đã đổi so với dữ liệu BE: gửi đúng các dòng đó khi lưu.
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<ReturnType<typeof toErrorInfo> | null>(null);
  const save = useApiMutation(
    (items: { type: string; channel: string; enabled: boolean }[]) => apiFetch<ChannelSetting[]>("/api/notification-settings/channels", { method: "PUT", json: { items } }),
    { invalidate: ["/api/notification-settings/channels"] },
  );
  const current = (r: ChannelSetting) => edits[keyOf(r)] ?? r.enabled;
  const dirty = data.filter((r) => keyOf(r) in edits && edits[keyOf(r)] !== r.enabled);
  const d = error ? describeError(error) : null;

  const columns: DataColumn[] = [
    { key: "t", title: "Loại thông báo", dataIndex: "type", render: (v) => typeLabel(v as string) },
    { key: "c", title: "Nhóm", dataIndex: "category", render: (v) => NOTIFICATION_CATEGORIES[v as string] ?? String(v) },
    { key: "ch", title: "Kênh", dataIndex: "channel", render: (v) => NOTIFICATION_CHANNELS[v as string] ?? String(v) },
    {
      key: "on",
      title: "Gửi qua kênh này",
      dataIndex: "enabled",
      render: (_, r) => {
        const row = r as unknown as ChannelSetting;
        return (
          <Switch
            checked={current(row)}
            disabled={!canUpdate}
            aria-label={`${NOTIFICATION_CHANNELS[row.channel] ?? row.channel}: ${typeLabel(row.type)}`}
            checkedChildren="Bật"
            unCheckedChildren="Tắt"
            onChange={(v) => setEdits((e) => ({ ...e, [keyOf(row)]: v }))}
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-3" data-testid="channels-tab">
      <Alert type="info" showIcon title="Thông báo trong ứng dụng luôn được ghi. Ở đây chỉ bật hoặc tắt việc gửi thêm qua email theo từng loại; người nhận còn có thể tự tắt nhóm không bắt buộc." />
      {d && <Alert type="error" showIcon title={d.text} description={d.details?.join("; ")} />}
      <DataTable columns={columns} rows={data.map((r) => ({ ...r, _k: keyOf(r) }))} rowKey="_k" mobileTitleKey="t" empty={{ title: "Chưa có loại thông báo nào." }} />
      {canUpdate && (
        <div className="flex items-center gap-3">
          <Button
            type="primary"
            loading={save.isPending}
            disabled={dirty.length === 0}
            onClick={() => {
              setError(null);
              save.mutate(
                dirty.map((r) => ({ type: r.type, channel: r.channel, enabled: edits[keyOf(r)] })),
                {
                  onSuccess: () => {
                    setEdits({});
                    message.success("Đã lưu cấu hình kênh.");
                  },
                  onError: (e) => setError(toErrorInfo(e)),
                },
              );
            }}
          >
            Lưu thay đổi
          </Button>
          <span className="text-sm text-muted">{dirty.length > 0 ? `${dirty.length} thay đổi chưa lưu` : "Không có thay đổi"}</span>
        </div>
      )}
    </div>
  );
}

/** Cấu hình kênh theo tenant: bật/tắt email cho từng loại thông báo. GET/PUT /api/notification-settings/channels. */
export function ChannelsTab() {
  const s = useSession();
  const q = useApi<ChannelSetting[]>("/api/notification-settings/channels");
  return (
    <QueryBoundary query={q}>
      {(data) => <ChannelsTable key={JSON.stringify(data.map((r) => r.enabled))} data={Array.isArray(data) ? data : []} canUpdate={can(s, PERMISSIONS.NOTIFICATION_CHANNELS_UPDATE)} />}
    </QueryBoundary>
  );
}
