import { Link, useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Check, DataTable, QueryBoundary, ShortId, Tag, X, actionsColumn, formatDate, formatMoney, usePageSize, type DataColumn } from "@/ui";
import { REFUND_METHODS, REFUND_MODES, REQUEST_STATUS, REQUEST_STATUS_COLOR, type Paged, type Refund } from "../_lib/compensation";
import { RequestStatusFilter } from "./RequestStatusFilter";
import { useDecisionModal } from "./useDecisionModal";

/** Danh sách yêu cầu hoàn khoản khi tìm lại sách đã báo mất, duyệt hoặc từ chối. */
export function RefundRequests() {
  const s = useSession();
  const [sp] = useSearchParams();
  const size = usePageSize();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const status = sp.get("status") ?? "";
  const canApprove = can(s, PERMISSIONS.FINE_REFUND_APPROVE);
  const canReject = can(s, PERMISSIONS.FINE_REFUND_REJECT);
  const decision = useDecisionModal();
  const qs = new URLSearchParams({ page: String(page - 1), size: String(size) });
  if (status) qs.set("status", status);
  const q = useApi<Paged<Refund>>(`/api/fines/refund-requests?${qs.toString()}`);

  const amountText = (r: Refund) =>
    r.mode === "REFUND" ? `Hoàn ${formatMoney(r.refundAmount)}` : r.mode === "WAIVE" ? "Miễn toàn phần khoản mất" : "Không hoàn tiền";

  const summary = (r: Refund) => (
    <dl className="m-0 mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="refund-summary">
      <dt className="text-muted">Hình thức</dt>
      <dd className="m-0">{REFUND_MODES[r.mode] ?? r.mode}</dd>
      <dt className="text-muted">Kết quả</dt>
      <dd className="m-0 font-semibold">{amountText(r)}</dd>
      <dt className="text-muted">Sách sau khi tìm lại</dt>
      <dd className="m-0">{r.restoreStatus === "AVAILABLE" ? "Về kho, sẵn sàng" : "Về kho, đánh dấu hư hỏng"}</dd>
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
    { key: "copy", title: "Bản sao", dataIndex: "bookCopyId", render: (v) => <ShortId value={String(v)} /> },
    { key: "lost", title: "Báo mất / tìm lại", dataIndex: "lostOn", render: (v, r) => `${formatDate(v as string)} / ${formatDate(r.foundOn as string)}` },
    { key: "mode", title: "Hình thức", dataIndex: "mode", render: (v) => REFUND_MODES[String(v)] ?? String(v) },
    {
      key: "amount",
      title: "Thu / phí / hoàn",
      dataIndex: "refundAmount",
      align: "right",
      render: (_, r) => (r.mode === "REFUND" ? `${formatMoney(r.collectedAmount as number)} / ${formatMoney(r.processingFee as number)} / ${formatMoney(r.refundAmount as number)}` : "—"),
    },
    { key: "method", title: "Phương thức", dataIndex: "refundMethod", render: (v, r) => (r.mode === "REFUND" ? `${REFUND_METHODS[String(v)] ?? String(v)}${r.referenceCode ? ` · ${String(r.referenceCode)}` : ""}` : "—") },
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
        const row = r as unknown as Refund;
        const url = `/api/fines/refund-requests/${encodeURIComponent(row.id)}` as `/api/${string}`;
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
      <RequestStatusFilter id="refund-status" />
      <QueryBoundary query={q}>
        {(p) => (
          <DataTable
            columns={columns}
            rows={p.items as unknown as Record<string, unknown>[]}
            rowKey="id"
            mobileTitleKey="mode"
            pagination={{ mode: "server", page, pageSize: size, total: p.total }}
            empty={{ title: "Không có yêu cầu hoàn khoản nào.", hint: "Yêu cầu sinh ra khi ghi nhận tìm lại sách đã báo mất." }}
          />
        )}
      </QueryBoundary>
      {decision.modal}
    </div>
  );
}
