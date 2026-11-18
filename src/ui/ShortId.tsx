import { useState } from "react";
import { App, Tooltip } from "./antd";
import { Check, Copy } from "./icons";

/**
 * Id dạng rút gọn "…xxxxx" (5 ký tự cuối); rê chuột vào hiện đầy đủ id. Icon sao chép chỉ hiện khi rê chuột vào id hoặc khi nút
 * được focus bằng bàn phím (vẫn chiếm chỗ để bảng không nhảy); thiết bị cảm ứng không có hover nên luôn hiện; vừa sao chép xong thì hiện dấu ✓.
 */
export function ShortId({ value, tail = 5 }: { value: string | null | undefined; tail?: number }) {
  const { message } = App.useApp();
  const [done, setDone] = useState(false);
  if (!value) return <span className="text-muted">—</span>;
  const id = String(value);
  const short = id.length > tail ? `…${id.slice(-tail)}` : id;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setDone(true);
      message.success("Đã sao chép id");
      setTimeout(() => setDone(false), 1500);
    } catch {
      message.error("Không sao chép được id");
    }
  };
  return (
    <Tooltip title={<span className="font-mono text-xs">{id}</span>}>
      <span className="group inline-flex items-center gap-1 whitespace-nowrap font-mono text-sm text-muted" data-testid="short-id">
        {short}
        <button
          type="button"
          aria-label={`Sao chép id ${id}`}
          onClick={() => void copy()}
          className={`inline-flex size-5 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-muted transition-opacity hover:bg-subtle hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${done ? "opacity-100" : "opacity-0"}`}
        >
          {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
      </span>
    </Tooltip>
  );
}
