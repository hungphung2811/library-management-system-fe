import { PERMISSIONS, apiFetch, can, useApi, useSession } from "@/api";
import { Form, FormModal, Input, InputNumber, Select, useFormModal } from "@/ui";
import { WORK_KIND_LABELS, workInitial, workPayload, type WorkDetail, type WorkFormValues, type WorkSummary, type WorkKind } from "../_lib/works";
import { OptionSelect } from "./ClassificationFields";

/**
 * Hộp thoại tạo/sửa tác phẩm (POST/PUT /api/works). Sửa thì nạp chi tiết (GET /api/works/{id}) để giữ nguyên tác giả chuẩn
 * (PUT thay toàn bộ). Lưu ý của BE: sửa thể loại, bộ sách, tác giả của tác phẩm đổi cho MỌI ấn bản.
 */
export function useWorkForm(onSaved?: (w: WorkDetail) => void) {
  const form = useFormModal<WorkFormValues, WorkDetail, WorkSummary | undefined>({
    title: (t) => (t ? `Sửa tác phẩm «${t.title}»` : "Thêm tác phẩm"),
    okText: (t) => (t ? "Lưu" : "Tạo"),
    successMessage: "Đã lưu tác phẩm.",
    invalidate: ["/api/works"],
    request: async (v, t) => {
      if (t) {
        const cur = await apiFetch<WorkDetail>(`/api/works/${encodeURIComponent(t.id)}`);
        return apiFetch<WorkDetail>(`/api/works/${encodeURIComponent(t.id)}`, {
          method: "PUT",
          json: workPayload(v, (cur.authors ?? []).map((a) => a.id)),
        });
      }
      return apiFetch<WorkDetail>("/api/works", { method: "POST", json: workPayload(v) });
    },
    onSuccess: (w) => onSaved?.(w),
  });
  return form;
}

export function WorkFormModal({ form }: { form: ReturnType<typeof useWorkForm> }) {
  const s = useSession();
  const target = form.target;
  const detail = useApi<WorkDetail>(form.open && target ? `/api/works/${encodeURIComponent(target.id)}` : null);
  const noCategory = !can(s, PERMISSIONS.CATEGORY_OPTIONS);
  const noSeries = !can(s, PERMISSIONS.SERIES_OPTIONS);
  return (
    <FormModal<WorkFormValues> {...form.modalProps} initialValues={workInitial(detail.data ?? target) as WorkFormValues} key={`${target?.id ?? "new"}:${detail.data ? "loaded" : "pending"}`}>
      <Form.Item name="title" label="Tên tác phẩm" rules={[{ required: true, whitespace: true, message: "Nhập tên tác phẩm" }, { max: 255, message: "Tối đa 255 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="originalTitle" label="Tên gốc" rules={[{ max: 255, message: "Tối đa 255 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="originalLanguage" label="Ngôn ngữ gốc" extra="Mã ngôn ngữ, ví dụ vi, en, fr." rules={[{ pattern: /^[a-zA-Z]{2,8}$/, message: "2 đến 8 chữ cái, ví dụ vi" }]}>
        <Input autoComplete="off" maxLength={8} />
      </Form.Item>
      <Form.Item name="author" label="Tác giả" extra="Để trống thì lấy theo tác giả chuẩn đã gán." rules={[{ max: 255, message: "Tối đa 255 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="kind" label="Loại" rules={[{ required: true }]}>
        <Select options={(Object.keys(WORK_KIND_LABELS) as WorkKind[]).map((k) => ({ value: k, label: WORK_KIND_LABELS[k] }))} />
      </Form.Item>
      <Form.Item name="categoryId" label="Thể loại" extra={noCategory ? "Bạn không có quyền xem danh sách thể loại để chọn." : undefined}>
        <OptionSelect path="/api/categories" placeholder="Chọn thể loại" disabled={noCategory} seed={detail.data?.categoryId ? [{ value: detail.data.categoryId, label: detail.data.categoryName ?? detail.data.categoryId }] : []} />
      </Form.Item>
      <Form.Item name="seriesId" label="Bộ sách" extra={noSeries ? "Bạn không có quyền xem danh sách bộ sách để chọn." : undefined}>
        <OptionSelect path="/api/series" placeholder="Chọn bộ sách" disabled={noSeries} seed={detail.data?.seriesId ? [{ value: detail.data.seriesId, label: detail.data.seriesName ?? detail.data.seriesId }] : []} />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(a, b) => a.seriesId !== b.seriesId}>
        {({ getFieldValue }) =>
          getFieldValue("seriesId") ? (
            <>
              <Form.Item name="seriesNumber" label="Số thứ tự trong bộ" rules={[{ type: "number", min: 1, message: "Từ 1 trở lên" }]}>
                <InputNumber className="w-full" min={1} precision={0} />
              </Form.Item>
              <Form.Item name="seriesLabel" label="Nhãn tập" extra="Ví dụ «Tập 3»." rules={[{ max: 50, message: "Tối đa 50 ký tự" }]}>
                <Input autoComplete="off" />
              </Form.Item>
            </>
          ) : null
        }
      </Form.Item>
      <Form.Item name="description" label="Mô tả" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
        <Input.TextArea rows={3} maxLength={500} />
      </Form.Item>
    </FormModal>
  );
}
