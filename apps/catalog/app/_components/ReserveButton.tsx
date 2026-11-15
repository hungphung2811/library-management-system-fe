"use client";
import { useRef, useState } from "react";
import { bffFetch, toErrorInfo } from "@mfe/api/client";
import { App, Button, describeError } from "@mfe/ui";

type Reservation = { id: string; queuePosition?: number };

/** Đặt trước đầu sách (POST /api/reservations). Chỉ hiện khi hết bản sẵn sàng và có quyền RESERVE. */
export function ReserveButton({ titleId }: { titleId: string }) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  return (
    <Button
      loading={loading}
      onClick={async () => {
        if (busy.current) return;
        busy.current = true;
        setLoading(true);
        try {
          const r = await bffFetch<Reservation>("/api/reservations", { method: "POST", json: { titleId } });
          message.success({
            content: (
              <span>
                Đã đặt trước{r?.queuePosition ? `. Bạn đứng thứ ${r.queuePosition} trong hàng đợi.` : "."}{" "}
                <a href="/circulation/reservations">Xem đặt trước của tôi</a>
              </span>
            ),
            duration: 6,
          });
        } catch (e) {
          const d = describeError(toErrorInfo(e));
          message.error(d.detail ? `${d.text} ${d.detail}` : d.text);
        } finally {
          busy.current = false;
          setLoading(false);
        }
      }}
    >
      Đặt trước
    </Button>
  );
}
