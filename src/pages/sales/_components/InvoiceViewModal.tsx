import { useEffect, useRef, useState } from "react";
import { PERMISSIONS, can, toErrorInfo, useApi, useSession, type ErrorInfo } from "@/api";
import { Alert, Button, DataTable, ErrorPanel, Modal, Spin, Tag, describeError, formatDateTime, formatMoney, type DataColumn } from "@/ui";
import {
  INVOICE_KIND,
  INVOICE_NOTICE_FALLBACK,
  INVOICE_STATUS,
  INVOICE_STATUS_COLOR,
  fetchInvoiceHtml,
  type InvoiceView,
} from "../_lib/invoices";
import { label } from "../_lib/sales";

const LINE_COLUMNS: DataColumn[] = [
  { key: "n", title: "#", dataIndex: "lineNo", width: 44 },
  { key: "t", title: "Hàng hóa", dataIndex: "itemName" },
  { key: "q", title: "SL", dataIndex: "quantity", align: "right" },
  { key: "p", title: "Đơn giá", dataIndex: "unitPrice", kind: "money", align: "right" },
  { key: "d", title: "Giảm", dataIndex: "discount", kind: "money", align: "right" },
  { key: "v", title: "Thuế", dataIndex: "vatRateBps", align: "right", render: (v) => (v == null ? "KCT" : `${Number(v) / 100}%`) },
  { key: "a", title: "Thành tiền", dataIndex: "lineTotal", kind: "money", align: "right" },
];

/**
 * Bản in HTML của hóa đơn trong iframe sandbox. HTML lấy bằng fetch có token rồi đưa vào `srcDoc`; KHÔNG chèn vào DOM của app.
 * sandbox không có `allow-scripts` (không chạy được mã nào, kể cả khi HTML bị sửa), có `allow-same-origin` chỉ để nút "In" gọi được
 * `print()` của khung và `allow-modals` để hộp thoại in mở được.
 */
export function InvoicePrintFrame({ invoiceId, title }: { invoiceId: string; title: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [tick, setTick] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let live = true;
    setHtml(null);
    setError(null);
    fetchInvoiceHtml(invoiceId).then(
      (h) => live && setHtml(h),
      (e) => live && setError(toErrorInfo(e)),
    );
    return () => {
      live = false;
    };
  }, [invoiceId, tick]);

  if (error) return <ErrorPanel error={error} onRetry={() => setTick((n) => n + 1)} />;
  if (html == null)
    return (
      <div className="flex justify-center p-8" role="status" aria-label="Đang tải bản in">
        <Spin />
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end print:hidden">
        <Button
          onClick={() => {
            const w = frame.current?.contentWindow;
            w?.focus();
            w?.print();
          }}
        >
          In hóa đơn
        </Button>
      </div>
      <iframe
        ref={frame}
        title={title}
        data-testid="invoice-print-frame"
        sandbox="allow-same-origin allow-modals"
        referrerPolicy="no-referrer"
        srcDoc={html}
        className="h-[60vh] w-full rounded-control border border-line bg-white"
      />
    </div>
  );
}

/** Xem hóa đơn: cảnh báo `notice` của BE, tóm tắt, dòng hàng (cần khóa get) và bản in (cần khóa print). */
export function InvoiceViewModal({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const s = useSession();
  const canGet = can(s, PERMISSIONS.INVOICE_GET);
  const canPrint = can(s, PERMISSIONS.INVOICE_PRINT);
  const q = useApi<InvoiceView>(invoiceId && canGet ? `/api/sales/invoices/${encodeURIComponent(invoiceId)}` : null);
  const inv = q.data;
  return (
    <Modal
      open={invoiceId != null}
      title={inv ? `Hóa đơn ${inv.invoiceNumber ?? "(chưa có số)"}` : "Hóa đơn"}
      width={900}
      centered
      footer={null}
      onCancel={onClose}
      destroyOnHidden
    >
      {invoiceId && (
        <div className="flex flex-col gap-3" data-testid="invoice-view">
          <Alert type="warning" showIcon data-testid="invoice-notice" title={inv?.notice ?? INVOICE_NOTICE_FALLBACK} description="Chưa có giá trị pháp lý của hóa đơn điện tử." />
          {canGet && q.isPending && <Spin />}
          {canGet && q.isError && <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} />}
          {inv && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Tag color={INVOICE_STATUS_COLOR[inv.status]}>{label(INVOICE_STATUS, inv.status)}</Tag>
                <span>{label(INVOICE_KIND, inv.kind)}</span>
                <span className="text-muted">
                  Mẫu {inv.templateCode}, ký hiệu {inv.series}
                </span>
                {inv.issuedAt && <span className="text-muted">Lập {formatDateTime(inv.issuedAt)}</span>}
              </div>
              {inv.status === "CANCELLED" && (
                <Alert type="error" showIcon title={`Đã hủy ${inv.cancelledAt ? formatDateTime(inv.cancelledAt) : ""}`.trim()} description={inv.cancelReason ? `Lý do: ${inv.cancelReason}` : undefined} />
              )}
              {inv.originalInvoiceNumber && <p className="m-0 text-sm text-muted">Liên quan hóa đơn gốc số {inv.originalInvoiceNumber}.</p>}
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted">Người bán</dt>
                <dd className="m-0">
                  {inv.seller.legalName} (MST {inv.seller.taxCode})
                </dd>
                <dt className="text-muted">Người mua</dt>
                <dd className="m-0">
                  {inv.buyer.company || inv.buyer.name || "—"}
                  {inv.buyer.taxCode ? ` (MST ${inv.buyer.taxCode})` : ""}
                </dd>
                <dt className="text-muted">Tổng thanh toán</dt>
                <dd className="m-0 font-semibold">
                  {formatMoney(inv.grandTotal)} <span className="font-normal text-muted">(thuế {formatMoney(inv.vatTotal)})</span>
                </dd>
                {inv.amountInWords && (
                  <>
                    <dt className="text-muted">Bằng chữ</dt>
                    <dd className="m-0">{inv.amountInWords}</dd>
                  </>
                )}
              </dl>
              <DataTable columns={LINE_COLUMNS} rows={inv.lines as unknown as Record<string, unknown>[]} rowKey="lineNo" embedded empty={{ title: "Hóa đơn không có dòng nào." }} />
            </>
          )}
          {canPrint ? (
            <InvoicePrintFrame invoiceId={invoiceId} title="Bản in hóa đơn" />
          ) : (
            <p className="m-0 text-sm text-muted">Bạn chưa có quyền in hóa đơn.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Lỗi gọn cho thao tác nút: hiện câu tiếng Việt, không phải lỗi của form. */
export const errText = (e: unknown) => describeError(toErrorInfo(e)).text;
