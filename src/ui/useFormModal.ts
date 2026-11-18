import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { useApiMutation } from "@/api";
import type { FormModal } from "./FormModal";

type FormModalProps<V> = ComponentProps<typeof FormModal<V>>;

/** Cấu hình dùng chung của một hộp thoại form (nơi duy nhất khai báo: gọi API gì, tải lại gì, báo gì). */
export type FormModalConfig<V, R = unknown, T = never> = {
  /** Hàm thì nhận bản ghi đang sửa (undefined khi tạo mới): một cấu hình dùng cho cả tạo và sửa. */
  title: ReactNode | ((target: T | undefined) => ReactNode);
  okText?: string | ((target: T | undefined) => string);
  cancelText?: string;
  /** Thông báo khi thành công (FormModal hiện rồi đóng hộp thoại). */
  successMessage?: string;
  /**
   * Gửi dữ liệu (NÉM lỗi khi thất bại, FormModal tự hiện lỗi và giữ dữ liệu). `target` là bản ghi truyền vào `openModal(target)`
   * khi sửa (undefined khi tạo mới).
   */
  request: (values: V, target: T | undefined) => Promise<R>;
  /** Tiền tố đường dẫn của các truy vấn `useApi` cần tải lại sau khi thành công (xem useApiMutation). */
  invalidate?: string[];
  /** Giá trị ban đầu; hàm thì nhận bản ghi đang sửa. */
  initialValues?: Partial<V> | ((target: T | undefined) => Partial<V> | undefined);
  /** Chạy sau khi gửi thành công, trước khi đóng (ví dụ điều hướng sang bản ghi vừa tạo). */
  onSuccess?: (result: R, values: V, target: T | undefined) => void | Promise<void>;
  /** Biến đổi dữ liệu form trước khi gửi (trim, đổi kiểu...). */
  transform?: (values: V) => V;
  secondary?: FormModalProps<V>["secondary"];
};

/**
 * Gom phần lặp của mọi hộp thoại form: `useState(open)`, `useApiMutation` + invalidate, thông báo thành công, bản ghi đang sửa.
 *
 * ```tsx
 * const m = useFormModal<Values, Role>({
 *   title: "Thêm vai trò", okText: "Tạo", successMessage: "Đã tạo vai trò.",
 *   request: (v) => apiFetch("/api/roles", { method: "POST", json: v }),
 *   invalidate: ["/api/roles"],
 * });
 * <Button onClick={() => m.openModal()}>Thêm</Button>
 * <FormModal {...m.modalProps}>...các Form.Item...</FormModal>
 * ```
 * Sửa bản ghi: `m.openModal(row)` rồi lấy `row` ở `request`/`initialValues`/`onSuccess`. `m.target` là bản ghi đang mở.
 */
export function useFormModal<V = Record<string, unknown>, R = unknown, T = never>(config: FormModalConfig<V, R, T>) {
  const [state, setState] = useState<{ open: boolean; target: T | undefined }>({ open: false, target: undefined });
  const mutation = useApiMutation<R, { values: V; target: T | undefined }>(({ values, target }) => config.request(values, target), {
    invalidate: config.invalidate,
  });

  const openModal = useCallback((target?: T) => setState({ open: true, target }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const { target } = state;
  const initial = typeof config.initialValues === "function" ? config.initialValues(target) : config.initialValues;

  const modalProps: FormModalProps<V> = {
    open: state.open,
    title: typeof config.title === "function" ? config.title(target) : config.title,
    okText: typeof config.okText === "function" ? config.okText(target) : config.okText,
    cancelText: config.cancelText,
    initialValues: initial,
    secondary: config.secondary,
    onCancel: close,
    successMessage: config.successMessage,
    onSubmit: async (values) => {
      const v = config.transform ? config.transform(values) : values;
      const result = await mutation.mutateAsync({ values: v, target });
      await config.onSuccess?.(result, v, target);
    },
    children: null,
  };
  return { open: state.open, target, openModal, close, submitting: mutation.isPending, modalProps };
}
