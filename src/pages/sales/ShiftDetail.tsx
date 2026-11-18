import { useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { PERMISSIONS, apiFetch, can, useApi, useInvalidateApi, useSession } from "@/api";
import { Alert, Button, Card, DataTable, Form, FormModal, Input, LinkButton, QueryBoundary, ShortId, Tag, formatDateTime, formatMoney, useDetailModal, type DataColumn } from "@/ui";
import { CloseShiftModal } from "./_components/ShiftModals";
import { SalesGate } from "./_components/SalesGate";
import { label } from "./_lib/sales";
import {
  SHIFT_HISTORY,
  SHIFT_METHODS,
  SHIFT_PHASE,
  SHIFT_PHASE_COLOR,
  VARIANCE_STATUS,
  varianceText,
  type ShiftDetail,
} from "./_lib/shifts";

const METHOD_COLUMNS: DataColumn[] = [
  { key: "m", title: "Phương thức", dataIndex: "method", render: (v) => label(SHIFT_METHODS, v as string) },
  { key: "pc", title: "Số khoản thu", dataIndex: "paymentCount", align: "right" },
  { key: "c", title: "Thu", dataIndex: "collected", kind: "money", align: "right" },
  { key: "rc", title: "Số khoản hoàn", dataIndex: "refundCount", align: "right" },
  { key: "r", title: "Hoàn", dataIndex: "refunded", kind: "money", align: "right" },
  { key: "n", title: "Ròng", dataIndex: "net", kind: "money", align: "right" },
  {
    key: "ac",
    title: "Phát sinh sau chốt",
    dataIndex: "collectedAfterClose",
    align: "right",
    render: (_, r) => {
      const c = Number(r.collectedAfterClose ?? 0);
      const f = Number(r.refundedAfterClose ?? 0);
      return c || f ? `thu ${formatMoney(c)}, hoàn ${formatMoney(f)}` : "—";
    },
  },
];

function Kv({ k, children, testId }: { k: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="m-0" data-testid={testId}>
        {children}
      </dd>
    </>
  );
}

export default function ShiftDetailPage() {
  const s = useSession();
  const inModal = !!useDetailModal();
  const { id = "" } = useParams();
  const admin = can(s, PERMISSIONS.SHIFT_ADMIN_GET);
  const allowed = admin || can(s, PERMISSIONS.SHIFT_GET_MINE);
  const enc = encodeURIComponent(id);
  const q = useApi<ShiftDetail>(allowed ? (admin ? `/api/sales/shifts/${enc}` : `/api/sales/shifts/me/${enc}`) : null);
  const invalidate = useInvalidateApi();
  const [dlg, setDlg] = useState<"approve" | "reopen" | "close" | null>(null);
  const reload = () => void invalidate("/api/sales/shifts");

  return (
    <SalesGate
      title="Chi tiết ca"
      permission={[PERMISSIONS.SHIFT_ADMIN_GET, PERMISSIONS.SHIFT_GET_MINE]}
      actions={inModal ? undefined : <LinkButton to="/sales/shifts">Về danh sách</LinkButton>}
    >
      <QueryBoundary query={q}>
        {(d) => {
          const sh = d.shift;
          return (
            <div className="flex max-w-[1000px] flex-col gap-4" data-testid="shift-detail">
              <Card
                title={
                  <span>
                    Ca <span className="font-mono">{sh.shiftNo}</span>
                  </span>
                }
                extra={<Tag color={SHIFT_PHASE_COLOR[sh.phase]}>{label(SHIFT_PHASE, sh.phase)}</Tag>}
              >
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <Kv k="Thu ngân"><ShortId value={sh.cashierUserId} /></Kv>
                  <Kv k="Quầy">{sh.registerLabel || "—"}</Kv>
                  <Kv k="Mở lúc">{formatDateTime(sh.openedAt)}</Kv>
                  <Kv k="Tiền đầu ca">{formatMoney(sh.openingFloat)}</Kv>
                  {sh.status === "OPEN" && d.provisionalExpectedCash != null && <Kv k="Tiền mặt dự kiến (tạm tính)" testId="shift-provisional">{formatMoney(d.provisionalExpectedCash)}</Kv>}
                  {sh.closedAt && (
                    <>
                      <Kv k="Đóng lúc">{formatDateTime(sh.closedAt)}{sh.closedBy ? <> bởi <ShortId value={sh.closedBy} /></> : null}</Kv>
                      <Kv k="Tiền mặt dự kiến" testId="shift-expected">{sh.expectedCash == null ? "—" : formatMoney(sh.expectedCash)}</Kv>
                      <Kv k="Tiền đếm thực tế" testId="shift-counted">{sh.countedCash == null ? "—" : formatMoney(sh.countedCash)}</Kv>
                      <Kv k="Chênh lệch" testId="shift-variance">{varianceText(sh.variance, formatMoney)}</Kv>
                      {sh.varianceReason && <Kv k="Lý do chênh lệch"><span className="whitespace-pre-wrap">{sh.varianceReason}</span></Kv>}
                    </>
                  )}
                  <Kv k="Duyệt chênh lệch" testId="shift-variance-status">{label(VARIANCE_STATUS, sh.varianceStatus)}</Kv>
                  {sh.approvedAt && <Kv k="Đã duyệt lúc">{formatDateTime(sh.approvedAt)}{sh.approvalNote ? ` · ${sh.approvalNote}` : ""}</Kv>}
                  {sh.reopenCount > 0 && <Kv k="Số lần mở lại">{sh.reopenCount}</Kv>}
                </dl>
                {admin && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sh.varianceStatus === "PENDING_APPROVAL" && can(s, PERMISSIONS.SHIFT_ADMIN_APPROVE_VARIANCE) && (
                      <Button type="primary" onClick={() => setDlg("approve")}>Duyệt chênh lệch</Button>
                    )}
                    {sh.status === "OPEN" && can(s, PERMISSIONS.SHIFT_ADMIN_CLOSE_ON_BEHALF) && <Button onClick={() => setDlg("close")}>Đóng ca thay</Button>}
                    {sh.status === "CLOSED" && can(s, PERMISSIONS.SHIFT_ADMIN_REOPEN) && <Button danger onClick={() => setDlg("reopen")}>Mở lại ca</Button>}
                  </div>
                )}
                {sh.varianceStatus === "PENDING_APPROVAL" && (
                  <Alert className="mt-3" type="warning" showIcon title="Chênh lệch vượt ngưỡng đang chờ quản lý duyệt. Không duyệt thì mở lại ca để thu ngân kiểm lại." />
                )}
              </Card>

              <Card title="Báo cáo theo phương thức thanh toán" data-testid="shift-report">
                <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <Kv k="Số đơn có thu trong ca">{d.report.orderCount}</Kv>
                  <Kv k="Tổng giá trị đơn">{formatMoney(d.report.grandTotal)}</Kv>
                  <Kv k="Tổng giảm giá">{formatMoney(d.report.discountTotal)}</Kv>
                  <Kv k="Tổng thu">{formatMoney(d.report.collectedTotal)}</Kv>
                  <Kv k="Tổng hoàn">{formatMoney(d.report.refundedTotal)}</Kv>
                  <Kv k="Ròng">{formatMoney(d.report.netTotal)}</Kv>
                </dl>
                <DataTable columns={METHOD_COLUMNS} rows={d.report.methods as unknown as Record<string, unknown>[]} rowKey="method" embedded empty={{ title: "Chưa có khoản thu nào." }} />
                <p className="mt-2 mb-0 text-xs text-muted">Chỉ tiền mặt tính vào tiền mặt dự kiến. Phần phát sinh sau chốt đã nằm trong tổng nhưng không đổi số tiền dự kiến đã chụp lúc đóng ca.</p>
              </Card>

              <Card title="Lịch sử ca" data-testid="shift-history">
                <ol className="m-0 flex list-none flex-col gap-1 p-0">
                  {d.history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-baseline gap-2">
                      <Tag>{label(SHIFT_HISTORY, h.type)}</Tag>
                      <span>{formatDateTime(h.occurredAt)}</span>
                      {h.actorId && <span className="text-muted">bởi <ShortId value={h.actorId} /></span>}
                      {typeof h.snapshot?.reason === "string" && <span className="text-muted">Lý do: {h.snapshot.reason}</span>}
                    </li>
                  ))}
                </ol>
              </Card>

              <FormModal<{ note?: string }>
                open={dlg === "approve"}
                title="Duyệt chênh lệch"
                okText="Duyệt"
                onCancel={() => setDlg(null)}
                successMessage="Đã duyệt chênh lệch."
                onSubmit={async (v) => {
                  const note = v.note?.trim();
                  await apiFetch(`/api/sales/shifts/${enc}/variance-approval`, { method: "POST", json: note ? { note } : {} });
                  reload();
                }}
              >
                <p className="mt-0">Chênh lệch {varianceText(sh.variance, formatMoney)}. Duyệt nghĩa là chấp nhận số liệu của ca này.</p>
                <Form.Item name="note" label="Ghi chú (tùy chọn)" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
                  <Input.TextArea rows={2} maxLength={500} showCount />
                </Form.Item>
              </FormModal>
              <FormModal<{ reason: string }>
                open={dlg === "reopen"}
                title={`Mở lại ca ${sh.shiftNo}`}
                okText="Mở lại"
                onCancel={() => setDlg(null)}
                successMessage="Đã mở lại ca."
                onSubmit={async (v) => {
                  await apiFetch(`/api/sales/shifts/${enc}/reopening`, { method: "POST", json: { reason: v.reason.trim() } });
                  reload();
                }}
              >
                <Alert className="mb-4" type="warning" showIcon title="Số liệu đóng ca cũ bị xóa khỏi ca (vẫn còn trong lịch sử); thu ngân đóng lại để có số liệu mới." />
                <Form.Item name="reason" label="Lý do mở lại" rules={[{ required: true, whitespace: true, message: "Nhập lý do" }, { max: 500, message: "Tối đa 500 ký tự" }]}>
                  <Input.TextArea rows={2} maxLength={500} showCount />
                </Form.Item>
              </FormModal>
              <CloseShiftModal
                open={dlg === "close"}
                title={`Đóng thay ca ${sh.shiftNo}`}
                endpoint={`/api/sales/shifts/${enc}/closing`}
                provisional={d.provisionalExpectedCash}
                onClose={() => setDlg(null)}
                onClosed={reload}
              />
            </div>
          );
        }}
      </QueryBoundary>
    </SalesGate>
  );
}
