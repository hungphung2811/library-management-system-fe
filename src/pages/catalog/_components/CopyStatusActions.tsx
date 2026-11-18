import { apiFetch, useApiMutation } from "@/api";
import { App, Ban, Button, ConfirmAction, PackageCheck, Space, TriangleAlert, Unlock, type RowAction } from "@/ui";
import type { CopyStatus, CopyView } from "./types";

type Action = { to: CopyStatus; label: string; confirm: string; note?: string; danger?: boolean };

const NO_FINE = "Việc đổi trạng thái ở đây không tính tiền phạt.";

/**
 * Chuyển trạng thái thủ công hợp lệ theo vòng đời của catalog (BookCopy): LOANED -> DAMAGED/LOST,
 * DAMAGED/RESERVED -> AVAILABLE. AVAILABLE và LOST không có thao tác thủ công; LOANED/RESERVED do circulation đặt.
 */
export function actionsFor(status: string): Action[] {
  switch (status) {
    case "LOANED":
      return [
        { to: "DAMAGED", label: "Báo hư hỏng", confirm: "Báo bản sao này hư hỏng?", note: NO_FINE },
        { to: "LOST", label: "Báo mất", confirm: "Báo bản sao này đã mất?", note: NO_FINE, danger: true },
      ];
    case "DAMAGED":
      return [{ to: "AVAILABLE", label: "Đã sửa xong, cho mượn lại", confirm: "Đưa bản sao về trạng thái sẵn sàng?" }];
    case "RESERVED":
      return [{ to: "AVAILABLE", label: "Nhả giữ chỗ", confirm: "Nhả giữ chỗ của bản sao này?" }];
    default:
      return [];
  }
}

function useChangeStatus(
  copy: Pick<CopyView, "id" | "barcode" | "status">,
  onChanged?: (next: { id: string; status: string }) => void | Promise<void>,
) {
  const { message } = App.useApp();
  const change = useApiMutation(
    (to: CopyStatus) =>
      apiFetch<Partial<CopyView> | undefined>(`/api/book-copies/${encodeURIComponent(copy.id)}/status`, {
        method: "PUT",
        json: { status: to },
      }),
    // Làm mới danh sách bản sao và "số bản sẵn có" của đầu sách.
    { invalidate: ["/api/book-copies", "/api/books"] },
  );
  return async (a: Action) => {
    const res = await change.mutateAsync(a.to);
    message.success(`Đã cập nhật «${copy.barcode}».`);
    await onChanged?.({ id: copy.id, status: res?.status ?? a.to });
  };
}

function iconFor(a: Action) {
  if (a.to === "LOST") return <Ban size={16} />;
  if (a.to === "DAMAGED") return <TriangleAlert size={16} />;
  return a.label === "Nhả giữ chỗ" ? <Unlock size={16} /> : <PackageCheck size={16} />;
}

/** Thao tác đổi trạng thái của một bản sao dưới dạng nút icon cho cột "Thao tác" (mỗi thao tác có hộp xác nhận). */
export function useCopyStatusRowActions(copy: Pick<CopyView, "id" | "barcode" | "status">): RowAction[] {
  const apply = useChangeStatus(copy);
  return actionsFor(copy.status).map((a) => ({
    key: a.to,
    label: a.label,
    icon: iconFor(a),
    danger: a.danger,
    confirm: { title: a.confirm, description: a.note, okText: a.label },
    onClick: () => apply(a),
  }));
}

/** Nút đổi trạng thái của một bản sao (mỗi thao tác qua ConfirmAction). `onChanged` nhận trạng thái mới. */
export function CopyStatusActions({
  copy,
  onChanged,
}: {
  copy: Pick<CopyView, "id" | "barcode" | "status">;
  onChanged?: (next: { id: string; status: string }) => void | Promise<void>;
}) {
  const apply = useChangeStatus(copy, onChanged);
  const actions = actionsFor(copy.status);
  if (!actions.length) return <span className="text-muted">—</span>;
  return (
    <Space size="small" wrap>
      {actions.map((a) => (
        <ConfirmAction
          key={a.to}
          title={a.confirm}
          description={a.note}
          okText={a.label}
          danger={a.danger}
          onConfirm={() => apply(a)}
        >
          <Button size="small" danger={a.danger}>
            {a.label}
          </Button>
        </ConfirmAction>
      ))}
    </Space>
  );
}
