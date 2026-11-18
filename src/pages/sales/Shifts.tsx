import { useMemo, useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, Card, DataTable, Eye, FilterBar, Form, QueryBoundary, Switch, Tag, actionsColumn, dayjs, describeError, formatDateTime, formatMoney, useFilterParams, type DataColumn, type FilterField } from "@/ui";
import { MoneyInput } from "./_components/MoneyInput";
import { SalesGate } from "./_components/SalesGate";
import { SHIFT_PHASE, SHIFT_PHASE_COLOR, VARIANCE_STATUS, varianceText, type ShiftSettings, type ShiftView } from "./_lib/shifts";
import { label, type Page } from "./_lib/sales";

const SCHEMA: FilterField[] = [
  { type: "select", name: "status", label: "Trạng thái ca", options: [{ value: "OPEN", label: "Đang mở" }, { value: "CLOSED", label: "Đã đóng" }] },
  { type: "select", name: "varianceStatus", label: "Chênh lệch", options: Object.entries(VARIANCE_STATUS).map(([value, l]) => ({ value, label: l })) },
  { type: "text", name: "cashierUserId", label: "Mã thu ngân (UUID)", placeholder: "Mã thu ngân (UUID)" },
  { type: "dateRange", name: "opened", label: "Ngày mở ca" },
];

type SettingsValues = { requireOpenShiftForPos: boolean; varianceThreshold: number };

/** Cấu hình ca của tenant: cờ chặn bán khi chưa mở ca và ngưỡng chênh lệch (đồng). Sửa kèm `version` đã đọc. */
function ShiftSettingsCard({ data, canUpdate, onReload }: { data: ShiftSettings; canUpdate: boolean; onReload: () => void }) {
  const { message } = App.useApp();
  const [error, setError] = useState<ReturnType<typeof toErrorInfo> | null>(null);
  const save = useApiMutation(
    (v: SettingsValues) => apiFetch<ShiftSettings>("/api/sales/shift-settings", { method: "PUT", json: { ...v, version: data.version } }),
    { invalidate: ["/api/sales/shift-settings"] },
  );
  const d = error ? describeError(error) : null;
  return (
    <Card title="Cấu hình ca" data-testid="shift-settings" className="max-w-[720px]">
      <Form<SettingsValues>
        layout="vertical"
        disabled={!canUpdate}
        initialValues={{ requireOpenShiftForPos: data.requireOpenShiftForPos, varianceThreshold: data.varianceThreshold }}
        onFinish={(v) => {
          setError(null);
          save.mutate(v, { onSuccess: () => message.success("Đã lưu cấu hình ca."), onError: (e) => setError(toErrorInfo(e)) });
        }}
      >
        {d && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title={d.text}
            description={d.details?.length ? d.details.join("; ") : undefined}
            action={error?.code === "SETTINGS_VERSION_CONFLICT" ? <Button size="small" onClick={onReload}>Tải lại cấu hình</Button> : undefined}
          />
        )}
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item
            name="requireOpenShiftForPos"
            label="Bắt buộc mở ca mới được bán"
            valuePropName="checked"
            extra="Bật: tạo đơn POS, xác nhận thu tay và hoàn tiền mặt khi chưa mở ca sẽ bị chặn. Tắt: vẫn bán được nhưng tiền không vào ca nào."
          >
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>
          <Form.Item
            name="varianceThreshold"
            label="Ngưỡng chênh lệch tiền mặt khi đóng ca"
            rules={[{ required: true, message: "Nhập ngưỡng (0 nếu mọi chênh lệch đều cần lý do)" }]}
            extra="Chênh lệch vượt ngưỡng thì bắt buộc nhập lý do và chờ quản lý duyệt. 0 nghĩa là mọi chênh lệch khác 0."
          >
            <MoneyInput max={1_000_000_000} />
          </Form.Item>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canUpdate && (
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              Lưu cấu hình ca
            </Button>
          )}
          <span className="text-sm text-muted">
            Phiên bản {data.version}
            {data.updatedAt ? ` · cập nhật ${formatDateTime(data.updatedAt)}` : " · đang dùng mặc định, chưa từng lưu"}
          </span>
        </div>
      </Form>
    </Card>
  );
}

function SettingsSection() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.SHIFT_SETTINGS_GET);
  const q = useApi<ShiftSettings>(allowed ? "/api/sales/shift-settings" : null);
  if (!allowed) return null;
  return (
    <QueryBoundary query={q}>
      {(d) => <ShiftSettingsCard key={d.version} data={d} canUpdate={can(s, PERMISSIONS.SHIFT_SETTINGS_UPDATE)} onReload={() => void q.refetch()} />}
    </QueryBoundary>
  );
}

