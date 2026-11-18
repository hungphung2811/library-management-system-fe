import { useState } from "react";
import { PERMISSIONS, can, toErrorInfo, useApi, useInvalidateApi, useSession } from "@/api";
import { Alert, Button, Card, ErrorPanel, Spin, Tag, formatDateTime, formatMoney } from "@/ui";
import {
  INVOICE_KIND,
  INVOICE_NOTICE_FALLBACK,
  INVOICE_STATUS,
  INVOICE_STATUS_COLOR,
  REQUEST_STATUS,
  isEffective,
  type InvoiceRequestView,
  type InvoiceSummary,
  type InvoiceView,
} from "../_lib/invoices";
import { label, type Page, type SalesOrder } from "../_lib/sales";
import { CancelInvoiceModal, IssueInvoiceModal, ReplaceInvoiceModal } from "./InvoiceModals";
import { InvoiceViewModal } from "./InvoiceViewModal";

/**
 * Khối hóa đơn trong chi tiết đơn: hóa đơn còn hiệu lực (xem/in, hủy, thay thế), các hóa đơn điều chỉnh do trả hàng,
 * yêu cầu xuất hóa đơn của khách và nút "Xuất hóa đơn". Mọi nút theo khóa; danh sách hóa đơn của đơn cần khóa search
 * (BE chưa có endpoint "hóa đơn của đơn": tìm theo số đơn rồi lọc theo orderId).
 */
