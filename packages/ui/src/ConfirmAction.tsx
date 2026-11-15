"use client";
import type { ReactNode } from "react";
import { toErrorInfo } from "@mfe/api/client";
import { App, Popconfirm } from "./antd";
import { describeError } from "./error-messages";

/**
 * Xác nhận trước hành động hủy/thu hồi/khóa (bọc Popconfirm). `onConfirm` trả Promise thì nút OK tự `loading`;
 * ném lỗi thì hiện message.error theo bảng lỗi (hộp xác nhận vẫn đóng).
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
  return (
    <Popconfirm
      title={title}
      description={description}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{ danger }}
      onConfirm={async () => {
        try {
          await onConfirm();
        } catch (e) {
          message.error(describeError(toErrorInfo(e)).text);
        }
      }}
    >
      {children}
    </Popconfirm>
  );
}
