import { Alert, DataTable, LinkButton, formatMoney } from "@/ui";
import { FINE_REASONS, type FineView } from "../_lib/circulation";

/** Khoản phạt vừa phát sinh sau khi trả hỏng/báo mất (BE trả trong `fines[]` của phiếu), kèm link sang màn Phạt của độc giả. */
export function NewFinesAlert({ fines, readerId }: { fines: FineView[]; readerId: string }) {
  if (fines.length === 0) return null;
  const total = fines.reduce((a, f) => a + Number(f.amount), 0);
  return (
    <Alert
      type="warning"
      showIcon
      title={`Phát sinh ${fines.length} khoản phạt, tổng ${formatMoney(total)}.`}
      description={
        <div className="flex flex-col gap-2">
          <DataTable
            embedded
            rowKey="id"
            mobileTitleKey="reason"
            empty={{ title: "Không có khoản phạt" }}
            columns={[
              { key: "reason", title: "Lý do", dataIndex: "reason" },
              { key: "amount", title: "Số tiền", dataIndex: "amount", kind: "money", align: "right", width: 160 },
            ]}
            rows={fines.map((f) => ({ id: f.id, reason: FINE_REASONS[f.reason] ?? f.reason, amount: Number(f.amount) }))}
          />
          <div>
            <LinkButton to={`/circulation/fines?readerId=${encodeURIComponent(readerId)}`}>Xem phạt của độc giả</LinkButton>
          </div>
        </div>
      }
    />
  );
}
