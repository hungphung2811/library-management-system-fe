"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Empty, Pagination, Table, Tag, Text, formatDateTime } from "@mfe/ui";
import type { AuditLogView } from "../types";

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
  total,
  filtered,
}: {
  rows: Row[];
  page: number;
  pageSize: number;
  total: number;
  filtered: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const go = (p: number) => {
    const q = new URLSearchParams(sp.toString());
    if (p <= 1) q.delete("page");
    else q.set("page", String(p));
    router.push(q.size ? `${pathname}?${q}` : pathname);
  };

  return (
    <div>
      <Table<Row>
        rowKey="id"
        dataSource={rows}
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
              <pre className="m-0 max-h-80 overflow-auto rounded-lg bg-subtle p-3 font-mono text-xs">{pretty(r.payload)}</pre>
              <div className="text-xs text-muted">
                eventId: <span className="font-mono">{r.eventId ?? "—"}</span> · Ghi lúc: {formatDateTime(r.recordedAt)}
              </div>
            </div>
          ),
        }}
      />
      {total > pageSize && (
        <div className="mt-4 flex justify-end">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            showTotal={(t, [a, b]) => `Hiển thị ${a}–${b} trên tổng ${t}`}
            onChange={go}
          />
        </div>
      )}
    </div>
  );
}
