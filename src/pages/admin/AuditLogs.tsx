import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { AutoComplete } from "antd";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Button, DatePicker, Input, LinkButton, NoPermission, PageHeader, PageSkeleton, Select, dayjs } from "@/ui";
import { AuditTable } from "./_components/AuditTable";
import { ErrorBlock } from "./_components/ErrorBlock";
import { FilterChips, type Chip } from "./_components/FilterChips";
import { keepPreviousData, pageNo, qp } from "./_lib/params";
import type { AuditLogView, PageView } from "./_lib/types";

const SIZES = [10, 20, 50, 100];
/** Loại sự kiện phổ biến (gợi ý; vẫn gõ tự do được). */
const EVENT_TYPES = [
  "UserCreated",
  "UserStatusChanged",
  "RoleAssigned",
  "RoleRevoked",
  "TitleCreated",
  "BookCopyAdded",
  "BorrowingCreated",
  "BookReturned",
  "BookRenewed",
  "ReservationCreated",
  "FinePaid",
  "OrderCompleted",
].map((v) => ({ value: v }));
const DEBOUNCE_MS = 400;
const TENANT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditLogsPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const aggregateId = qp(sp, "aggregateId");
  const eventType = qp(sp, "eventType");
  const from = qp(sp, "from");
  const to = qp(sp, "to");
  const sizeRaw = Number.parseInt(qp(sp, "size"), 10);
  const pageSize = SIZES.includes(sizeRaw) ? sizeRaw : 20;
  const page = pageNo(sp);
  // Chỉ platform admin (token không tenantId) lọc được theo tenant; người khác BE bỏ qua tham số nên không hiện ô.
  const platform = s.platformAdmin;
  const tenantId = platform ? qp(sp, "tenantId") : "";
  const tenantInvalid = !!tenantId && !TENANT_UUID_RE.test(tenantId);
  const [tenantInput, setTenantInput] = useState(tenantId);
  useEffect(() => setTenantInput(tenantId), [tenantId]);
  const allowed = can(s, PERMISSIONS.AUDIT_SEARCH);

  // Ô nhập giữ giá trị cục bộ, debounce rồi đẩy lên URL (nút "Tìm" đẩy ngay).
  const [agg, setAgg] = useState(aggregateId);
  const [type, setType] = useState(eventType);
  const pushed = useRef({ aggregateId, eventType });

  const patch = (changes: Record<string, string | undefined>, keepPage = false) => {
    const q = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(changes)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    if (!keepPage) q.delete("page");
    setSp(q, { replace: true });
  };

  // URL đổi từ ngoài (Xóa bộ lọc, chip) thì đồng bộ ô nhập.
  useEffect(() => {
    if (pushed.current.aggregateId !== aggregateId || pushed.current.eventType !== eventType) {
      pushed.current = { aggregateId, eventType };
      setAgg(aggregateId);
      setType(eventType);
    }
  }, [aggregateId, eventType]);

  useEffect(() => {
    const a = agg.trim();
    const t = type.trim();
    if (a === aggregateId && t === eventType) return;
    const id = setTimeout(() => {
      pushed.current = { aggregateId: a, eventType: t };
      patch({ aggregateId: a || undefined, eventType: t || undefined });
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agg, type]);

  const params = new URLSearchParams({ page: String(page - 1), size: String(pageSize) });
  if (aggregateId) params.set("aggregateId", aggregateId);
  if (eventType) params.set("eventType", eventType);
  if (tenantId && !tenantInvalid) params.set("tenantId", tenantId);
  const logs = useApi<PageView<AuditLogView>>(allowed ? `/api/audit-logs?${params}` : null, {
    placeholderData: keepPreviousData,
  });

  if (!allowed) return <NoPermission feature="Nhật ký hoạt động" />;
  if (logs.isPending) return <PageSkeleton />;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    pushed.current = { aggregateId: agg.trim(), eventType: type.trim() };
    patch({ aggregateId: agg.trim() || undefined, eventType: type.trim() || undefined, ...(platform ? { tenantId: tenantInput.trim() || undefined } : {}) });
  };

  const hasServerFilter = !!(aggregateId || eventType || tenantId);
  const hasFilter = hasServerFilter || !!(from || to);
  const chips: Chip[] = [
    ...(aggregateId ? [{ key: "agg", label: `Mã đối tượng: ${aggregateId}`, onClose: () => patch({ aggregateId: undefined }) }] : []),
    ...(tenantId ? [{ key: "tenant", label: `Tenant: ${tenantId}`, onClose: () => { setTenantInput(""); patch({ tenantId: undefined }); } }] : []),
    ...(eventType ? [{ key: "type", label: `Loại: ${eventType}`, onClose: () => patch({ eventType: undefined }) }] : []),
    ...(from || to
      ? [{ key: "date", label: `Ngày: ${from ? dayjs(from).format("DD/MM/YYYY") : "…"} – ${to ? dayjs(to).format("DD/MM/YYYY") : "…"}`, onClose: () => patch({ from: undefined, to: undefined }, true) }]
      : []),
  ];

  const items = logs.data?.items ?? [];
  // Khoảng ngày lọc phía client, chỉ trên dữ liệu của trang hiện tại (BE chưa có tham số ngày).
  const rows = items
    .filter((l) => {
      if (!from && !to) return true;
      const d = dayjs(l.occurredAt);
      if (from && d.isBefore(dayjs(from).startOf("day"))) return false;
      if (to && d.isAfter(dayjs(to).endOf("day"))) return false;
      return true;
    })
    .map((l) => ({
      ...l,
      payload: typeof l.payload === "string" ? l.payload : JSON.stringify(l.payload ?? null),
    }));
  const dateFiltered = !!(from || to);
  const total = logs.data?.total ?? 0;

  return (
    <>
      <PageHeader title="Nhật ký hoạt động" description="Các sự kiện nghiệp vụ được ghi lại trong hệ thống." />
      <div className="flex max-w-[1200px] flex-col gap-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-1 basis-64 flex-col gap-1 text-sm sm:max-w-sm">
            Mã đối tượng
            <Input name="aggregateId" value={agg} onChange={(e) => setAgg(e.target.value)} allowClear autoComplete="off" />
          </label>
          <label className="flex min-w-56 flex-col gap-1 text-sm">
            Loại sự kiện
            <AutoComplete
              value={type}
              options={EVENT_TYPES}
              onChange={(v: string) => setType(v ?? "")}
              allowClear
              filterOption={(input, o) => (o?.value ?? "").toLowerCase().includes(input.toLowerCase())}
              placeholder="Chọn hoặc gõ loại sự kiện"
              className="min-w-56"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            Khoảng ngày (trên trang này)
            <DatePicker.RangePicker
              aria-label="Khoảng ngày"
              format="DD/MM/YYYY"
              value={from && to ? [dayjs(from), dayjs(to)] : null}
              onChange={(v) => patch({ from: v?.[0]?.format("YYYY-MM-DD"), to: v?.[1]?.format("YYYY-MM-DD") }, true)}
            />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            Số dòng
            <Select
              aria-label="Số dòng mỗi trang"
              className="min-w-28"
              value={pageSize}
              options={SIZES.map((n) => ({ value: n, label: `${n} / trang` }))}
              onChange={(v) => patch({ size: v === 20 ? undefined : String(v) })}
            />
          </div>
          {platform && (
            <label className="flex min-w-72 flex-col gap-1 text-sm">
              Mã tenant (UUID)
              <Input
                name="tenantId"
                value={tenantInput}
                onChange={(e) => setTenantInput(e.target.value)}
                allowClear
                autoComplete="off"
                spellCheck={false}
                status={tenantInvalid ? "error" : undefined}
                placeholder="Để trống: mọi tenant"
              />
              {tenantInvalid && <span className="text-xs text-red-600">Mã tenant phải có dạng UUID; đang bỏ qua khi tìm.</span>}
            </label>
          )}
          <Button type="primary" htmlType="submit">
            Tìm
          </Button>
          {hasFilter && <LinkButton to={sp.get("size") ? `/admin/audit-logs?size=${sp.get("size")}` : "/admin/audit-logs"}>Xóa bộ lọc</LinkButton>}
        </form>
        <FilterChips
          chips={chips}
          count={logs.isError ? undefined : `${dateFiltered ? `${rows.length} / ` : ""}${total} sự kiện`}
        />
        {logs.isError ? (
          <ErrorBlock query={logs} />
        ) : (
          <AuditTable rows={rows} page={page} pageSize={pageSize} total={total} filtered={hasFilter} loading={logs.isPlaceholderData} showTenant={platform} />
        )}
      </div>
    </>
  );
}
