import { useState } from "react";
import { apiFetch, useApi, useApiMutation } from "@/api";
import { Alert, Form, FormModal, Select } from "@/ui";
import type { WorkPage, WorkSummary } from "../_lib/works";

type Values = { sourceWorkIds: string[] };

/**
 * Gộp các tác phẩm nguồn vào tác phẩm đích `target` (POST /api/works/{id}/merge, tối đa 20 nguồn).
 * Ấn bản của nguồn chuyển sang đích; tác phẩm nguồn không còn.
 */
export function WorkMergeModal({
  target,
  onClose,
  onMerged,
}: {
  target: Pick<WorkSummary, "id" | "title"> | null;
  onClose: () => void;
  onMerged?: () => void;
}) {
  const [kw, setKw] = useState("");
  const found = useApi<WorkPage>(target ? `/api/works?size=30${kw ? `&keyword=${encodeURIComponent(kw)}` : ""}` : null);
  const merge = useApiMutation(
    (v: Values) =>
      apiFetch(`/api/works/${encodeURIComponent(target!.id)}/merge`, { method: "POST", json: { sourceWorkIds: v.sourceWorkIds } }),
    { invalidate: ["/api/works", "/api/books"] },
  );
  const options = (found.data?.items ?? [])
    .filter((w) => w.id !== target?.id)
    .map((w) => ({ value: w.id, label: w.author ? `${w.title} — ${w.author}` : w.title }));
  return (
    <FormModal<Values>
      open={!!target}
      title={target ? `Gộp vào «${target.title}»` : "Gộp tác phẩm"}
      okText="Gộp"
      successMessage="Đã gộp tác phẩm."
      onCancel={onClose}
      initialValues={{ sourceWorkIds: [] }}
      onSubmit={async (v) => {
        await merge.mutateAsync(v);
        onMerged?.();
      }}
    >
      <Alert
        type="warning"
        showIcon
        className="mb-4"
        title="Các tác phẩm được chọn sẽ được gộp vào tác phẩm này: ấn bản của chúng chuyển sang đây và tác phẩm nguồn không còn. Không hoàn tác được."
      />
      <Form.Item
        name="sourceWorkIds"
        label="Tác phẩm cần gộp vào"
        extra="Chọn 1 đến 20 tác phẩm. Gõ để tìm theo tên."
        rules={[
          { required: true, type: "array", min: 1, message: "Chọn ít nhất một tác phẩm" },
          { type: "array", max: 20, message: "Tối đa 20 tác phẩm mỗi lần gộp" },
        ]}
      >
        <Select
          mode="multiple"
          placeholder="Chọn tác phẩm nguồn"
          options={options}
          loading={found.isFetching}
          showSearch={{ filterOption: false, onSearch: (q: string) => setKw(q.trim()) }}
          notFoundContent="Không tìm thấy tác phẩm"
        />
      </Form.Item>
    </FormModal>
  );
}
