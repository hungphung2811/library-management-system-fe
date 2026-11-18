import { usePageSize, Eye, actionsColumn } from "@/ui";
import { useSearchParams } from "react-router";
import { toErrorInfo, useApi } from "@/api";
import { DataTable, DatePicker, ErrorPanel, PageHeader, PageSkeleton, Select, dayjs } from "@/ui";
import { ServerPager } from "../admin/_components/ServerPager";
import { keepPreviousData, pageNo, qp } from "../admin/_lib/params";
import { PlatformGate } from "./_components/PlatformGate";
import { BUSINESS_LABELS, CONTACT_STATUS_OPTIONS, PLATFORM_ERRORS, maskEmail } from "./_lib/format";
import type { ContactRequestPage } from "./_lib/types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Ngày lọc (YYYY-MM-DD, giờ địa phương) -> ISO instant; `to` là ngày cuối gồm cả ngày nên gửi đầu ngày kế tiếp (BE: `to` không gồm). */
export function toInstant(day: string, end: boolean): string | null {
  if (!DAY.test(day)) return null;
  const d = dayjs(day);
  if (!d.isValid()) return null;
  return (end ? d.add(1, "day") : d).startOf("day").toISOString();
}

export default function ContactRequestsPage() {
  return (
    <PlatformGate>
      <List />
    </PlatformGate>
  );
}

function List() {
  const [sp, setSp] = useSearchParams();
  const status = qp(sp, "status");
  const from = qp(sp, "from");
  const to = qp(sp, "to");
  const page = pageNo(sp);
  const PAGE_SIZE = usePageSize();
  const hasFilter = !!(status || from || to);

  const params = new URLSearchParams({ page: String(page - 1), size: String(PAGE_SIZE) });
  if (status) params.set("status", status);
  const fromIso = toInstant(from, false);
  const toIso = toInstant(to, true);
  if (fromIso) params.set("from", fromIso);
  if (toIso) params.set("to", toIso);

  const q = useApi<ContactRequestPage>(`/api/cms/contact-requests?${params}`, { placeholderData: keepPreviousData });

  const set = (name: string, v?: string | null) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(name, v);
    else n.delete(name);
    n.delete("page");
    setSp(n, { replace: true });
  };

  if (q.isPending) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        title="Yêu cầu liên hệ"
        description="Yêu cầu liên hệ và dùng thử của bên muốn mua dịch vụ. Chứa dữ liệu cá nhân: email được che, mở chi tiết để xem."
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Lọc theo trạng thái"
            className="min-w-44"
            placeholder="Trạng thái"
            allowClear
            value={status || undefined}
            options={CONTACT_STATUS_OPTIONS}
            onChange={(v) => set("status", v)}
          />
          <DatePicker
            aria-label="Từ ngày"
            placeholder="Từ ngày"
            value={DAY.test(from) ? dayjs(from) : null}
            onChange={(d) => set("from", d ? d.format("YYYY-MM-DD") : null)}
          />
          <DatePicker
            aria-label="Đến ngày"
            placeholder="Đến ngày"
            value={DAY.test(to) ? dayjs(to) : null}
            onChange={(d) => set("to", d ? d.format("YYYY-MM-DD") : null)}
          />
        </div>
        {q.isError ? (
          <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} messages={PLATFORM_ERRORS} />
        ) : (
          <div>
            <DataTable
              rowKey="id"
              loading={q.isPlaceholderData}
              mobileTitleKey="organization"
              rows={q.data.items.map((r) => ({
                ...r,
                organization: r.organization ?? "(không ghi)",
                email: r.anonymizedAt ? "Đã ẩn danh" : maskEmail(r.email),
                businessLabel: BUSINESS_LABELS[r.businessType] ?? r.businessType,
              }))}
              columns={[
{ key: "id", title: "ID", dataIndex: "id", kind: "id", width: 120 },
                { key: "organization", title: "Đơn vị", dataIndex: "organization", kind: "link", href: "/platform/contact-requests/{id}" },
                { key: "businessLabel", title: "Loại hình", dataIndex: "businessLabel" },
                { key: "email", title: "Email (đã che)", dataIndex: "email" },
                { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "contact" },
                { key: "createdAt", title: "Gửi lúc", dataIndex: "createdAt", kind: "datetime" },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/platform/contact-requests/${encodeURIComponent(String(row.id))}` }], 1),
]}
              empty={
                hasFilter
                  ? { title: "Không có yêu cầu khớp bộ lọc.", action: { label: "Xóa bộ lọc", href: "/platform/contact-requests" } }
                  : { title: "Chưa có yêu cầu liên hệ nào." }
              }
            />
            <ServerPager page={page} pageSize={PAGE_SIZE} total={q.data.total} />
          </div>
        )}
      </div>
    </>
  );
}
