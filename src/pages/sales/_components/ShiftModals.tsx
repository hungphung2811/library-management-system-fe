import { useEffect, useRef, useState } from "react";
import { ApiCallError, apiFetch } from "@/api";
import { Alert, Form, FormModal, Input, formatMoney } from "@/ui";
import { varianceText, type ShiftView } from "../_lib/shifts";
import { newRequestId } from "../_lib/sales";
import { MoneyInput } from "./MoneyInput";

/** Mở ca: tiền đầu ca (>= 0) và nhãn quầy tùy chọn. Gửi lại cùng clientRequestId thì BE trả ca cũ, không mở thêm. */
export function OpenShiftModal({ open, onClose, onOpened }: { open: boolean; onClose: () => void; onOpened: (s: ShiftView) => void }) {
  const reqId = useRef(newRequestId());
  useEffect(() => {
    if (open) reqId.current = newRequestId();
  }, [open]);
  return (
    <FormModal<{ openingFloat: number; registerLabel?: string }>
      open={open}
      title="Mở ca thu ngân"
      okText="Mở ca"
      onCancel={onClose}
      initialValues={{ openingFloat: 0, registerLabel: "" }}
      successMessage="Đã mở ca."
      onSubmit={async (v) => {
        const label = v.registerLabel?.trim();
        const s = await apiFetch<ShiftView>("/api/sales/shifts", {
          method: "POST",
          json: { openingFloat: v.openingFloat ?? 0, ...(label ? { registerLabel: label } : {}), clientRequestId: reqId.current },
        });
        onOpened(s);
      }}
    >
      <Form.Item name="openingFloat" label="Tiền đầu ca (tiền mặt trong két lúc mở)" rules={[{ required: true, message: "Nhập tiền đầu ca (0 nếu không có)" }]}>
        <MoneyInput max={1_000_000_000} />
      </Form.Item>
      <Form.Item name="registerLabel" label="Quầy (tùy chọn)" rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}>
        <Input autoComplete="off" placeholder="Ví dụ: Quầy 1" />
      </Form.Item>
    </FormModal>
  );
}

type CloseValues = { countedCash: number; varianceReason?: string };

function CloseBody({ provisional, needReason }: { provisional?: number | null; needReason: boolean }) {
  const form = Form.useFormInstance<CloseValues>();
  const counted = Form.useWatch("countedCash", form) as number | null | undefined;
  const preview = provisional != null && counted != null ? counted - provisional : null;
  return (
    <>
      {provisional != null && (
        <p className="mt-0 mb-3" data-testid="close-provisional">
          Tiền mặt dự kiến tạm tính: <strong>{formatMoney(provisional)}</strong>. Số chốt do hệ thống tính lại khi đóng ca.
        </p>
      )}
      <Form.Item name="countedCash" label="Tiền mặt đếm thực tế" rules={[{ required: true, message: "Nhập số tiền đã đếm" }]}>
        <MoneyInput max={1_000_000_000} />
      </Form.Item>
      {preview != null && (
        <p className="mt-0 mb-3 text-sm" data-testid="close-variance-preview" aria-live="polite">
          Chênh lệch tạm tính: <strong>{varianceText(preview, formatMoney)}</strong>
        </p>
      )}
      <Form.Item
        name="varianceReason"
        label="Lý do chênh lệch"
        extra="Bắt buộc khi chênh lệch vượt ngưỡng cửa hàng đã đặt; ca chuyển sang chờ quản lý duyệt."
        rules={[
          { max: 500, message: "Tối đa 500 ký tự" },
          ...(needReason ? [{ required: true, whitespace: true, message: "Nhập lý do chênh lệch" }] : []),
        ]}
      >
        <Input.TextArea rows={2} maxLength={500} showCount />
      </Form.Item>
    </>
  );
}

/**
 * Đóng ca (của tôi hoặc quản lý đóng thay): nhập tiền đếm thực tế, hệ thống tính tiền dự kiến và chênh lệch lúc đóng.
 * `endpoint` là `/api/sales/shifts/me/current/closing` hoặc `/api/sales/shifts/{id}/closing`.
 * 400 SHIFT_VARIANCE_REASON_REQUIRED: ô lý do chuyển thành bắt buộc. 409 SHIFT_HAS_PENDING_PAYMENTS: báo số lệnh thu tay còn chờ.
 */
export function CloseShiftModal({
  open,
  endpoint,
  title,
  provisional,
  onClose,
  onClosed,
}: {
  open: boolean;
  endpoint: string;
  title: string;
  provisional?: number | null;
  onClose: () => void;
  onClosed: (s: ShiftView) => void;
}) {
  const [needReason, setNeedReason] = useState(false);
  useEffect(() => {
    if (open) setNeedReason(false);
  }, [open]);
  return (
    <FormModal<CloseValues>
      open={open}
      title={title}
      okText="Đóng ca"
      onCancel={onClose}
      initialValues={{ varianceReason: "" }}
      onSubmit={async (v) => {
        const reason = v.varianceReason?.trim();
        try {
          const s = await apiFetch<ShiftView>(endpoint as `/api/${string}`, {
            method: "POST",
            json: { countedCash: v.countedCash, ...(reason ? { varianceReason: reason } : {}) },
          });
          onClosed(s);
        } catch (e) {
          if (e instanceof ApiCallError && e.code === "SHIFT_VARIANCE_REASON_REQUIRED") setNeedReason(true);
          if (e instanceof ApiCallError && e.code === "SHIFT_HAS_PENDING_PAYMENTS") {
            const n = (e.details ?? []).find((d) => d.startsWith("pendingPayments="))?.split("=")[1];
            throw new ApiCallError(e.status, e.code, n ? `Số lệnh thu tay đang chờ: ${n}.` : e.message);
          }
          throw e;
        }
      }}
    >
      {needReason && <Alert className="mb-4" type="warning" showIcon title="Chênh lệch vượt ngưỡng: hãy nhập lý do rồi đóng ca lại." />}
      <CloseBody provisional={provisional} needReason={needReason} />
    </FormModal>
  );
}
