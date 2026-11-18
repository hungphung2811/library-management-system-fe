import type { ReactNode } from "react";
import { apiFetch } from "@/api";
import { Alert, ClipboardCheck, FormModal, useFormModal, type RowAction } from "@/ui";
import { CopyAcquisitionFields, acquisitionInitial, acquisitionPayload, type AcquisitionValues } from "./CopyAcquisitionFields";
import type { CopyView } from "./types";

/**
 * Thao tác "Thông tin nhập kho" (nút icon) + hộp thoại 6 field (PUT /api/book-copies/{id}/acquisition).
 * PUT thay toàn bộ nên luôn gửi lại đủ 6 field; ô để trống = xóa. `modal` phải được render ngoài bảng.
 */
export function useAcquisitionAction(copy: CopyView): { action: RowAction; modal: ReactNode } {
  const form = useFormModal<AcquisitionValues>({
    title: `Thông tin nhập kho «${copy.barcode}»`,
    successMessage: "Đã cập nhật thông tin nhập kho.",
    invalidate: ["/api/book-copies"],
    initialValues: acquisitionInitial(copy),
    request: (v) =>
      apiFetch(`/api/book-copies/${encodeURIComponent(copy.id)}/acquisition`, {
        method: "PUT",
        json: acquisitionPayload(v),
      }),
  });
  const action: RowAction = {
    key: "acquisition",
    label: `Thông tin nhập kho của ${copy.barcode}`,
    icon: <ClipboardCheck size={16} />,
    onClick: () => form.openModal(),
  };
  const modal = (
    <FormModal<AcquisitionValues> {...form.modalProps}>
      <Alert type="info" showIcon className="mb-4" title="Lưu sẽ thay toàn bộ thông tin nhập kho: ô để trống sẽ bị xóa." />
      <CopyAcquisitionFields />
    </FormModal>
  );
  return { action, modal };
}