export function InvoicePanel({ order }: { order: SalesOrder }) {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const canSearch = can(s, PERMISSIONS.INVOICE_SEARCH);
  const canIssue = can(s, PERMISSIONS.INVOICE_ISSUE);
  const canGetReq = can(s, PERMISSIONS.INVOICE_REQUEST_GET);
  const canSaveReq = can(s, PERMISSIONS.INVOICE_REQUEST_SAVE);
  const canCancel = can(s, PERMISSIONS.INVOICE_CANCEL);
  const canReplace = can(s, PERMISSIONS.INVOICE_REPLACE);
  const enc = encodeURIComponent(order.id);

  const list = useApi<Page<InvoiceSummary>>(canSearch ? `/api/sales/invoices?keyword=${encodeURIComponent(order.orderNo)}&page=0&size=100` : null);
  const mine = (list.data?.items ?? []).filter((i) => i.orderId === order.id);
  const effective = mine.find(isEffective);
  const cancelled = mine.filter((i) => i.kind !== "ADJUSTMENT_DECREASE" && i.status === "CANCELLED");

  const detail = useApi<InvoiceView>(effective && can(s, PERMISSIONS.INVOICE_GET) ? `/api/sales/invoices/${encodeURIComponent(effective.id)}` : null);
  const req = useApi<InvoiceRequestView>(canGetReq ? `/api/sales/orders/${enc}/invoice-request` : null);
  const request = req.data && req.data.status !== "WITHDRAWN" ? req.data : null;
  // 404: đơn chưa có yêu cầu xuất hóa đơn (không phải lỗi).
  const reqError = req.isError && toErrorInfo(req.error).status !== 404 ? toErrorInfo(req.error) : null;

  const [view, setView] = useState<string | null>(null);
  const [dlg, setDlg] = useState<"issue" | "cancel" | "replace" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const reload = () => {
    void invalidate("/api/sales/invoices", `/api/sales/orders/${enc}/invoice-request`);
  };

  if (!canSearch && !canIssue && !canGetReq) return null;

  const invoiceable = order.status === "COMPLETED" && order.paymentStatus === "PAID";
  const notice = detail.data?.notice ?? INVOICE_NOTICE_FALLBACK;
  const adjustments = (detail.data?.adjustments ?? []).length ? detail.data!.adjustments! : mine.filter((i) => i.kind === "ADJUSTMENT_DECREASE");

  return (
    <Card title="Hóa đơn VAT" data-testid="invoice-panel" loading={canSearch && list.isPending}>
      <div className="flex flex-col gap-3">
        <Alert type="warning" showIcon data-testid="invoice-notice" title={notice} description="Chưa có giá trị pháp lý của hóa đơn điện tử; cần tư vấn kế toán trước khi dùng cho kê khai thuế." />
        {flash && <Alert type="success" showIcon closable onClose={() => setFlash(null)} title={flash} />}
        {list.isError && <ErrorPanel error={toErrorInfo(list.error)} onRetry={() => void list.refetch()} />}
        {reqError && <ErrorPanel error={reqError} onRetry={() => void req.refetch()} />}

        {effective ? (
          <div className="flex flex-col gap-2" data-testid="invoice-current">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-semibold" data-testid="invoice-number">
                {effective.invoiceNumber}
              </span>
              <Tag color={INVOICE_STATUS_COLOR[effective.status]}>{label(INVOICE_STATUS, effective.status)}</Tag>
              <span className="text-muted">{label(INVOICE_KIND, effective.kind)}</span>
              <span className="text-muted">
                Mẫu {effective.templateCode}, ký hiệu {effective.series}
              </span>
            </div>
            <div className="text-sm text-muted">
              Lập {effective.issuedAt ? formatDateTime(effective.issuedAt) : "—"} · {effective.buyerCompany || effective.buyerName || "—"}
              {effective.buyerTaxCode ? ` (MST ${effective.buyerTaxCode})` : ""} · {formatMoney(effective.grandTotal)}
            </div>
            <div className="flex flex-wrap gap-2">
              {(can(s, PERMISSIONS.INVOICE_PRINT) || can(s, PERMISSIONS.INVOICE_GET)) && (
                <Button onClick={() => setView(effective.id)}>Xem và in</Button>
              )}
              {canCancel && (
                <Button danger disabled={!detail.data || adjustments.length > 0} onClick={() => setDlg("cancel")}>
                  Hủy hóa đơn
                </Button>
              )}
              {canReplace && (
                <Button disabled={!detail.data || adjustments.length > 0} onClick={() => setDlg("replace")}>
                  Thay thế hóa đơn
                </Button>
              )}
            </div>
            {(canCancel || canReplace) && adjustments.length > 0 && (
              <p className="m-0 text-xs text-muted">Hóa đơn đã có hóa đơn điều chỉnh (do trả hàng) nên không hủy hoặc thay thế được.</p>
            )}
            {detail.isPending && can(s, PERMISSIONS.INVOICE_GET) && <Spin size="small" />}
            {detail.isError && <ErrorPanel error={toErrorInfo(detail.error)} onRetry={() => void detail.refetch()} />}
          </div>
        ) : (
          canSearch &&
          !list.isPending && <p className="m-0 text-muted" data-testid="invoice-none">Đơn này chưa có hóa đơn còn hiệu lực.</p>
        )}

        {adjustments.length > 0 && (
          <div data-testid="invoice-adjustments">
            <div className="mb-1 font-medium">Hóa đơn điều chỉnh do trả hàng</div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {adjustments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{a.invoiceNumber}</span>
                  <Tag color="warning">{INVOICE_KIND.ADJUSTMENT_DECREASE}</Tag>
                  <span>-{formatMoney(Math.abs(a.grandTotal))}</span>
                  <span className="text-muted">{a.issuedAt ? formatDateTime(a.issuedAt) : ""}</span>
                  <Button size="small" onClick={() => setView(a.id)}>
                    Xem
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cancelled.length > 0 && (
          <div data-testid="invoice-cancelled">
            <div className="mb-1 font-medium">Hóa đơn đã hủy</div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {cancelled.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{c.invoiceNumber}</span>
                  <Tag color="error">{INVOICE_STATUS.CANCELLED}</Tag>
                  <span className="text-muted">{label(INVOICE_KIND, c.kind)}</span>
                  <Button size="small" onClick={() => setView(c.id)}>
                    Xem
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {request && (
          <div className="text-sm" data-testid="invoice-request">
            <span className="font-medium">Yêu cầu xuất hóa đơn:</span> <Tag>{label(REQUEST_STATUS, request.status)}</Tag>{" "}
            {request.buyerCompany || request.buyerName || "—"}
            {request.buyerTaxCode ? ` (MST ${request.buyerTaxCode})` : ""} · {request.source === "ONLINE" ? "khách gửi trực tuyến" : "tại quầy"}
          </div>
        )}

        {!effective && canIssue && (
          <div>
            {invoiceable ? (
              <Button type="primary" onClick={() => setDlg("issue")}>
                Xuất hóa đơn
              </Button>
            ) : (
              <p className="m-0 text-sm text-muted">Chỉ xuất được hóa đơn khi đơn đã hoàn tất và đã thu tiền.</p>
            )}
          </div>
        )}
      </div>

      <IssueInvoiceModal
        order={order}
        request={request}
        canSaveRequest={canSaveReq}
        open={dlg === "issue"}
        onClose={() => setDlg(null)}
        onIssued={(i) => {
          setFlash(`Đã xuất hóa đơn ${i.invoiceNumber ?? ""}.`);
          reload();
        }}
      />
      {detail.data && (
        <>
          <CancelInvoiceModal invoice={detail.data} open={dlg === "cancel"} onClose={() => setDlg(null)} onDone={reload} />
          <ReplaceInvoiceModal
            invoice={detail.data}
            open={dlg === "replace"}
            onClose={() => setDlg(null)}
            onDone={(i) => {
              setFlash(`Đã thay thế bằng hóa đơn ${i.invoiceNumber ?? ""}.`);
              reload();
            }}
          />
        </>
      )}
      <InvoiceViewModal invoiceId={view} onClose={() => setView(null)} />
    </Card>
  );
}
