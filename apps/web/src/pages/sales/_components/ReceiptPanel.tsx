import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Button, QueryBoundary, formatDateTime, formatMoney } from "@/ui";
import { ALL_PAYMENT_METHODS, bpsToPercent, label, type PrintReceipt } from "../_lib/sales";

/**
 * Phiếu bán hàng in được (GET /api/sales/orders/{id}/receipt, khóa SalesOrderController/receipt).
 * In bằng window.print(); khung ứng dụng bị ẩn nhờ data-print-scope ở SalesLayout, các phần khác của trang dùng `print:hidden`.
 */
export function ReceiptPanel({ orderId }: { orderId: string }) {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.SALES_ORDER_RECEIPT);
  const q = useApi<PrintReceipt>(allowed ? `/api/sales/orders/${encodeURIComponent(orderId)}/receipt` : null);
  if (!allowed) return null;
  return (
    <QueryBoundary query={q}>
      {(r) => (
        <div className="flex flex-col gap-3">
          <div className="print:hidden">
            <Button type="primary" onClick={() => window.print()}>
              In phiếu
            </Button>
          </div>
          <article
            data-testid="sales-receipt"
            aria-label={`Phiếu bán hàng ${r.orderNo}`}
            className="w-full max-w-[420px] rounded-card border border-line bg-surface p-4 text-sm text-ink print:max-w-none print:border-0 print:p-0"
          >
            <h2 className="m-0 text-center text-base font-semibold">PHIẾU BÁN HÀNG</h2>
            <div className="mt-1 text-center text-muted">
              Số <span className="font-mono">{r.orderNo}</span> · {formatDateTime(r.issuedAt)}
            </div>
            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="py-1 font-medium">Mặt hàng</th>
                  <th className="py-1 text-right font-medium">SL</th>
                  <th className="py-1 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l) => (
                  <tr key={l.lineNo} className="align-top">
                    <td className="py-1 pr-2">
                      {l.titleName}
                      <div className="text-xs text-muted">
                        {formatMoney(l.unitPrice)}
                        {l.discount > 0 ? ` · giảm ${formatMoney(l.discount)}` : ""}
                      </div>
                    </td>
                    <td className="py-1 text-right">{l.quantity}</td>
                    <td className="py-1 text-right">{formatMoney(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-line pt-2">
              <dt>Tạm tính</dt>
              <dd className="m-0 text-right">{formatMoney(r.subtotal)}</dd>
              {r.discountTotal > 0 && (
                <>
                  <dt>Giảm giá</dt>
                  <dd className="m-0 text-right">-{formatMoney(r.discountTotal)}</dd>
                </>
              )}
              <dt>
                VAT {bpsToPercent(r.vatRateBps)}% {r.pricesIncludeVat ? "(đã gồm trong giá)" : ""}
              </dt>
              <dd className="m-0 text-right">{formatMoney(r.vatTotal)}</dd>
              {r.shippingFee > 0 && (
                <>
                  <dt>Phí vận chuyển</dt>
                  <dd className="m-0 text-right">{formatMoney(r.shippingFee)}</dd>
                </>
              )}
              <dt className="font-semibold">Tổng thanh toán</dt>
              <dd className="m-0 text-right text-base font-semibold" data-testid="receipt-grand-total">
                {formatMoney(r.grandTotal)}
              </dd>
              <dt>Hình thức</dt>
              <dd className="m-0 text-right">{label(ALL_PAYMENT_METHODS, r.paymentMethod)}</dd>
            </dl>
            <p className="mt-3 mb-0 text-center text-xs text-muted">Cảm ơn quý khách.</p>
          </article>
        </div>
      )}
    </QueryBoundary>
  );
}
