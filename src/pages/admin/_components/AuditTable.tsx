import { useSearchParams } from "react-router";
import { Empty, Pagination, Table, Tag, Text, formatDateTime } from "@/ui";
import type { AuditLogView } from "../_lib/types";

type Row = Omit<AuditLogView, "payload"> & { payload: string };

/** Hiển thị payload dạng JSON thụt lề; không phải JSON thì giữ nguyên chuỗi. */
function pretty(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

/** Bảng nhật ký: hàng mở rộng hiện payload JSON, eventId, recordedAt. Phân trang server qua query `page` (từ 1). */
export function AuditTable({
  rows,
  page,
  pageSize,
  sizes = [10, 20, 50, 100],
  total,
  filtered,
  loading,
  showTenant,
}: {
  rows: Row[];
  page: number;
  pageSize: number;
  /** Các cỡ trang của ô "/ trang" cạnh phân trang (ghi `size` lên URL, bỏ `page`). */
  sizes?: number[];
  total: number;
  filtered: boolean;
  loading?: boolean;
  /** Hiện cột tenant (platform admin xem xuyên tenant). */
  showTenant?: boolean;
}) {
  const [sp, setSp] = useSearchParams();

  const go = (p: number, s: number) => {
    const q = new URLSearchParams(sp);
    if (s !== pageSize) {
      if (s === 20) q.delete("size");
      else q.set("size", String(s));
      q.delete("page");
    } else if (p <= 1) q.delete("page");
    else q.set("page", String(p));
    setSp(q);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
      <Table<Row>
        rowKey="id"
        dataSource={rows}
        loading={loading}
        pagination={false}
        scroll={{ x: "max-content" }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={filtered ? "Không có sự kiện nào khớp." : "Chưa có sự kiện nào được ghi lại."}
            />
          ),
        }}
        columns={[
          { key: "occurredAt", title: "Thời điểm", dataIndex: "occurredAt", render: (v: string) => formatDateTime(v) },
          {
            key: "eventType",
            title: "Loại sự kiện",
            dataIndex: "eventType",
            render: (v: string) => <Tag className="font-mono">{v}</Tag>,
          },
          {
            key: "aggregateId",
            title: "Mã đối tượng",
            dataIndex: "aggregateId",
            render: (v?: string) =>
              v ? (
                <Text className="font-mono" copyable={{ text: v }}>
                  {v.length > 12 ? `${v.slice(0, 8)}…` : v}
                </Text>
              ) : (
                "—"
              ),
          },
          ...(showTenant
            ? [
                {
                  key: "tenantId",
                  title: "Tenant",
                  dataIndex: "tenantId",
                  render: (v?: string | null) =>
                    v ? (
                      <Text className="font-mono" copyable={{ text: v }}>
                        {v.slice(0, 8)}…
                      </Text>
                    ) : (
                      "—"
                    ),
                },
              ]
            : []),
          {
            key: "payload",
            title: "Nội dung",
            dataIndex: "payload",
            render: (v: string) => (
              <span className="block max-w-96 truncate font-mono text-xs text-muted" title={v}>
                {v}
              </span>
            ),
          },
        ]}
        expandable={{
          expandedRowRender: (r) => (
            <div className="flex flex-col gap-2">
              <pre className="m-0 max-h-80 overflow-auto rounded-control bg-subtle p-3 font-mono text-xs">{pretty(r.payload)}</pre>
              <div className="text-xs text-muted">
                eventId: <span className="font-mono">{r.eventId ?? "—"}</span> · Ghi lúc: {formatDateTime(r.recordedAt)}
              </div>
            </div>
          ),
        }}
      />
      </div>
      {total > Math.min(pageSize, ...sizes) && (
        <div className="mt-3 flex justify-end">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={Array.from(new Set([...sizes, pageSize])).sort((a, b) => a - b)}
            locale={{ items_per_page: "/ trang", page_size: "Số dòng mỗi trang" }}
            showTotal={(t, [a, b]) => `Hiển thị ${a}–${b} trên tổng ${t}`}
            onChange={go}
          />
        </div>
      )}
    </div>
  );
}
