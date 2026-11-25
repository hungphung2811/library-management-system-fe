import type { ReactNode } from "react";
import { apiFetch } from "@/api";
import { Form, FormModal, Input, useFormModal } from "@/ui";

export type DecisionTarget = { url: `/api/${string}`; action: "approve" | "reject"; summary: ReactNode };

/** Hộp thoại duyệt/từ chối một yêu cầu (miễn/giảm hoặc hoàn khoản) kèm ghi chú tùy chọn. `m.openModal({url, action, summary})`. */
export function useDecisionModal() {
  const m = useFormModal<{ note?: string }, unknown, DecisionTarget>({
    title: (t) => (t?.action === "reject" ? "Từ chối yêu cầu" : "Duyệt yêu cầu"),
    okText: (t) => (t?.action === "reject" ? "Từ chối" : "Duyệt"),
    successMessage: undefined,
    invalidate: ["/api/fines/"],
    request: async (v, t) => {
      if (!t) return;
      const note = v.note?.trim();
      await apiFetch(`${t.url}/${t.action}`, { method: "POST", json: note ? { note } : {} });
    },
  });
  const modal = (
    <FormModal<{ note?: string }> {...m.modalProps} successMessage={m.target?.action === "reject" ? "Đã từ chối yêu cầu." : "Đã duyệt yêu cầu."}>
      {m.target?.summary}
      <Form.Item name="note" label="Ghi chú (tùy chọn)">
        <Input.TextArea rows={3} maxLength={500} showCount />
      </Form.Item>
    </FormModal>
  );
  return { openModal: m.openModal, modal };
}
