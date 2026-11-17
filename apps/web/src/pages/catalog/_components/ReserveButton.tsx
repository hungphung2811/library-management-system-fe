import { Link } from "react-router";
import { apiFetch, toErrorInfo, useApiMutation } from "@/api";
import { App, Button, describeError } from "@/ui";

type Reservation = { id: string; queuePosition?: number };

/** Đặt trước đầu sách (POST /api/reservations). Chỉ hiện khi hết bản sẵn sàng và có quyền RESERVE. */
export function ReserveButton({ titleId }: { titleId: string }) {
  const { message } = App.useApp();
  const reserve = useApiMutation(
    () => apiFetch<Reservation>("/api/reservations", { method: "POST", json: { titleId } }),
    {
      invalidate: ["/api/reservations"],
      onSuccess: (r) =>
        message.success({
          content: (
            <span>
              Đã đặt trước{r?.queuePosition ? `. Bạn đứng thứ ${r.queuePosition} trong hàng đợi.` : "."}{" "}
              <Link to="/circulation/reservations">Xem đặt trước của tôi</Link>
            </span>
          ),
          duration: 6,
        }),
      onError: (e) => {
        const d = describeError(toErrorInfo(e));
        message.error(d.detail ? `${d.text} ${d.detail}` : d.text);
      },
    },
  );
  return (
    <Button loading={reserve.isPending} onClick={() => !reserve.isPending && reserve.mutate()}>
      Đặt trước
    </Button>
  );
}
