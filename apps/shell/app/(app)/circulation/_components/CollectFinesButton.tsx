"use client";
import { useRouter } from "next/navigation";
import { bffFetch } from "@mfe/api/client";
import { App, Button, ConfirmAction } from "@mfe/ui";

/** Thu toàn bộ phạt chưa thanh toán của độc giả (BE thu một lần), xong thì tải lại trang. */
export function CollectFinesButton({ readerId, total }: { readerId: string; total: string }) {
  const router = useRouter();
  const { message } = App.useApp();
  return (
    <ConfirmAction
      title={`Thu ${total}?`}
      description="Đánh dấu mọi khoản phạt chưa thanh toán của độc giả này là đã thanh toán."
      okText="Thu phạt"
      onConfirm={async () => {
        const r = await bffFetch<{ collectedCount: number }>("/api/fines/payments", { method: "POST", json: { readerId } });
        message.success(`Đã thu ${r.collectedCount} khoản phạt.`);
        router.refresh();
      }}
    >
      <Button type="primary">Thu phạt</Button>
    </ConfirmAction>
  );
}
