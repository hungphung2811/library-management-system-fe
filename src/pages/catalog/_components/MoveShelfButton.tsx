import type { ReactNode } from "react";
import { apiFetch } from "@/api";
import { Form, FormModal, MapPin, useFormModal, type RowAction } from "@/ui";
import { OptionSelect } from "./ClassificationFields";
import type { CopyView } from "./types";

type Values = { shelfLocationId?: string };

/**
 * Thao tác "Đổi kệ" (nút icon trong cột "Thao tác") + hộp thoại chọn vị trí kệ mới
 * (PUT /api/book-copies/{id}/shelf-location; bỏ chọn = gỡ vị trí). `modal` phải được render ngoài bảng.
 */
export function useMoveShelfAction(
  copy: Pick<CopyView, "id" | "barcode" | "shelfLocationId" | "shelfLocationCode">,
): { action: RowAction; modal: ReactNode } {
  const form = useFormModal<Values>({
    title: `Đổi vị trí kệ «${copy.barcode}»`,
    successMessage: "Đã cập nhật vị trí kệ.",
    invalidate: ["/api/book-copies"],
    initialValues: { shelfLocationId: copy.shelfLocationId ?? undefined },
    request: (v) =>
      apiFetch(`/api/book-copies/${encodeURIComponent(copy.id)}/shelf-location`, {
        method: "PUT",
        json: { shelfLocationId: v.shelfLocationId ?? null },
      }),
  });
  const action: RowAction = {
    key: "move-shelf",
    label: `Đổi vị trí kệ của ${copy.barcode}`,
    icon: <MapPin size={16} />,
    onClick: () => form.openModal(),
  };
  const modal = (
    <FormModal<Values> {...form.modalProps}>
      <Form.Item name="shelfLocationId" label="Vị trí kệ" extra="Bỏ chọn để gỡ vị trí kệ của bản sao.">
        <OptionSelect
          path="/api/shelf-locations"
          placeholder="Chọn vị trí kệ"
          seed={copy.shelfLocationId ? [{ value: copy.shelfLocationId, label: copy.shelfLocationCode ?? copy.shelfLocationId }] : []}
        />
      </Form.Item>
    </FormModal>
  );
  return { action, modal };
}
