import { apiFetch, useApiMutation } from "@/api";
import { App, Button, ConfirmAction } from "@/ui";

/** Thu toàn bộ phạt chưa thanh toán của độc giả (BE thu một lần), xong thì tải lại danh sách phạt. */
export function CollectFinesButton({ readerId, total }: { readerId: string; total: string }) {
  const { message } = App.useApp();
  const collect = useApiMutation(
    () => apiFetch<{ collectedCount: number }>("/api/fines/payments", { method: "POST", json: { readerId } }),
    { invalidate: ["/api/fines"] },
  );
  return (
    <ConfirmAction
      title={`Thu ${total}?`}
      description="Đánh dấu mọi khoản phạt chưa thanh toán của độc giả này là đã thanh toán."
      okText="Thu phạt"
      onConfirm={async () => {
        const r = await collect.mutateAsync();
        message.success(`Đã thu ${r.collectedCount} khoản phạt.`);
      }}
    >
      <Button type="primary">Thu phạt</Button>
    </ConfirmAction>
  );
}
