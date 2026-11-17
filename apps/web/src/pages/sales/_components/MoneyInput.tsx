import { InputNumber } from "@/ui";

/** Ô nhập số tiền nguyên đồng (không phần lẻ), hiển thị phân cách hàng nghìn kiểu vi-VN. */
export function MoneyInput({
  value,
  onChange,
  id,
  min = 0,
  max,
  placeholder,
  disabled,
}: {
  value?: number | null;
  onChange?: (v: number | null) => void;
  id?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <InputNumber<number>
      id={id}
      className="w-full"
      min={min}
      max={max}
      precision={0}
      step={1000}
      placeholder={placeholder}
      disabled={disabled}
      suffix="₫"
      value={value ?? null}
      formatter={(v) => (v == null || String(v) === "" ? "" : new Intl.NumberFormat("vi-VN").format(Number(v)))}
      parser={(v) => Number((v ?? "").replace(/\D/g, ""))}
      onChange={(v) => onChange?.(v == null ? null : Math.round(v))}
    />
  );
}
