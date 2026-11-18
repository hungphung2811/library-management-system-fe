import { useState } from "react";
import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import { Alert, App, Button, QueryBoundary, Switch, Tag, describeError } from "@/ui";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, type Preference } from "@/pages/admin/_lib/notifications";

const PATH = "/api/notifications/me/preferences";
const keyOf = (p: { category: string; channel: string }) => `${p.category}:${p.channel}`;

function Form({ data }: { data: Preference[] }) {
  const { message } = App.useApp();
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<ReturnType<typeof toErrorInfo> | null>(null);
  const save = useApiMutation((items: Pick<Preference, "category" | "channel" | "enabled">[]) => apiFetch<Preference[]>(PATH, { method: "PUT", json: { items } }), { invalidate: [PATH] });
  const dirty = data.filter((p) => !p.mandatory && keyOf(p) in edits && edits[keyOf(p)] !== p.enabled);
  const d = error ? describeError(error) : null;
  return (
    <div className="flex flex-col gap-3" data-testid="notification-preferences">
      <p className="m-0 text-sm text-muted">
        Thông báo trong ứng dụng luôn được ghi. Ở đây bạn chọn nhóm nào được gửi thêm qua email. Nhóm bắt buộc (tài khoản, hoàn tiền) không tắt được.
      </p>
      {d && <Alert type="error" showIcon title={d.text} />}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {data.map((p) => {
          const name = `${NOTIFICATION_CATEGORIES[p.category] ?? p.category} qua ${NOTIFICATION_CHANNELS[p.channel] ?? p.channel}`;
          return (
            <li key={keyOf(p)} className="flex flex-wrap items-center gap-3">
              <Switch
                checked={p.mandatory ? true : (edits[keyOf(p)] ?? p.enabled)}
                disabled={p.mandatory}
                aria-label={name}
                checkedChildren="Bật"
                unCheckedChildren="Tắt"
                onChange={(v) => setEdits((e) => ({ ...e, [keyOf(p)]: v }))}
              />
              <span>{name}</span>
              {p.mandatory && <Tag>Bắt buộc, không tắt được</Tag>}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3">
        <Button
          type="primary"
          disabled={dirty.length === 0}
          loading={save.isPending}
          onClick={() => {
            setError(null);
            save.mutate(
              dirty.map((p) => ({ category: p.category, channel: p.channel, enabled: edits[keyOf(p)] })),
              {
                onSuccess: () => {
                  setEdits({});
                  message.success("Đã lưu tùy chọn nhận thông báo.");
                },
                onError: (e) => setError(toErrorInfo(e)),
              },
            );
          }}
        >
          Lưu tùy chọn
        </Button>
        <span className="text-sm text-muted">{dirty.length > 0 ? `${dirty.length} thay đổi chưa lưu` : "Không có thay đổi"}</span>
      </div>
    </div>
  );
}

/** Thẻ "Tùy chọn nhận thông báo" trong hồ sơ: GET/PUT /api/notifications/me/preferences (chỉ cần đăng nhập). */
export function NotificationPreferences() {
  const q = useApi<Preference[]>(PATH, { refetchOnWindowFocus: false });
  return <QueryBoundary query={q}>{(data) => <Form key={JSON.stringify(data.map((p) => p.enabled))} data={Array.isArray(data) ? data : []} />}</QueryBoundary>;
}
