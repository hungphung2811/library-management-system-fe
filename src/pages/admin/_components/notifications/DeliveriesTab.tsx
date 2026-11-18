import { useMemo } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { App, Button, DataTable, FilterBar, QueryBoundary, RefreshCw, ShortId, Tag, actionsColumn, dayjs, describeError, formatDateTime, useFilterParams, type DataColumn, type FilterField } from "@/ui";
import {
  DELIVERY_ERROR,
  DELIVERY_STATUS,
  DELIVERY_STATUS_COLOR,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  SKIP_REASON,
  typeLabel,
  type Delivery,
} from "../../_lib/notifications";

const SCHEMA: FilterField[] = [
  { type: "select", name: "status", label: "Trạng thái", options: Object.entries(DELIVERY_STATUS).map(([value, label]) => ({ value, label })) },
  { type: "select", name: "type", label: "Loại thông báo", options: Object.entries(NOTIFICATION_TYPES).map(([value, label]) => ({ value, label })) },
  { type: "dateRange", name: "created", label: "Ngày tạo" },
];

type Page = { items: Delivery[]; total: number; page: number; size: number };

/**
 * Lịch sử gửi email thông báo: lọc theo trạng thái, loại, ngày. Địa chỉ người nhận đã che; lỗi chỉ có mã (BE không trả thông điệp gốc của SMTP).
 * Thư gửi nền nên màn này không tự cập nhật: bấm "Tải lại" sau vài giây. Lượt DEAD gửi lại được (khóa retry).
 */
export function DeliveriesTab() {
  const s = useSession();
  const { message } = App.useApp();
  const f = useFilterParams(SCHEMA, { defaultSize: 20 });
  const range = f.range("created");
  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of ["status", "type"]) if (f.str(k)) q.set(k, f.str(k));
    if (range.from) q.set("from", dayjs(range.from).startOf("day").toISOString());
    if (range.to) q.set("to", dayjs(range.to).add(1, "day").startOf("day").toISOString());
    q.set("page", String(f.page - 1));
    q.set("size", String(f.size));
    return q.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.values, f.page, f.size]);
  const q = useApi<Page>(`/api/notification-deliveries?${query}`);
  const retry = useApiMutation((id: string) => apiFetch<Delivery>(`/api/notification-deliveries/${encodeURIComponent(id)}/retry`, { method: "POST" }), {
    invalidate: ["/api/notification-deliveries"],
  });
  const canRetry = can(s, PERMISSIONS.NOTIFICATION_DELIVERY_RETRY);

  const columns: DataColumn[] = [
    { key: "at", title: "Tạo lúc", dataIndex: "createdAt", kind: "datetime" },
    { key: "type", title: "Loại", dataIndex: "type", render: (v, r) => (
      <span>
        {typeLabel(v as string)}
        <span className="ml-1 text-xs text-muted">({NOTIFICATION_CATEGORIES[r.category as string] ?? String(r.category)})</span>
      </span>
    ) },
    { key: "to", title: "Người nhận", dataIndex: "recipientAddressMasked", render: (v, r) => (
      <span>
        <span className="font-mono">{String(v ?? "—")}</span>
        {r.recipientUserId ? <span className="ml-1 text-xs text-muted"><ShortId value={String(r.recipientUserId)} /></span> : null}
      </span>
    ) },
    { key: "st", title: "Trạng thái", dataIndex: "status", render: (v, r) => (
      <span>
        <Tag color={DELIVERY_STATUS_COLOR[v as string]}>{DELIVERY_STATUS[v as string] ?? String(v)}</Tag>
        {r.skipReason ? <span className="text-xs text-muted">{SKIP_REASON[r.skipReason as string] ?? String(r.skipReason)}</span> : null}
      </span>
    ) },
    { key: "att", title: "Lần thử", dataIndex: "attempts", align: "right" },
    { key: "err", title: "Lỗi gần nhất", dataIndex: "lastErrorCode", render: (v, r) =>
      v ? (
        <span>
          {DELIVERY_ERROR[v as string] ?? String(v)}
          {r.lastErrorAt ? <span className="ml-1 text-xs text-muted">{formatDateTime(r.lastErrorAt as string)}</span> : null}
        </span>
      ) : (
        "—"
      ) },
    { key: "sent", title: "Gửi lúc", dataIndex: "sentAt", kind: "datetime" },
    { key: "tpl", title: "Mẫu", dataIndex: "templateSource", render: (v, r) => (v ? `${v === "TENANT" ? "Đơn vị" : "Mặc định"} v${String(r.templateVersion ?? "?")}` : "—") },
    ...(canRetry
      ? [
          actionsColumn(
            (row) => [
              {
                key: "retry",
                label: "Gửi lại",
                icon: <RefreshCw size={16} />,
                hidden: row.status !== "DEAD",
                confirm: { title: "Gửi lại thư này?", description: "Lượt gửi được xếp lại hàng chờ với đợt thử mới.", okText: "Gửi lại" },
                onClick: async () => {
                  try {
                    await retry.mutateAsync(String(row.id));
                    message.success("Đã xếp lại hàng chờ gửi.");
                  } catch (e) {
                    message.error(describeError(toErrorInfo(e)).text);
                  }
                },
              },
            ],
            1,
          ),
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3" data-testid="deliveries-tab">
      <FilterBar
        filters={f}
        total={q.data?.total}
        unit="lượt gửi"
        extra={
          <Button icon={<RefreshCw size={14} />} onClick={() => void q.refetch()} loading={q.isFetching}>
            Tải lại
          </Button>
        }
      />
      <QueryBoundary query={q}>
        {(p) => (
          <DataTable
            columns={columns}
            rows={p.items as unknown as Record<string, unknown>[]}
            rowKey="id"
            mobileTitleKey="type"
            pagination={{ mode: "server", page: f.page, pageSize: f.size, total: p.total, onSizeChange: f.setSize }}
            empty={{ title: "Chưa có lượt gửi nào.", hint: f.hasFilter ? "Thử đổi hoặc bỏ bộ lọc." : "Lượt gửi xuất hiện khi có sự kiện cần gửi email." }}
          />
        )}
      </QueryBoundary>
    </div>
  );
}
