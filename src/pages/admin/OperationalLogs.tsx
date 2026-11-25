import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Empty, NoPermission, PageHeader, Pagination, Select, Switch, Table, Tabs, Tag, Text, formatDateTime } from "@/ui";
import { ErrorBlock } from "./_components/ErrorBlock";
import { keepPreviousData, pageNo, qp } from "./_lib/params";

/** Một sự kiện log đã lưu (docs/api/sales-logs.md). Chỉ có trường đã che sẵn: không có thân, token, số điện thoại. */
type LogEvent = {
  id: string;
  occurredAt: string;
  channel: "INTEGRATION_OUTBOUND" | "INTEGRATION_INBOUND" | "SYSTEM";
  provider: string | null;
  event: string | null;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  op: string | null;
  outcome: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  errorKind: string | null;
  errorClass: string | null;
  anomalyType: string | null;
  correlationId: string | null;
  intentId: string | null;
  reference: string | null;
  tenantId: string | null;
};
type LogPage = { items: LogEvent[]; total: number; page: number; size: number };
type Tab = "integration" | "system";

const SIZES = [20, 50, 100];
const LEVEL_COLOR: Record<string, string> = { DEBUG: "default", INFO: "blue", WARN: "orange", ERROR: "red" };
const CHANNEL_LABEL: Record<string, string> = { INTEGRATION_OUTBOUND: "Gọi ra", INTEGRATION_INBOUND: "Gọi vào", SYSTEM: "Hệ thống" };
type Patch = (changes: Record<string, string | undefined>, keepPage?: boolean) => void;

function Filters({ tab, sp, patch }: { tab: Tab; sp: URLSearchParams; patch: Patch }) {
  const integration = tab === "integration";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      {integration && (
        <Select
          allowClear
          placeholder="Hướng"
          className="w-32"
          value={qp(sp, "channel") || undefined}
          onChange={(v) => patch({ channel: v })}
          options={[
            { value: "OUTBOUND", label: "Gọi ra" },
            { value: "INBOUND", label: "Gọi vào" },
          ]}
        />
      )}
      {integration && (
        <Select
          allowClear
          placeholder="Nhà cung cấp"
          className="w-40"
          value={qp(sp, "provider") || undefined}
          onChange={(v) => patch({ provider: v })}
          options={["sepay", "momo", "webhook", "simulated"].map((v) => ({ value: v, label: v.toUpperCase() }))}
        />
      )}
      <Select
        allowClear
        placeholder="Mức độ"
        className="w-32"
        value={qp(sp, "level") || undefined}
        onChange={(v) => patch({ level: v })}
        options={["INFO", "WARN", "ERROR"].map((v) => ({ value: v, label: v }))}
      />
      {integration && (
        <Select
          allowClear
          placeholder="Kết quả"
          className="w-40"
          value={qp(sp, "outcome") || undefined}
          onChange={(v) => patch({ outcome: v })}
          options={["OK", "MATCHED", "NO_MATCH", "FAIL", "TIMEOUT", "REJECTED", "CONFLICT", "RECOVERED"].map((v) => ({ value: v, label: v }))}
        />
      )}
      {integration && (
        <label className="flex items-center gap-2 text-body text-muted">
          <Switch checked={qp(sp, "anomalyOnly") === "true"} onChange={(v) => patch({ anomalyOnly: v ? "true" : undefined })} />
          Chỉ bất thường
        </label>
      )}
    </div>
  );
}

