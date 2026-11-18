import { useEffect, useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession, type ErrorInfo } from "@/api";
import { Alert, App, Button, Form, Modal, Spin, describeError } from "@/ui";
import { type StockDetails, type StockItem } from "../_lib/sales";
import { StockDetailFields, detailsBody, toDateInput, type StockDetailValues } from "./StockDetailFields";

/**
 * Chi tiết mặt hàng. Giá nhập và ghi chú chỉ hiện khi có khóa getDetails (đọc từ /details; thiếu khóa thì chỉ 5 field từ danh sách).
 * PUT thay toàn bộ nên chỉ cho sửa khi có cả getDetails và updateDetails (không có getDetails thì lưu sẽ xóa giá nhập/ghi chú ngoài ý muốn).
 */
export function StockDetailsModal({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const s = useSession();
  const { message } = App.useApp();
  const canView = can(s, PERMISSIONS.STOCK_DETAILS_VIEW);
  const canSave = canView && can(s, PERMISSIONS.STOCK_DETAILS_UPDATE);
  const path: `/api/${string}` | null = item ? `/api/sales/stock-items/${encodeURIComponent(item.titleId)}/details` : null;
  const q = useApi<StockDetails>(canView ? path : null);
  const [form] = Form.useForm<StockDetailValues>();
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [initialDate, setInitialDate] = useState("");
  const src: Partial<StockDetails> | undefined = canView ? q.data : item ?? undefined;
  const ready = !!item && (!canView || !!q.data);

  useEffect(() => {
    if (!item) return;
    setErr(null);
    if (!ready || !src) return;
    const date = toDateInput(src.lastRestockedAt);
    setInitialDate(date);
    form.setFieldsValue({
      sku: src.sku ?? "",
      supplier: src.supplier ?? "",
      costPrice: src.costPrice ?? null,
      binLocation: src.binLocation ?? "",
      reorderQuantity: src.reorderQuantity ?? null,
      lastRestockedDate: date,
      note: src.note ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.titleId, ready, q.data]);

  const save = useApiMutation((v: StockDetailValues) => apiFetch(path!, { method: "PUT", json: detailsBody(v, true, { initial: initialDate, iso: src?.lastRestockedAt }) }), {
    invalidate: ["/api/sales/stock-items"],
  });
  const submit = async () => {
    let v: StockDetailValues;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    setErr(null);
    try {
      await save.mutateAsync(v);
      message.success("Đã lưu chi tiết mặt hàng.");
      onClose();
    } catch (e) {
      setErr(toErrorInfo(e));
    }
  };

  return (
    <Modal
      open={!!item}
      onCancel={onClose}
      destroyOnHidden
      title={`Chi tiết mặt hàng: ${item?.titleName ?? ""}`}
      footer={
        <>
          <Button onClick={onClose}>{canSave ? "Hủy" : "Đóng"}</Button>
          {canSave && (
            <Button type="primary" loading={save.isPending} disabled={!ready} onClick={() => void submit()}>
              Lưu
            </Button>
          )}
        </>
      }
    >
      {err && <Alert className="mb-3" type="error" showIcon title={describeError(err).text} />}
      {canView && q.isError ? (
        <Alert type="error" showIcon title={describeError(toErrorInfo(q.error)).text} />
      ) : !ready ? (
        <div className="py-6 text-center">
          <Spin />
        </div>
      ) : (
        <Form form={form} layout="vertical" data-testid="stock-details-form" disabled={!canSave}>
          <StockDetailFields showSensitive={canView} disabled={!canSave} />
        </Form>
      )}
    </Modal>
  );
}
