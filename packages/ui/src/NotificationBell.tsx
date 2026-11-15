"use client";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@mfe/api/client";
import { BellOutlined, Badge, Popover, Tooltip } from "./antd";
import { formatDateTime, formatRelativeTime } from "./format";

type NotificationView = { id: string; type?: string; message: string; createdAt: string; readAt?: string | null };

const POLL_MS = 60_000;
const seenKey = (userId: string) => `lms.notifications.seen.${userId}`;

function readSeen(userId: string): number {
  try {
    return Number(localStorage.getItem(seenKey(userId))) || 0;
  } catch {
    return 0;
  }
}
function writeSeen(userId: string, t: number) {
  try {
    localStorage.setItem(seenKey(userId), String(t));
  } catch {
    /* localStorage bị chặn: bỏ qua, số chưa đọc sẽ không giảm */
  }
}

/**
 * Chuông thông báo trên thanh trên. Tải phía client (không chặn render trang): khi mount, khi tab hiện lại và mỗi 60 giây
 * khi tab đang hiển thị. BE chưa có API đánh dấu đã đọc nên "chưa đọc" = `readAt == null` VÀ `createdAt` sau mốc
 * "đã xem lần cuối" (localStorage theo userId); mở popover thì cập nhật mốc. Lỗi: ẩn số, Tooltip "Không tải được thông báo".
 */
export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await bffFetch<NotificationView[]>("/api/notifications/me");
      setItems(Array.isArray(list) ? list : []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    setSeen(readSeen(userId));
    void load();
    const tick = () => document.visibilityState === "visible" && void load();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId, load]);

  const sorted = [...(items ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const unread = sorted.filter((n) => n.readAt == null && Date.parse(n.createdAt) > seen).length;
  const count = failed ? 0 : unread;

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      const now = Date.now();
      setSeen(now);
      writeSeen(userId, now);
      void load();
    }
  };

  const panel = (
    <div className="w-[320px] max-w-[calc(100vw-48px)]">
      {failed ? (
        <p className="m-0 py-3 text-sm text-muted">Không tải được thông báo.</p>
      ) : sorted.length === 0 ? (
        <p className="m-0 py-3 text-sm text-muted">Bạn chưa có thông báo nào.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {sorted.slice(0, 5).map((n) => (
            <li key={n.id} className="border-b border-line py-2 last:border-b-0">
              <div className="text-sm text-ink">{n.message}</div>
              <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} className="text-xs text-muted">
                {formatRelativeTime(n.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 border-t border-line pt-2 text-right text-sm">
        <a href="/notifications" className="font-medium text-brand-600 no-underline hover:underline">
          Xem tất cả
        </a>
      </div>
    </div>
  );

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={onOpenChange}
      title="Thông báo"
      content={panel}
    >
      <Tooltip title={failed ? "Không tải được thông báo" : undefined}>
        <button
          type="button"
          aria-label={`Thông báo, ${count} chưa đọc`}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="grid size-10 cursor-pointer place-items-center rounded-lg border border-line bg-white text-lg text-muted hover:bg-subtle hover:text-ink"
        >
          <Badge count={count} size="small" overflowCount={99} offset={[2, -2]}>
            <BellOutlined className="text-lg" aria-hidden />
          </Badge>
        </button>
      </Tooltip>
    </Popover>
  );
}
