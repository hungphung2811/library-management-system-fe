import { useMemo } from "react";
import { DataTable, FilterBar, formatMoney, useFilterParams, type FilterField } from "@/ui";
import { FINE_REASONS, shortId, type FineView } from "../_lib/circulation";

const PAGE_SIZES = [10, 20, 50];

/** Danh sách phạt của một độc giả (BE trả đủ, nên lọc/phân trang phía client): trạng thái, lý do, khoảng ngày phát sinh, tổng theo bộ lọc. */
export function FinesTable({ fines }: { fines: FineView[] }) {
  const schema = useMemo<FilterField[]>(
    () => [
      {
        type: "select",
        name: "fineStatus",
        label: "Trạng thái",
        options: [
          { value: "UNPAID", label: "Chưa thanh toán" },
          { value: "PAID", label: "Đã thanh toán" },
        ],
      },
      {
        type: "multiselect",
        name: "reason",
        label: "Lý do",
        options: Object.entries(FINE_REASONS).map(([value, label]) => ({ value, label })),
      },
      { type: "dateRange", name: "created", label: "Ngày phát sinh" },
    ],
    [],
  );
  const f = useFilterParams(schema, { defaultSize: 20 });
  const status = f.str("fineStatus");
  const reasons = f.list("reason");
  const range = f.range("created");

  const filtered = fines.filter((x) => {
    const day = String(x.createdAt ?? "").slice(0, 10);
    return (
      (!status || x.status === status) &&
      (reasons.length === 0 || reasons.includes(x.reason)) &&
      (!range.from || day >= range.from) &&
      (!range.to || day <= range.to)
    );
  });
  const sum = (list: FineView[]) => list.reduce((a, x) => a + Number(x.amount), 0);
  const rows = filtered.map((x) => ({
    id: x.id,
    createdAt: x.createdAt,
    reason: FINE_REASONS[x.reason] ?? x.reason,
    borrowing: shortId(x.borrowingId),
    amount: x.amount,
    status: x.status,
    paidAt: x.paidAt,
  }));

  return (
    <div className="flex flex-col gap-3">
      <FilterBar filters={f} total={rows.length} unit="khoản phạt" pageSizes={PAGE_SIZES} />
      <div className="text-sm text-muted" data-testid="fine-filter-total">
        Tổng theo bộ lọc: <b className="font-semibold text-ink">{formatMoney(sum(filtered))}</b>
        {" · "}chưa thanh toán: <b className="font-semibold text-ink">{formatMoney(sum(filtered.filter((x) => x.status === "UNPAID")))}</b>
      </div>
      <DataTable
        key={`${f.params.toString()}|${f.size}`}
        rowKey="id"
        rows={rows}
        mobileTitleKey="reason"
        pagination={{ mode: "client", pageSize: f.size }}
        empty={
          f.hasFilter
            ? { title: "Không có khoản phạt nào khớp bộ lọc." }
            : { title: "Độc giả không có khoản phạt nào." }
        }
        columns={[
          { key: "createdAt", title: "Ngày phát sinh", dataIndex: "createdAt", kind: "date" },
          { key: "reason", title: "Lý do", dataIndex: "reason" },
          { key: "borrowing", title: "Phiếu mượn", dataIndex: "borrowing", kind: "mono" },
          { key: "amount", title: "Số tiền", dataIndex: "amount", kind: "money", align: "right" },
          { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "fine" },
          { key: "paidAt", title: "Ngày thanh toán", dataIndex: "paidAt", kind: "date" },
        ]}
      />
    </div>
  );
}
