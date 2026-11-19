import { ApiCallError, PERMISSIONS, can, toErrorInfo, useApi, useSession } from "@/api";
import { Alert, Card, DataTable, ErrorPanel, KeyValueList, NoPermission, PageHeader, PageSkeleton, Statistic, Tag, formatDate, formatMoney } from "@/ui";
import { billingCycleText, contractStatusLabel, daysUntil } from "../platform/_lib/contract-format";
import type { TenantContractView } from "../platform/_lib/contract-types";
import { moduleLabel } from "../platform/_lib/tenant-format";

/** Hợp đồng của tenant mình (chỉ đọc): GET /api/contracts/current và /api/contracts. BE không trả giá từng module, ghi chú hay chi tiết thanh toán. */
export default function MyContract() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.CONTRACT_CURRENT) || can(s, PERMISSIONS.CONTRACT_LIST);
  if (s.platformAdmin && !s.tenantId) return <NoPermission feature="Hợp đồng của đơn vị (hãy chọn đơn vị làm việc, hoặc xem ở Nền tảng SaaS, mục Đơn vị)" />;
  if (!allowed) return <NoPermission feature="Hợp đồng thuê dịch vụ" />;
  return <Body />;
}

function Body() {
  const cur = useApi<TenantContractView>("/api/contracts/current", { retry: false });
  const all = useApi<TenantContractView[]>("/api/contracts");
  const noCurrent = cur.isError && cur.error instanceof ApiCallError && (cur.error.status === 404 || cur.error.code === "CONTRACT_NOT_FOUND");

  return (
    <>
      <PageHeader title="Hợp đồng dịch vụ" description="Hợp đồng thuê dịch vụ của đơn vị bạn. Trang chỉ để xem; liên hệ nhà cung cấp để thay đổi." />
      <div className="flex flex-col gap-4">
        {cur.isPending ? (
          <PageSkeleton />
        ) : noCurrent ? (
          <Alert
            type="info"
            showIcon
            data-testid="no-current-contract"
            title="Đơn vị chưa có hợp đồng đang hiệu lực"
            description="Khi có hợp đồng được kích hoạt, thông tin sẽ hiện tại đây."
          />
        ) : cur.isError ? (
          <ErrorPanel error={toErrorInfo(cur.error)} onRetry={() => void cur.refetch()} />
        ) : (
          <Current c={cur.data} />
        )}
        <Card title="Lịch sử hợp đồng" size="small">
          {all.isPending ? (
            <PageSkeleton />
          ) : all.isError ? (
            <ErrorPanel error={toErrorInfo(all.error)} onRetry={() => void all.refetch()} />
          ) : (
            <DataTable
              rowKey="id"
              embedded
              mobileTitleKey="name"
              rows={all.data}
              columns={[
                { key: "name", title: "Hợp đồng", dataIndex: "name" },
                {
                  key: "status",
                  title: "Trạng thái",
                  dataIndex: "status",
                  render: (_, row) => {
                    const c = row as unknown as TenantContractView;
                    const st = contractStatusLabel(c.status, c.phase);
                    return <Tag color={st.color}>{st.label}</Tag>;
                  },
                },
                { key: "startDate", title: "Bắt đầu", dataIndex: "startDate", kind: "date" },
                { key: "endDate", title: "Kết thúc", dataIndex: "endDate", render: (v) => (v ? formatDate(v as string) : "Không thời hạn") },
                { key: "totalAmount", title: "Tổng tiền", dataIndex: "totalAmount", align: "right", kind: "money" },
                { key: "outstandingAmount", title: "Còn nợ", dataIndex: "outstandingAmount", align: "right", kind: "money" },
              ]}
              empty={{ title: "Chưa có hợp đồng nào." }}
            />
          )}
        </Card>
      </div>
    </>
  );
}

function Current({ c }: { c: TenantContractView }) {
  const st = contractStatusLabel(c.status, c.phase);
  const days = daysUntil(c.endDate);
  const grace = c.inGrace || c.phase === "IN_GRACE";
  const soon = !grace && days != null && days <= 30;
  return (
    <>
      {grace && (
        <Alert
          type="warning"
          showIcon
          data-testid="grace-banner"
          title={`Hợp đồng đã hết hạn và đang trong thời gian ân hạn${c.graceEndsDate ? ` tới ${formatDate(c.graceEndsDate)}` : ""}`}
          description="Các module vẫn dùng được trong ân hạn. Hãy liên hệ nhà cung cấp để gia hạn trước khi hết ân hạn, nếu không module sẽ bị tắt."
        />
      )}
      {soon && (
        <Alert
          type="warning"
          showIcon
          data-testid="expiring-banner"
          title={days! <= 0 ? "Hợp đồng hết hạn hôm nay" : `Hợp đồng còn ${days} ngày là hết hạn`}
          description="Hãy liên hệ nhà cung cấp để gia hạn."
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="small">
          <Statistic title="Tổng tiền" value={formatMoney(c.totalAmount)} />
        </Card>
        <Card size="small">
          <Statistic title="Đã thu" value={formatMoney(c.paidAmount)} />
        </Card>
        <Card size="small">
          <Statistic title="Còn nợ" value={formatMoney(c.outstandingAmount)} />
        </Card>
      </div>
      <Card title={c.name}>
        <KeyValueList
          columns={2}
          items={[
            { label: "Trạng thái", value: <Tag color={st.color}>{st.label}</Tag> },
            {
              label: "Module",
              value: (
                <span className="inline-flex flex-wrap gap-1">
                  {c.modules.map((m) => (
                    <Tag key={m}>{moduleLabel(m)}</Tag>
                  ))}
                </span>
              ),
            },
            { label: "Ngày bắt đầu", value: formatDate(c.startDate) },
            { label: "Ngày kết thúc", value: c.endDate ? formatDate(c.endDate) : "Không thời hạn" },
            { label: "Còn lại", value: days == null ? null : days >= 0 ? `${days} ngày` : "Đã quá hạn" },
            { label: "Hết ân hạn", value: c.graceEndsDate ? formatDate(c.graceEndsDate) : null },
            { label: "Chu kỳ thanh toán", value: billingCycleText(c.billingCycle) },
          ]}
        />
      </Card>
    </>
  );
}
