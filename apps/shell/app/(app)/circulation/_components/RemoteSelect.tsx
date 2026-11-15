"use client";
import { useEffect, useRef, useState } from "react";
import { Select } from "@mfe/ui";

export type Opt = { value: string; label: string };

/**
 * Select tìm kiếm phía server (debounce 300ms). `value`/`onChange` theo dạng {value, label} (labelInValue) để nhãn
 * của mục đã chọn không mất khi danh sách gợi ý đổi; dùng được trực tiếp trong Form.Item.
 */
export function RemoteSelect({
  fetcher,
  value,
  onChange,
  placeholder,
  autoFocus,
  disabled,
  id,
  notFoundText = "Không tìm thấy kết quả",
}: {
  fetcher: (q: string) => Promise<Opt[]>;
  value?: Opt;
  onChange?: (o: Opt | undefined) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  notFoundText?: string;
}) {
  const [options, setOptions] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async (q: string) => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const r = await fetcher(q);
      if (n === seq.current) setOptions(r);
    } catch {
      if (n === seq.current) setOptions([]);
    } finally {
      if (n === seq.current) {
        setLoading(false);
        setAsked(true);
      }
    }
  };

  return (
    <Select
      id={id}
      showSearch={{
        filterOption: false,
        onSearch: (q: string) => {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void run(q.trim()), 300);
        },
      }}
      labelInValue
      allowClear
      autoFocus={autoFocus}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      options={options}
      loading={loading}
      notFoundContent={loading ? "Đang tìm..." : asked ? notFoundText : "Gõ để tìm"}
      onFocus={() => {
        if (!asked && !loading) void run("");
      }}
      onChange={(v) => onChange?.(v ? { value: String(v.value), label: String(v.label) } : undefined)}
      className="w-full"
    />
  );
}
