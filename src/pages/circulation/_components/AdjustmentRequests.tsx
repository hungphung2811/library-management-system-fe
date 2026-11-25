import { Link, useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Check, DataTable, QueryBoundary, ShortId, Tag, X, actionsColumn, formatMoney, usePageSize, type DataColumn } from "@/ui";
import { FINE_REASONS } from "../_lib/circulation";
import { ADJUSTMENT_TYPES, REQUEST_STATUS, REQUEST_STATUS_COLOR, type Adjustment, type Paged } from "../_lib/compensation";
import { RequestStatusFilter } from "./RequestStatusFilter";
import { useDecisionModal } from "./useDecisionModal";

/** Danh sách yêu cầu miễn/giảm khoản phạt, duyệt hoặc từ chối (người duyệt phải khác người đề nghị, BE kiểm). */
export function AdjustmentRequests() {
  const s = useSession();
  const [sp] = useSearchParams();
  const size = usePageSize();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const status = sp.get("status") ?? "";
  const canApprove = can(s, PERMISSIONS.FINE_ADJUSTMENT_APPROVE);
  const canReject = can(s, PERMISSIONS.FINE_ADJUSTMENT_REJECT);
  const decision = useDecisionModal();
  const qs = new URLSearchParams({ page: String(page - 1), size: String(size) });
  if (status) qs.set("status", status);
  const q = useApi<Paged<Adjustment>>(`/api/fines/adjustment-requests?${qs.toString()}`);

  const summary = (r: Adjustment) => (
    <dl className="m-0 mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="adjustment-summary">
      <dt className="text-muted">Khoản phạt</dt>
      <dd className="m-0">
        {FINE_REASONS[r.fineReason] ?? r.fineReason} · {formatMoney(r.fineAmount)}
      </dd>
      <dt className="text-muted">Đề nghị</dt>
      <dd className="m-0">{r.type === "WAIVE" ? "Miễn toàn phần" : `Giảm còn ${formatMoney(r.payableAmount)}`}</dd>
      <dt className="text-muted">Lý do</dt>
      <dd className="m-0">{r.reason}</dd>
    </dl>
  );

  const columns: DataColumn[] = [
    { key: "at", title: "Đề nghị lúc", dataIndex: "requestedAt", kind: "datetime" },
    {
      key: "reader",
      title: "Độc giả",
      dataIndex: "readerId",
      render: (v) => (
        <Link to={`/circulation/fines?readerId=${encodeURIComponent(String(v))}`}>
          <ShortId value={String(v)} />
        </Link>
      ),
    },
    { key: "fine", title: "Khoản phạt", dataIndex: "fineReason", render: (v, r) => `${FINE_REASONS[String(v)] ?? String(v)} · ${formatMoney(r.fineAmount as number)}` },
    { key: "type", title: "Loại", dataIndex: "type", render: (v) => ADJUSTMENT_TYPES[String(v)] ?? String(v) },
    { key: "payable", title: "Số phải thu mới", dataIndex: "payableAmount", kind: "money", align: "right", render: (v, r) => (r.type === "WAIVE" ? formatMoney(0) : formatMoney(v as number)) },
    { key: "reason", title: "Lý do", dataIndex: "reason" },
    { key: "by", title: "Người đề nghị", dataIndex: "requestedBy", render: (v) => <ShortId value={String(v)} /> },
    {
      key: "status",
      title: "Trạng thái",
      dataIndex: "status",
      render: (v, r) => (
        <span className="inline-flex flex-col gap-1">
          <Tag color={REQUEST_STATUS_COLOR[String(v)]}>{REQUEST_STATUS[String(v)] ?? String(v)}</Tag>
          {r.decisionNote ? <span className="text-xs text-muted">{String(r.decisionNote)}</span> : null}
        </span>
      ),
    },
    actionsColumn(
      (r) => {
        const row = r as unknown as Adjustment;
        const url = `/api/fines/adjustment-requests/${encodeURIComponent(row.id)}` as `/api/${string}`;
        const pending = row.status === "PENDING";
        return [
          { key: "approve", label: "Duyệt", icon: <Check size={16} />, hidden: !(canApprove && pending), onClick: () => decision.openModal({ url, action: "approve", summary: summary(row) }) },
          { key: "reject", label: "Từ chối", icon: <X size={16} />, danger: true, hidden: !(canReject && pending), onClick: () => decision.openModal({ url, action: "reject", summary: summary(row) }) },
        ];
      },
      2,
    ),
  ];

  return (
    <div className="flex flex-col gap-4">
      <RequestStatusFilter id="adjustment-status" />
      <QueryBoundary query={q}>
        {(p) => (
          <DataTable
            columns={columns}
            rows={p.items as unknown as Record<string, unknown>[]}
            rowKey="id"
            mobileTitleKey="fine"
            pagination={{ mode: "server", page, pageSize: size, total: p.total }}
            empty={{ title: "Không có yêu cầu miễn/giảm nào.", hint: "Tạo yêu cầu từ nút trên dòng phạt ở trang Phạt." }}
          />
        )}
      </QueryBoundary>
      {decision.modal}
    </div>
  );
}