function LogTable({ tab, sp, setSp }: { tab: Tab; sp: URLSearchParams; setSp: (q: URLSearchParams) => void }) {
  const s = useSession();
  const page = pageNo(sp);
  const sizeRaw = Number.parseInt(qp(sp, "size"), 10);
  const size = SIZES.includes(sizeRaw) ? sizeRaw : 20;

  const patch: Patch = (changes, keepPage = false) => {
    const q = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(changes)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    if (!keepPage) q.delete("page");
    setSp(q);
  };

  const params = new URLSearchParams({ page: String(page - 1), size: String(size) });
  for (const k of tab === "integration" ? ["channel", "provider", "level", "outcome", "anomalyOnly"] : ["level"]) {
    const v = qp(sp, k);
    if (v) params.set(k, v);
  }
  const q = useApi<LogPage>(`/api/sales/logs/${tab}?${params}`, { placeholderData: keepPreviousData, refetchInterval: 15_000 });
  if (q.isError && !q.data) return <ErrorBlock query={q} />;

  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const platform = s.platformAdmin;

  return (
    <>
      <Filters tab={tab} sp={sp} patch={patch} />
      <Table<LogEvent>
        rowKey="id"
        size="small"
        loading={q.isFetching && !q.isPlaceholderData}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: <Empty description="Chưa có sự kiện nào khớp bộ lọc" /> }}
        expandable={{
          expandedRowRender: (r) => (
            <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-caption">
              {(
                [
                  ["Mã tương quan", r.correlationId],
                  ["Mã lệnh thanh toán", r.intentId],
                  ["Mã tham chiếu (đã che)", r.reference],
                  ["Loại lỗi", r.errorKind],
                  ["Lớp lỗi", r.errorClass],
                  ["Bất thường", r.anomalyType],
                  ["Tenant", r.tenantId],
                ] as [string, string | null][]
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="m-0 break-all font-mono">{v}</dd>
                  </div>
                ))}
            </dl>
          ),
        }}
        columns={[
          { title: "Thời gian", dataIndex: "occurredAt", width: 150, render: (v: string) => formatDateTime(v) },
          { title: "Mức", dataIndex: "level", width: 80, render: (v: string) => <Tag color={LEVEL_COLOR[v] ?? "default"}>{v}</Tag> },
          ...(tab === "integration" ? [{ title: "Hướng", dataIndex: "channel", width: 90, render: (v: string) => CHANNEL_LABEL[v] ?? v }] : []),
          { title: tab === "integration" ? "Nhà cung cấp" : "Nguồn", dataIndex: "provider", width: 120, render: (v: string | null) => (v ? v.toUpperCase() : "—") },
          { title: "Thao tác", dataIndex: "op", render: (v: string | null, r: LogEvent) => v ?? r.event ?? "—" },
          { title: "Kết quả", dataIndex: "outcome", width: 110, render: (v: string | null) => v ?? "—" },
          ...(tab === "integration"
            ? [
                { title: "HTTP", dataIndex: "httpStatus", width: 70, render: (v: number | null) => v ?? "—" },
                { title: "ms", dataIndex: "durationMs", width: 70, align: "right" as const, render: (v: number | null) => v ?? "—" },
                {
                  title: "Bất thường",
                  dataIndex: "anomalyType",
                  width: 160,
                  render: (v: string | null) => (v ? <Tag color="red">{v}</Tag> : <Text type="secondary">—</Text>),
                },
              ]
            : []),
          ...(platform ? [{ title: "Tenant", dataIndex: "tenantId", width: 100, render: (v: string | null) => (v ? v.slice(0, 8) : "—") }] : []),
        ]}
      />
      <div className="mt-3 flex justify-end">
        <Pagination
          current={page}
          pageSize={size}
          total={total}
          showSizeChanger
          pageSizeOptions={SIZES}
          showTotal={(t) => `${t} sự kiện`}
          onChange={(p, sz) => patch({ page: p > 1 ? String(p) : undefined, size: sz !== 20 ? String(sz) : undefined }, true)}
        />
      </div>
    </>
  );
}

/** Nhật ký tích hợp (SePay, MoMo, webhook) và nhật ký hệ thống chọn lọc, hai tab cùng một trang. Dữ liệu lưu ở sales_db, giữ 30 ngày. */
export default function OperationalLogs() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const canIntegration = can(s, PERMISSIONS.LOG_INTEGRATION);
  const canSystem = can(s, PERMISSIONS.LOG_SYSTEM);
  if (!canIntegration && !canSystem) return <NoPermission feature="Nhật ký hệ thống và tích hợp" />;

  const requested = qp(sp, "tab");
  const tab: Tab = requested === "system" && canSystem ? "system" : canIntegration ? "integration" : "system";
  const switchTab = (t: string) => setSp(new URLSearchParams({ tab: t }), { replace: true });
  const replace = (q: URLSearchParams) => setSp(q, { replace: true });

  return (
    <>
      <PageHeader
        title="Nhật ký hệ thống và tích hợp"
        description="Lời gọi sang SePay, MoMo, webhook thanh toán và sự kiện hệ thống. Tự làm mới 15 giây, dữ liệu giữ 30 ngày."
      />
      <Tabs
        activeKey={tab}
        onChange={switchTab}
        items={[
          ...(canIntegration ? [{ key: "integration", label: "Tích hợp", children: tab === "integration" ? <LogTable tab="integration" sp={sp} setSp={replace} /> : null }] : []),
          ...(canSystem ? [{ key: "system", label: "Hệ thống", children: tab === "system" ? <LogTable tab="system" sp={sp} setSp={replace} /> : null }] : []),
        ]}
      />
    </>
  );
}
