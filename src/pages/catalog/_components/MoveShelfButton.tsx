import { useState } from "react";
import { apiFetch, useApiMutation } from "@/api";
import { Button, Form, FormModal } from "@/ui";
import { OptionSelect } from "./ClassificationFields";
import type { CopyView } from "./types";

type Values = { shelfLocationId?: string };

/** Nút "Đổi kệ" + hộp thoại chọn vị trí kệ mới (PUT /api/book-copies/{id}/shelf-location; bỏ chọn = gỡ vị trí). */
export function MoveShelfButton({ copy }: { copy: Pick<CopyView, "id" | "barcode" | "shelfLocationId" | "shelfLocationCode"> }) {
  const [open, setOpen] = useState(false);
  const move = useApiMutation(
    (v: Values) =>
      apiFetch(`/api/book-copies/${encodeURIComponent(copy.id)}/shelf-location`, {
        method: "PUT",
        json: { shelfLocationId: v.shelfLocationId ?? null },
      }),
    { invalidate: ["/api/book-copies"] },
  );
  return (
    <>
      <Button size="small" onClick={() => setOpen(true)} aria-label={`Đổi vị trí kệ của ${copy.barcode}`}>
        Đổi kệ
      </Button>
      <FormModal<Values>
        open={open}
        title={`Đổi vị trí kệ «${copy.barcode}»`}
        successMessage="Đã cập nhật vị trí kệ."
        onCancel={() => setOpen(false)}
        initialValues={{ shelfLocationId: copy.shelfLocationId ?? undefined }}
        onSubmit={async (v) => {
          await move.mutateAsync(v);
        }}
      >
        <Form.Item name="shelfLocationId" label="Vị trí kệ" extra="Bỏ chọn để gỡ vị trí kệ của bản sao.">
          <OptionSelect
            path="/api/shelf-locations"
            placeholder="Chọn vị trí kệ"
            seed={copy.shelfLocationId ? [{ value: copy.shelfLocationId, label: copy.shelfLocationCode ?? copy.shelfLocationId }] : []}
          />
        </Form.Item>
      </FormModal>
    </>
  );
}
