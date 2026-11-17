import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Input, SearchOutlined } from "./antd";

/**
 * Ô tìm kiếm đẩy giá trị lên query string (setSearchParams, replace), debounce 300ms, Enter gửi ngay.
 * Đổi `q` thì xóa `page` để không ở lại trang 5 của kết quả cũ. Phím "/" (ngoài ô nhập) chuyển focus vào ô.
 * Trang đọc giá trị bằng `useSearchParams()`. `extra` là chỗ đặt các bộ lọc khác bên cạnh.
 */
export function SearchBar({
  placeholder,
  defaultValue = "",
  paramName = "q",
  extra,
}: {
  placeholder: string;
  defaultValue?: string;
  paramName?: string;
  extra?: ReactNode;
}) {
  const [sp, setSp] = useSearchParams();
  const urlValue = sp.get(paramName) ?? "";
  const [value, setValue] = useState(defaultValue || urlValue);
  const lastPushed = useRef(urlValue);
  const input = useRef<React.ComponentRef<typeof Input>>(null);

  const push = (v: string) => {
    const t = v.trim();
    if (t === (sp.get(paramName) ?? "")) return;
    const q = new URLSearchParams(sp.toString());
    if (t) q.set(paramName, t);
    else q.delete(paramName);
    q.delete("page");
    lastPushed.current = t;
    setSp(q, { replace: true });
  };

  // URL đổi từ bên ngoài (ví dụ nút "Xóa bộ lọc") thì đồng bộ ô nhập; URL do chính ô này đẩy lên thì bỏ qua.
  useEffect(() => {
    if (urlValue !== lastPushed.current) {
      lastPushed.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  useEffect(() => {
    const id = setTimeout(() => push(value), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        ref={input}
        role="searchbox"
        aria-label={placeholder}
        className="min-w-0 flex-1 basis-64 sm:max-w-md"
        prefix={<SearchOutlined aria-hidden />}
        placeholder={placeholder}
        value={value}
        allowClear
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={() => push(value)}
      />
      {extra}
    </div>
  );
}
