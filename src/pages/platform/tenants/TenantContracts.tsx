import { useState } from "react";
import { useNavigate } from "react-router";
import { toErrorInfo, useApi } from "@/api";
import { Alert, Button, DataTable, ErrorPanel, PageSkeleton, PlusOutlined, Tag, formatDate, formatMoney } from "@/ui";
import { ContractFormModal } from "../contracts/ContractFormModal";
import { contractStatusLabel } from "../_lib/contract-format";
import type { Contract, TenantContractList } from "../_lib/contract-types";
import { moduleLabel } from "../_lib/tenant-format";

/** Tab "Hợp đồng" của chi tiết đơn vị: danh sách (mới nhất trước), tạo nháp; mở một hợp đồng để thao tác. */
export function TenantContracts({ tenantId }: { tenantId: string }) {
  const enc = encodeURIComponent(tenantId);
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const q = useApi<TenantContractList>(`/api/platform/tenants/${enc}/contracts`);

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} />;
  const { contracts, modulesOutsideContract } = q.data;
  const real = contracts.filter((c) => c.status !== "DRAFT" && c.status !== "CANCELLED");

  return (
    <div className="flex flex-col gap-3">
      {contracts.length === 0 && (
        <Alert
          type="warning"
          showIcon
          data-testid="no-contract-warning"
          title="Đơn vị này chưa có hợp đồng nào"
          description="Tạo đơn vị không bắt buộc có hợp đồng nên module chạy theo cấu hình tay và không bị hết hạn tự động. Tạo hợp đồng nháp rồi kích hoạt để quản lý thời hạn."
        />
      )}
      {modulesOutsideContract.length > 0 && real.length > 0 && (
        <Alert
          type="info"
          showIcon
          title={`Module bật tay ngoài hợp đồng: ${modulesOutsideContract.map(moduleLabel).join(", ")}`}
          description="Các module này không bị thu hồi khi hợp đồng hết hạn hoặc bị hủy."
        />
      )}
      <div className="flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Tạo hợp đồng
        </Button>
      </div>
      <DataTable
        rowKey="id"
        mobileTitleKey="name"
        rows={contracts}
        columns={[
          { key: "name", title: "Hợp đồng", dataIndex: "name", kind: "link", href: `/platform/tenants/${enc}/contracts/{id}` },
          {
            key: "status",
            title: "Trạng thái",
            dataIndex: "status",
            render: (_, row) => {
              const c = row as unknown as Contract;
              const s = contractStatusLabel(c.status, c.phase);
              return (
                <span className="inline-flex flex-wrap gap-1">
                  <Tag color={s.color}>{s.label}</Tag>
                  {c.legacy && <Tag>Chuyển tiếp</Tag>}
                </span>
              );
            },
          },
          {
            key: "modules",
            title: "Module",
            dataIndex: "modules",
            render: (v) => (
              <span className="flex flex-wrap gap-1">
                {(v as string[]).map((m) => (
                  <Tag key={m}>{moduleLabel(m)}</Tag>
                ))}
              </span>
            ),
          },
          { key: "startDate", title: "Bắt đầu", dataIndex: "startDate", kind: "date" },
          { key: "endDate", title: "Kết thúc", dataIndex: "endDate", render: (v) => (v ? formatDate(v as string) : "Không thời hạn") },
          { key: "totalAmount", title: "Tổng tiền", dataIndex: "totalAmount", align: "right", render: (v) => formatMoney(v as number) },
          { key: "outstandingAmount", title: "Còn nợ", dataIndex: "outstandingAmount", align: "right", render: (v) => formatMoney(v as number) },
        ]}
        empty={{ title: "Chưa có hợp đồng nào." }}
      />
      <ContractFormModal
        mode={{ kind: "create", tenantId }}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={async (c) => {
          await q.refetch();
          nav(`/platform/tenants/${enc}/contracts/${encodeURIComponent(c.id)}`);
        }}
      />
    </div>
  );
}