/** Danh sách ca: quản lý xem mọi ca của cửa hàng; thu ngân (chỉ có khóa "của tôi") chỉ xem ca của mình. */
export default function ShiftsPage() {
  const s = useSession();
  const admin = can(s, PERMISSIONS.SHIFT_ADMIN_SEARCH);
  const mine = !admin && can(s, PERMISSIONS.SHIFT_MINE);
  const f = useFilterParams(SCHEMA, { defaultSize: 20 });
  const range = f.range("opened");
  const query = useMemo(() => {
    const q = new URLSearchParams();
    const keys = admin ? ["status", "varianceStatus", "cashierUserId"] : ["status"];
    for (const k of keys) if (f.str(k)) q.set(k, f.str(k));
    if (admin && range.from) q.set("from", dayjs(range.from).startOf("day").toISOString());
    if (admin && range.to) q.set("to", dayjs(range.to).add(1, "day").startOf("day").toISOString());
    q.set("page", String(f.page - 1));
    q.set("size", String(f.size));
    return q.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.values, f.page, f.size, admin]);
  const path = admin ? `/api/sales/shifts?${query}` : mine ? `/api/sales/shifts/me?${query}` : null;
  const q = useApi<Page<ShiftView>>(path as `/api/${string}` | null);
  const canDetail = admin ? can(s, PERMISSIONS.SHIFT_ADMIN_GET) : can(s, PERMISSIONS.SHIFT_GET_MINE);

  const columns: DataColumn[] = [
    canDetail
      ? { key: "no", title: "Ca", dataIndex: "shiftNo", kind: "link", href: "/sales/shifts/{id}" }
      : { key: "no", title: "Ca", dataIndex: "shiftNo", kind: "mono" },
    ...(admin ? [{ key: "cashier", title: "Thu ngân", dataIndex: "cashierUserId", kind: "id" as const }] : []),
    { key: "reg", title: "Quầy", dataIndex: "registerLabel" },
    { key: "phase", title: "Trạng thái", dataIndex: "phase", render: (v) => <Tag color={SHIFT_PHASE_COLOR[v as string]}>{label(SHIFT_PHASE, v as string)}</Tag> },
    { key: "open", title: "Mở lúc", dataIndex: "openedAt", kind: "datetime" },
    { key: "close", title: "Đóng lúc", dataIndex: "closedAt", kind: "datetime" },
    { key: "float", title: "Tiền đầu ca", dataIndex: "openingFloat", kind: "money", align: "right" },
    { key: "exp", title: "Dự kiến", dataIndex: "expectedCash", render: (v) => (v == null ? "—" : formatMoney(v as number)), align: "right" },
    { key: "cnt", title: "Đếm thực tế", dataIndex: "countedCash", render: (v) => (v == null ? "—" : formatMoney(v as number)), align: "right" },
    { key: "var", title: "Chênh lệch", dataIndex: "variance", render: (v, r) => (
      <span>
        {varianceText(v as number | null, formatMoney)}
        {r.varianceStatus && r.varianceStatus !== "NONE" ? <span className="ml-1 text-xs text-muted">({label(VARIANCE_STATUS, r.varianceStatus as string)})</span> : null}
      </span>
    ) },
    ...(canDetail ? [actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/sales/shifts/${encodeURIComponent(String(row.id))}` }], 1)] : []),
  ];

  const filters = admin ? f : { ...f, schema: SCHEMA.filter((x) => x.name === "status") };
  return (
    <SalesGate
      title="Ca thu ngân"
      description={admin ? "Mọi ca của cửa hàng: đóng thay, mở lại, duyệt chênh lệch tiền mặt." : "Các ca của bạn."}
      permission={[PERMISSIONS.SHIFT_ADMIN_SEARCH, PERMISSIONS.SHIFT_MINE]}
    >
      <div className="flex flex-col gap-4">
        <SettingsSection />
        <FilterBar filters={filters} total={q.data?.total} unit="ca" />
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              mobileTitleKey="no"
              pagination={{ mode: "server", page: f.page, pageSize: f.size, total: p.total, onSizeChange: f.setSize }}
              empty={{ title: "Chưa có ca nào.", hint: f.hasFilter ? "Thử đổi hoặc bỏ bộ lọc." : "Ca được tạo khi thu ngân mở ca ở màn Bán tại quầy." }}
            />
          )}
        </QueryBoundary>
      </div>
    </SalesGate>
  );
}
