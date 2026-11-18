import { useSearchParams } from "react-router";
import { toErrorInfo, useApi } from "@/api";
import { Alert, DataTable, ErrorPanel, PageHeader, PageSkeleton, Select, Tag, formatDate, formatMoney, Eye, actionsColumn } from "@/ui";
import { PlatformGate } from "../_components/PlatformGate";
import type { ExpiringContract } from "../_lib/contract-types";

const WINDOWS = [7, 14, 30, 60, 90, 180, 365];

export default function ExpiringContractsPage() {
  return (
    <PlatformGate>
      <List />
    </PlatformGate>
  );
}

function List() {
  const [sp, setSp] = useSearchParams();
  const raw = Number.parseInt(sp.get("withinDays") ?? "", 10);
  const withinDays = Number.isFinite(raw) && raw >= 1 && raw <= 365 ? raw : 30;
  const q = useApi<ExpiringContract[]>(`/api/platform/contracts/expiring?withinDays=${withinDays}`);

  return (
    <>
      <PageHeader
        title="Hợp đồng sắp hết hạn"
        description="Hợp đồng đang hiệu lực (không tính hợp đồng chuyển tiếp) sắp tới hạn hoặc đang trong ân hạn, sớm nhất trước."
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">Trong vòng</span>
          <Select
            aria-label="Số ngày tới hạn"
            className="min-w-28"
            value={withinDays}
            options={WINDOWS.map((d) => ({ value: d, label: `${d} ngày` }))}
            onChange={(v) => setSp({ withinDays: String(v) }, { replace: true })}
          />
        </div>
        {q.isPending ? (
          <PageSkeleton />
        ) : q.isError ? (
          <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <>
            {q.data.some((c) => c.inGrace) && (
              <Alert type="warning" showIcon title="Có hợp đồng đang trong ân hạn: module sẽ bị tắt khi hết ân hạn nếu chưa kéo dài hoặc gia hạn." />
            )}
            <DataTable
              rowKey="contractId"
              mobileTitleKey="tenantName"
              rows={q.data}
              columns={[
{ key: "id", title: "ID", dataIndex: "contractId", kind: "id", width: 120 },
                { key: "tenantName", title: "Đơn vị", dataIndex: "tenantName", kind: "link", href: "/platform/tenants/{tenantId}?tab=contracts" },
                { key: "tenantCode", title: "Mã", dataIndex: "tenantCode", kind: "mono" },
                { key: "name", title: "Hợp đồng", dataIndex: "name", kind: "link", href: "/platform/tenants/{tenantId}/contracts/{contractId}" },
                { key: "endDate", title: "Ngày hết hạn", dataIndex: "endDate", kind: "date" },
                {
                  key: "daysLeft",
                  title: "Còn lại",
                  dataIndex: "daysLeft",
                  align: "right",
                  render: (v, row) =>
                    row.inGrace ? (
                      <Tag color="warning">{`Ân hạn tới ${formatDate(row.graceEndsDate as string)}`}</Tag>
                    ) : (
                      <span data-testid="days-left">{`${v as number} ngày`}</span>
                    ),
                },
                { key: "outstandingAmount", title: "Còn nợ", dataIndex: "outstandingAmount", align: "right", render: (v) => formatMoney(v as number) },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/platform/tenants/${encodeURIComponent(String(row.tenantId))}/contracts/${encodeURIComponent(String(row.contractId))}` }], 1),
]}
              empty={{ title: `Không có hợp đồng nào hết hạn trong ${withinDays} ngày tới.` }}
            />
          </>
        )}
      </div>
    </>
  );
}
