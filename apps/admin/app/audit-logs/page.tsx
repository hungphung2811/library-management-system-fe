import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { Button, ErrorPanel, Input, NoPermission, PageHeader } from "@mfe/ui";
import { load, pageNo, qp } from "../data";
import type { AuditLogView, PageView } from "../types";
import { AuditTable } from "./AuditTable";

const PAGE_SIZE = 20;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireSession("/admin/audit-logs");
  const sp = await searchParams;
  const aggregateId = qp(sp.aggregateId);
  const eventType = qp(sp.eventType);
  const page = pageNo(sp.page);

  if (!can(s, PERMISSIONS.AUDIT_SEARCH)) {
    return (
      <>
        <NoPermission feature="Nhật ký hoạt động" />
      </>
    );
  }

  const params = new URLSearchParams({ page: String(page - 1), size: String(PAGE_SIZE) });
  if (aggregateId) params.set("aggregateId", aggregateId);
  if (eventType) params.set("eventType", eventType);
  const logs = await load<PageView<AuditLogView>>(`/api/audit-logs?${params}`);

  return (
    <>
      <PageHeader title="Nhật ký hoạt động" description="Các sự kiện nghiệp vụ được ghi lại trong hệ thống." />
      <div className="flex max-w-[1200px] flex-col gap-4">
        {/* Form GET thuần: hoạt động cả khi JS chưa tải; nộp form là về trang 1. */}
        <form method="get" action="/admin/audit-logs" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-1 basis-64 flex-col gap-1 text-sm sm:max-w-sm">
            Mã đối tượng
            <Input name="aggregateId" defaultValue={aggregateId} allowClear autoComplete="off" />
          </label>
          <label className="flex min-w-56 flex-col gap-1 text-sm">
            Loại sự kiện
            <Input name="eventType" defaultValue={eventType} allowClear autoComplete="off" />
          </label>
          <Button type="primary" htmlType="submit">
            Tìm
          </Button>
          {(aggregateId || eventType) && <Button href="/admin/audit-logs">Xóa bộ lọc</Button>}
        </form>
        {logs.error ? (
          <ErrorPanel error={logs.error} retryHref="/admin/audit-logs" />
        ) : (
          <AuditTable
            rows={logs.data.items.map((l) => ({
              ...l,
              payload: typeof l.payload === "string" ? l.payload : JSON.stringify(l.payload ?? null),
            }))}
            page={page}
            pageSize={PAGE_SIZE}
            total={logs.data.total}
            filtered={!!(aggregateId || eventType)}
          />
        )}
      </div>
    </>
  );
}
