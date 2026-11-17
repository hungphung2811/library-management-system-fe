import { useEffect, useRef, useState, type ReactNode } from "react";
import { toErrorInfo } from "@/api";
import { Alert, App, Form, Modal } from "./antd";
import { describeError, type DescribedError } from "./error-messages";

/**
 * Hộp thoại form. `onSubmit(values)` NÉM lỗi (ApiCallError từ bffFetch) khi thất bại: FormModal bắt lỗi, hiện Alert trên đầu form,
 * gắn `details` dạng "trường: lỗi" vào đúng ô và giữ dữ liệu đã nhập. Resolve thì FormModal gọi `onCancel()` để đóng
 * (cha sở hữu `open`) và hiện `successMessage` nếu có. Khi đang gửi: khóa nút, Esc và bấm ra ngoài; chặn gửi lặp bằng cờ.
 * Các `children` là `Form.Item`.
 */
export function FormModal<V = Record<string, unknown>>({
  open,
  title,
  okText = "Lưu",
  cancelText = "Hủy",
  onCancel,
  onSubmit,
  initialValues,
  successMessage,
  destroyOnHidden = true,
  children,
}: {
  open: boolean;
  title: ReactNode;
  okText?: string;
  cancelText?: string;
  onCancel: () => void;
  onSubmit: (values: V) => Promise<void>;
  initialValues?: Partial<V>;
  successMessage?: string;
  destroyOnHidden?: boolean;
  children: ReactNode;
}) {
  const [form] = Form.useForm<V>();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<DescribedError | null>(null);
  const busy = useRef(false);
  const body = useRef<HTMLDivElement>(null);

  // Vừa mở thì đặt lại form về initialValues hiện tại: không giữ bản nháp gõ dở và không hiện giá trị cũ của bản ghi.
  // Phải chạy NGAY lúc `open` đổi (không đợi afterOpenChange ~300ms), nếu không sẽ xóa chữ người dùng/máy quét mã vạch gõ trong lúc hộp thoại đang mở.
  // (Không dùng `clearOnDestroy`: dưới StrictMode ở dev nó xóa luôn initialValues của lần mở.)
  // Với `initialValues` phải gán lại đúng giá trị hiện tại: resetFields() chỉ về giá trị cũ của lần mount trước nên sẽ đè giá trị mới của bản ghi.
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (initialValues) form.setFieldsValue(initialValues as never);
    // Focus ô đầu NGAY khi ô xuất hiện (không đợi hoạt ảnh mở kết thúc): chữ gõ hoặc mã vạch quét ngay sau khi mở không bị rơi ra ngoài.
    let raf = 0;
    let tries = 0;
    const focusFirst = () => {
      const el = body.current?.querySelector<HTMLElement>("input:not([type=hidden]), textarea");
      if (el) el.focus({ preventScroll: true });
      else if (tries++ < 60) raf = requestAnimationFrame(focusFirst);
    };
    raf = requestAnimationFrame(focusFirst);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  const submit = async () => {
    if (busy.current) return;
    let values: V;
    try {
      values = await form.validateFields();
    } catch {
      return; // lỗi kiểm tra nằm ngay dưới từng ô
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
      if (successMessage) message.success(successMessage);
      onCancel();
    } catch (e) {
      const d = describeError(toErrorInfo(e));
      const unmatched: string[] = [];
      const fields = [];
      for (const line of d.details ?? []) {
        const m = /^([\w.[\]]+)\s*:\s*(.+)$/.exec(line);
        if (m && form.getFieldInstance?.(m[1]) !== undefined) fields.push({ name: m[1].split("."), errors: [m[2]] });
        else unmatched.push(line);
      }
      if (fields.length) form.setFields(fields as never);
      setError({ ...d, details: unmatched });
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText={cancelText}
      onOk={submit}
      onCancel={onCancel}
      confirmLoading={submitting}
      cancelButtonProps={{ disabled: submitting }}
      closable={!submitting}
      keyboard={!submitting}
      mask={{ closable: false }}
      destroyOnHidden={destroyOnHidden}
      styles={{ header: { marginBottom: 16 }, footer: { marginTop: 4 } }}
      afterOpenChange={(o) => {
        if (o) body.current?.querySelector<HTMLElement>("input:not([type=hidden]), textarea")?.focus();
        else setError(null);
      }}
    >
      <div ref={body}>
        {error && (
          <Alert
            type="error"
            showIcon
            className="mb-4"
            title={error.text}
            description={
              error.detail || error.details?.length ? (
                <div>
                  {error.detail && <div>{error.detail}</div>}
                  {error.details?.length ? (
                    <ul className="m-0 pl-5">
                      {error.details.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : undefined
            }
          />
        )}
        <Form
          form={form}
          layout="vertical"
          disabled={submitting}
          initialValues={initialValues as never}
          onFinish={submit}
          requiredMark
        >
          {children}
        </Form>
      </div>
    </Modal>
  );
}
