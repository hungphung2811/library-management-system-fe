import { useEffect, useState } from "react";
import { PERMISSIONS, can, toErrorInfo, useApi, useInvalidateApi, useSession } from "@/api";
import { Alert, Button, ErrorPanel, Tag, formatDateTime, formatMoney } from "@/ui";
import { SHIFT_PHASE, SHIFT_PHASE_COLOR, VARIANCE_STATUS, varianceText, type ShiftDetail, type ShiftView } from "../_lib/shifts";
import { label } from "../_lib/sales";
import { CloseShiftModal, OpenShiftModal } from "./ShiftModals";

/**
 * Thanh trạng thái ca của tôi trong POS: chưa mở / đang mở (tiền đầu ca, tiền mặt dự kiến tạm tính), nút Mở ca và Đóng ca.
 * Chỉ hiện khi người dùng có khóa xem ca hiện tại. Tenant có thể bật cờ chặn bán khi chưa mở ca (BE trả 409 SHIFT_NOT_OPEN):
 * khi đó POS gọi `openSignal` để mở hộp thoại Mở ca. Cờ tắt thì vẫn bán được nhưng tiền không vào ca nào, nên thanh này cảnh báo.
 */
export function ShiftBar({ openSignal = 0 }: { openSignal?: number }) {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const canCurrent = can(s, PERMISSIONS.SHIFT_CURRENT);
  const canOpen = can(s, PERMISSIONS.SHIFT_OPEN);
  const canClose = can(s, PERMISSIONS.SHIFT_CLOSE);
  const q = useApi<ShiftDetail>(canCurrent ? "/api/sales/shifts/me/current" : null);
  const [dlg, setDlg] = useState<"open" | "close" | null>(null);
  const [closed, setClosed] = useState<ShiftView | null>(null);
  useEffect(() => {
    if (openSignal > 0 && canOpen) setDlg("open");
  }, [openSignal, canOpen]);

  if (!canCurrent) return null;
  const reload = () => void invalidate("/api/sales/shifts");
  const err = q.isError ? toErrorInfo(q.error) : null;
  const none = err?.status === 404;
  const cur = q.data?.shift;

  return (
    <section aria-label="Ca thu ngân của tôi" data-testid="shift-bar" className="mb-4 flex flex-col gap-2">
      {closed && (
        <Alert
          type={closed.varianceStatus === "PENDING_APPROVAL" ? "warning" : "success"}
          showIcon
          closable
          onClose={() => setClosed(null)}
          data-testid="shift-closed"
          title={`Đã đóng ca ${closed.shiftNo}`}
          description={
            <span>
              Tiền đếm {formatMoney(closed.countedCash ?? 0)}, dự kiến {formatMoney(closed.expectedCash ?? 0)}, chênh lệch {varianceText(closed.variance, formatMoney)}.{" "}
              {closed.varianceStatus === "PENDING_APPROVAL" ? "Chênh lệch vượt ngưỡng, đang chờ quản lý duyệt." : null}
            </span>
          }
        />
      )}
      {q.isPending && <div className="text-sm text-muted">Đang tải trạng thái ca...</div>}
      {err && !none && <ErrorPanel error={err} onRetry={() => void q.refetch()} />}
      {none && (
        <Alert
          type="warning"
          showIcon
          data-testid="shift-none"
          title="Bạn chưa mở ca"
          description="Tiền thu và hoàn trong lúc chưa mở ca không được tính vào ca nào. Nếu cửa hàng yêu cầu mở ca, không bán được cho tới khi bạn mở ca."
          action={
            canOpen ? (
              <Button type="primary" size="small" onClick={() => setDlg("open")}>
                Mở ca
              </Button>
            ) : undefined
          }
        />
      )}
      {cur && (
        <Alert
          type="success"
          showIcon
          data-testid="shift-open"
          title={
            <span>
              Ca <span className="font-mono">{cur.shiftNo}</span> <Tag color={SHIFT_PHASE_COLOR[cur.phase]}>{label(SHIFT_PHASE, cur.phase)}</Tag>
            </span>
          }
          description={
            <span>
              Mở lúc {formatDateTime(cur.openedAt)}{cur.registerLabel ? ` · ${cur.registerLabel}` : ""} · tiền đầu ca <span data-testid="shift-float">{formatMoney(cur.openingFloat)}</span>
              {q.data?.provisionalExpectedCash != null ? <> · tiền mặt dự kiến (tạm tính) {formatMoney(q.data.provisionalExpectedCash)}</> : null}
              {cur.varianceStatus === "PENDING_APPROVAL" ? ` · ${VARIANCE_STATUS.PENDING_APPROVAL}` : null}
            </span>
          }
          action={
            canClose ? (
              <Button size="small" onClick={() => setDlg("close")}>
                Đóng ca
              </Button>
            ) : undefined
          }
        />
      )}
      <OpenShiftModal open={dlg === "open"} onClose={() => setDlg(null)} onOpened={() => reload()} />
      <CloseShiftModal
        open={dlg === "close"}
        title={cur ? `Đóng ca ${cur.shiftNo}` : "Đóng ca"}
        endpoint="/api/sales/shifts/me/current/closing"
        provisional={q.data?.provisionalExpectedCash}
        onClose={() => setDlg(null)}
        onClosed={(sh) => {
          setClosed(sh);
          reload();
        }}
      />
    </section>
  );
}
