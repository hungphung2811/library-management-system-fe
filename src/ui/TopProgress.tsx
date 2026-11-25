import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

/**
 * Thanh tiến trình mỏng trên cùng (kiểu nprogress): chạy khi còn lời gọi API (query đang tải hoặc mutation đang chạy),
 * chỉ hiện nếu việc kéo dài quá 120ms để tránh nhấp nháy, khi xong thì chạy tới 100% rồi tắt.
 * Đặt trong QueryClientProvider. `role="progressbar"` chỉ có khi đang hiện.
 */
export function TopProgress() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    clear();
    if (busy) {
      timers.current.push(
        window.setTimeout(() => {
          setVisible(true);
          setWidth(15);
        }, 120),
      );
      // Tiến chậm dần tới tối đa 90% trong lúc chờ.
      const tick = (w: number) => {
        const next = w + (90 - w) * 0.15;
        timers.current.push(
          window.setTimeout(() => {
            setWidth((cur) => (cur === 0 ? cur : next));
            tick(next);
          }, 300),
        );
      };
      tick(15);
    } else {
      setWidth((cur) => (cur > 0 ? 100 : 0));
      timers.current.push(
        window.setTimeout(() => {
          setVisible(false);
          setWidth(0);
        }, 250),
      );
    }
    return clear;
  }, [busy]);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label="Đang tải dữ liệu"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[2000] h-[3px] print:hidden"
    >
      <div
        className="h-full bg-[var(--ant-color-primary,#1677ff)] shadow-[0_0_8px_var(--ant-color-primary,#1677ff)]"
        style={{ width: `${width}%`, transition: "width 300ms ease-out" }}
      />
    </div>
  );
}
