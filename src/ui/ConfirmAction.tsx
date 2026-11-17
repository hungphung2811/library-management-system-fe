import { useRef, useState, type ReactNode } from "react";
import { toErrorInfo } from "@/api";
import { App, Popconfirm } from "./antd";
import { describeError } from "./error-messages";

/**
 * Xác nhận trước hành động hủy/thu hồi/khóa (bọc Popconfirm). Bấm OK thì hộp xác nhận đóng NGAY rồi `onConfirm` chạy nền
 * (bấm lặp lại trong lúc đang chạy bị bỏ qua); ném lỗi thì hiện message.error theo bảng lỗi.
 * Không dùng `loading` tự động của antd khi `onConfirm` trả Promise: nút OK đổi loading rồi hộp đóng, nếu mở lại đúng lúc đang
 * đóng thì biểu tượng loading cũ kẹt lại trong DOM (tên truy cập thành "loading Xóa") dù nút không còn loading.
 */
export function ConfirmAction({
  title,
  description,
  okText = "Đồng ý",
  cancelText = "Không",
  danger,
  onConfirm,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
}) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const running = useRef(false);
  return (
    <Popconfirm
      title={title}
      description={description}
      okText={okText}
      cancelText={cancelText}
      open={open}
      onOpenChange={setOpen}
      destroyOnHidden
      okButtonProps={{ danger }}
      onConfirm={() => {
        setOpen(false);
        if (running.current) return;
        running.current = true;
        void (async () => {
          try {
            await onConfirm();
          } catch (e) {
            message.error(describeError(toErrorInfo(e)).text);
          } finally {
            running.current = false;
          }
        })();
      }}
    >
      {children}
    </Popconfirm>
  );
}
