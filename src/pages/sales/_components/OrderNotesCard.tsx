import { useEffect, useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession, type ErrorInfo } from "@/api";
import { Alert, App, Button, Card, Form, Input, QueryBoundary, describeError, formatDate } from "@/ui";
import type { OrderNotes, SalesOrder } from "../_lib/sales";

type Values = { staffNote?: string; expectedDeliveryDate?: string };

/** Ghi chú nội bộ và ngày giao dự kiến: xem khi có khóa getNotes, sửa khi có updateNotes. Gửi kèm version; lệch thì 409 và có nút tải lại. */
export function OrderNotesCard({ order }: { order: SalesOrder }) {
  const s = useSession();
  const { message } = App.useApp();
  const canUpdate = can(s, PERMISSIONS.SALES_ORDER_NOTES_UPDATE);
  const path: `/api/${string}` = `/api/sales/orders/${encodeURIComponent(order.id)}/notes`;
  const q = useApi<OrderNotes>(path);
  const [form] = Form.useForm<Values>();
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const deliverable = order.fulfilment === "PICKUP" || order.fulfilment === "DELIVERY";

  useEffect(() => {
    if (q.data) form.setFieldsValue({ staffNote: q.data.staffNote ?? "", expectedDeliveryDate: q.data.expectedDeliveryDate ?? "" });
  }, [q.data, form]);

  const save = useApiMutation(
    (v: Values & { version: number }) =>
      apiFetch<OrderNotes>(path, {
        method: "PUT",
        json: { staffNote: v.staffNote?.trim() || null, expectedDeliveryDate: deliverable && v.expectedDeliveryDate ? v.expectedDeliveryDate : null, version: v.version },
      }),
    { invalidate: ["/api/sales/orders"] },
  );
  const submit = async (version: number) => {
    let v: Values;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    setErr(null);
    try {
      await save.mutateAsync({ ...v, version });
      message.success("Đã lưu ghi chú.");
    } catch (e) {
      setErr(toErrorInfo(e));
    }
  };

  return (
    <Card title="Ghi chú nội bộ và ngày giao" data-testid="order-notes">
      <QueryBoundary query={q}>
        {(n) =>
          canUpdate ? (
            <Form form={form} layout="vertical">
              {err && (
                <Alert
                  className="mb-3"
                  type="error"
                  showIcon
                  title={describeError(err).text}
                  action={
                    err.code === "ORDER_STATE_CONFLICT" ? (
                      <Button size="small" onClick={() => void q.refetch().then(() => setErr(null))}>
                        Tải lại
                      </Button>
                    ) : undefined
                  }
                />
              )}
              <Form.Item name="staffNote" label="Ghi chú nội bộ" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
                <Input.TextArea rows={3} maxLength={500} showCount />
              </Form.Item>
              <Form.Item
                name="expectedDeliveryDate"
                label="Ngày giao dự kiến"
                extra={deliverable ? undefined : "Chỉ áp dụng cho đơn nhận tại cửa hàng hoặc giao tận nơi."}
              >
                <Input type="date" disabled={!deliverable} aria-label="Ngày giao dự kiến" />
              </Form.Item>
              <Button type="primary" loading={save.isPending} onClick={() => void submit(n.version)}>
                Lưu ghi chú
              </Button>
            </Form>
          ) : (
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">Ghi chú nội bộ</dt>
              <dd className="m-0 whitespace-pre-wrap">{n.staffNote || "—"}</dd>
              <dt className="text-muted">Ngày giao dự kiến</dt>
              <dd className="m-0">{formatDate(n.expectedDeliveryDate)}</dd>
            </dl>
          )
        }
      </QueryBoundary>
    </Card>
  );
}
