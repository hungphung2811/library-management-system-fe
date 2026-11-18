import { apiFetch } from "@/api";
import { Alert, Form, FormModal, Input, InputNumber, Radio, useFormModal } from "@/ui";
import { KIND_HINTS, KIND_LABELS, MAX_APPLICATIONS_NOTE, type ApplicationDetail, type ApplicationKind } from "../../_lib/applications";

type Values = { name: string; kind?: ApplicationKind; rateLimitPerMinute?: number | null };

/** Hộp thoại tạo Application (có chọn loại) hoặc sửa (tên, giới hạn tốc độ; loại không đổi được). */
export function useApplicationForm(opts: { onCreated?: (app: ApplicationDetail) => void }) {
  return useFormModal<Values, ApplicationDetail, { id: string; name: string; rateLimitPerMinute?: number | null } | undefined>({
    title: (t) => (t ? "Sửa ứng dụng" : "Tạo ứng dụng"),
    okText: (t) => (t ? "Lưu" : "Tạo"),
    successMessage: "Đã lưu ứng dụng.",
    invalidate: ["/api/applications"],
    initialValues: (t) => (t ? { name: t.name, rateLimitPerMinute: t.rateLimitPerMinute ?? null } : { name: "", kind: "INTEGRATION", rateLimitPerMinute: null }),
    request: (v, t) => {
      const rate = v.rateLimitPerMinute ?? undefined;
      if (t) {
        return apiFetch<ApplicationDetail>(`/api/applications/${encodeURIComponent(t.id)}`, {
          method: "PUT",
          json: { name: v.name.trim(), rateLimitPerMinute: rate },
        });
      }
      return apiFetch<ApplicationDetail>("/api/applications", {
        method: "POST",
        json: { name: v.name.trim(), kind: v.kind, rateLimitPerMinute: rate },
      });
    },
    onSuccess: (app, _v, t) => {
      if (!t) opts.onCreated?.(app);
    },
  });
}

export function ApplicationFormModal({ form, editing }: { form: ReturnType<typeof useApplicationForm>; editing: boolean }) {
  return (
    <FormModal<Values> {...form.modalProps}>
      <Form.Item name="name" label="Tên ứng dụng" rules={[{ required: true, whitespace: true, message: "Nhập tên ứng dụng" }, { max: 100, message: "Tối đa 100 ký tự" }]}>
        <Input autoComplete="off" maxLength={100} />
      </Form.Item>
      {!editing && (
        <Form.Item name="kind" label="Loại ứng dụng" rules={[{ required: true, message: "Chọn loại ứng dụng" }]} extra={<KindHint />}>
          <Radio.Group
            options={(Object.keys(KIND_LABELS) as ApplicationKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            optionType="button"
          />
        </Form.Item>
      )}
      <Form.Item
        name="rateLimitPerMinute"
        label="Giới hạn tốc độ (yêu cầu/phút)"
        extra="Để trống để dùng mặc định. Từ 1 đến 1.000.000."
        rules={[{ type: "number", min: 1, max: 1_000_000, message: "Nhập số từ 1 đến 1.000.000" }]}
      >
        <InputNumber className="w-full" min={1} max={1_000_000} precision={0} />
      </Form.Item>
      {!editing && <Alert type="info" showIcon title={MAX_APPLICATIONS_NOTE} />}
    </FormModal>
  );
}

function KindHint() {
  return (
    <Form.Item noStyle shouldUpdate={(a, b) => a.kind !== b.kind}>
      {({ getFieldValue }) => {
        const k = getFieldValue("kind") as ApplicationKind | undefined;
        return k ? <span>{KIND_HINTS[k]}</span> : null;
      }}
    </Form.Item>
  );
}
