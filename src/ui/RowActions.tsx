import type { ReactNode } from "react";
import { Button, Tooltip } from "./antd";
import { ConfirmAction } from "./ConfirmAction";
import type { DataColumn } from "./DataTable";
import { LinkButton } from "./LinkButton";

/** Một thao tác trên dòng của bảng, hiển thị bằng nút chỉ có icon (nhãn hiện ở tooltip và là tên truy cập). */
export type RowAction = {
  key: string;
  /** Nhãn tiếng Việt: là tooltip và `aria-label`. Giữ đúng chữ cũ của nút để test và trình đọc màn hình không đổi. */
  label: string;
  /** Icon từ "@/ui" (lucide), ví dụ `<Pencil size={16} />`. */
  icon: ReactNode;
  /** Có `to` thì render link route client (xem LinkButton); không thì dùng `onClick`. */
  to?: string;
  onClick?: () => void | Promise<void>;
  /** Có thì hỏi xác nhận (Popconfirm) trước khi chạy `onClick`. */
  confirm?: { title: ReactNode; description?: ReactNode; okText?: string; cancelText?: string };
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** true thì không hiển thị (ví dụ thiếu quyền, sai trạng thái). */
  hidden?: boolean;
  testId?: string;
};

/** Dãy nút icon cho cột "Thao tác". Không có thao tác nào hiển thị thì render "—". */
export function RowActions({ actions }: { actions: RowAction[] }) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {visible.map((a) => {
        const common = {
          type: "text" as const,
          size: "small" as const,
          icon: a.icon,
          danger: a.danger,
          disabled: a.disabled,
          loading: a.loading,
          "aria-label": a.label,
          "data-testid": a.testId,
        };
        const node = a.to ? (
          <LinkButton {...common} to={a.to} />
        ) : (
          <Button {...common} onClick={a.confirm ? undefined : () => void a.onClick?.()} />
        );
        const withConfirm =
          a.confirm && !a.to ? (
            <ConfirmAction
              title={a.confirm.title}
              description={a.confirm.description}
              okText={a.confirm.okText}
              cancelText={a.confirm.cancelText}
              danger={a.danger}
              onConfirm={() => a.onClick?.()}
            >
              {node}
            </ConfirmAction>
          ) : (
            node
          );
        return (
          <Tooltip key={a.key} title={a.label}>
            {withConfirm}
          </Tooltip>
        );
      })}
    </span>
  );
}

type Row = Parameters<NonNullable<DataColumn["render"]>>[1];

/**
 * Cột "Thao tác" chuẩn cho DataTable: `actions(row)` trả các thao tác của dòng đó (đặt `hidden` cho thao tác không áp dụng).
 * `count` là số nút tối đa để tính độ rộng (mặc định 3).
 */
export function actionsColumn(actions: (row: Row) => RowAction[], count = 3): DataColumn {
  return {
    key: "actions",
    title: "Thao tác",
    dataIndex: "id",
    align: "right",
    width: 16 + count * 32,
    render: (_, row) => <RowActions actions={actions(row)} />,
  };
}
