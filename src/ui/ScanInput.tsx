import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { toErrorInfo } from "@/api";
import { Input, ScanOutlined, Spin, Text } from "./antd";
import { describeError } from "./error-messages";

/**
 * Ô nhập cho máy quét mã vạch: máy quét gõ chuỗi rồi Enter. Sau mỗi lần xử lý (thành công hay lỗi) xóa ô
 * và trả focus về ô để quét tiếp. `status` là vùng kết quả (aria-live="polite") do zone điền, ví dụ "Đã thêm …".
 * `onScan` ném lỗi thì ScanInput hiện câu lỗi (theo bảng lỗi chung) ở vùng đó; zone muốn thông báo riêng thì tự bắt lỗi.
 */
export function ScanInput({
  label,
  onScan,
  busy,
  disabled,
  hint,
  status,
  autoFocus,
  placeholder,
  maxLength,
}: {
  label: string;
  onScan: (code: string) => Promise<void>;
  /** Đang xử lý ở phía cha (hiện vòng xoay, khóa ô). */
  busy?: boolean;
  /** Chưa dùng được (vd chưa chọn độc giả): khóa ô nhưng KHÔNG hiện vòng xoay để khỏi giống đang tải. */
  disabled?: boolean;
  hint?: string;
  status?: ReactNode;
  autoFocus?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  const input = useRef<React.ComponentRef<typeof Input>>(null);
  const running = useRef(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = pending || !!busy;
  const locked = working || !!disabled;

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const submit = async () => {
    const code = value.trim();
    if (!code || running.current || busy || disabled) return;
    running.current = true;
    setPending(true);
    setError(null);
    try {
      await onScan(code);
    } catch (e) {
      setError(describeError(toErrorInfo(e)).text);
    } finally {
      running.current = false;
      setPending(false);
      setValue("");
      // đợi input hết trạng thái readOnly rồi mới focus để quét tiếp
      setTimeout(() => input.current?.focus(), 0);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <Input
        id={id}
        ref={input}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={maxLength}
        placeholder={placeholder}
        prefix={<ScanOutlined aria-hidden />}
        suffix={working ? <Spin size="small" /> : undefined}
        value={value}
        readOnly={locked}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={submit}
      />
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
      <div role="status" aria-live="polite" className="mt-2 min-h-5 text-sm">
        {error ? <Text type="danger">{error}</Text> : status}
      </div>
    </div>
  );
}
