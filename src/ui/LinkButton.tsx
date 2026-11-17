import type { ComponentProps, MouseEvent } from "react";
import { useNavigate } from "react-router";
import { Button } from "./antd";

/**
 * Nút antd trỏ tới một route trong app: render <a href> (mở tab mới, sao chép link được) nhưng bấm thường thì
 * điều hướng phía client bằng react-router, không tải lại trang. Dùng thay cho `<Button href="...">` của antd.
 */
export function LinkButton({ to, onClick, ...rest }: Omit<ComponentProps<typeof Button>, "href"> & { to: string }) {
  const navigate = useNavigate();
  return (
    <Button
      {...rest}
      href={to}
      onClick={(e: MouseEvent<HTMLElement>) => {
        onClick?.(e as never);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        void navigate(to);
      }}
    />
  );
}
