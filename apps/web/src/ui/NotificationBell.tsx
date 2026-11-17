import { useState } from "react";
import { Link } from "react-router";
import { apiFetch, useApi, useApiMutation } from "@/api";
import { BellOutlined, Badge, Button, Popover, Tooltip } from "./antd";
import { formatDateTime, formatRelativeTime } from "./format";

type NotificationView = { id: string; type?: string; message: string; createdAt: string; readAt?: string | null };

const POLL_MS = 60_000;

/** Đánh dấu đã đọc một mục hoặc tất cả qua BE; tải lại mọi truy vấn `/api/notifications*` (chuông, trang, trang chủ). */
export function useNotificationActions() {
  const markRead = useApiMutation((id: string) => apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }), {
    invalidate: ["/api/notifications"],
  });
  const markAll = useApiMutation(() => apiFetch<{ updated: number }>("/api/notifications/read-all", { method: "POST" }), {
    invalidate: ["/api/notifications"],
  });
  return { markRead, markAll };
}

/**
 * Chuông thông báo trên thanh trên. Số chưa đọc lấy từ BE (`GET /api/notifications/me/unread-count`), tự làm mới mỗi
 * 60 giây và khi tab được focus lại. Danh sách chỉ tải khi mở popover. Bấm một mục hoặc "Đọc hết" thì gọi BE đánh dấu
 * đã đọc. Lỗi (ví dụ support-service tắt, 503): ẩn số, Tooltip "Không tải được thông báo".
 */
export function NotificationBell(_props: { userId: string }) {
  const [open, setOpen] = useState(false);
  const countQ = useApi<{ unread: number }>("/api/notifications/me/unread-count", { refetchInterval: POLL_MS, staleTime: 15_000 });
  const listQ = useApi<NotificationView[]>(open ? "/api/notifications/me" : null, { staleTime: 5_000 });
  const { markRead, markAll } = useNotificationActions();

  const failed = countQ.isError;
  const count = failed ? 0 : (countQ.data?.unread ?? 0);
  const sorted = [...(Array.isArray(listQ.data) ? listQ.data : [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const panel = (
    <div className="w-[320px] max-w-[calc(100vw-48px)]">
      {listQ.isError ? (
        <p className="m-0 py-3 text-body text-muted">Không tải được thông báo.</p>
      ) : listQ.isPending ? (
        <p className="m-0 py-3 text-body text-muted">Đang tải…</p>
      ) : sorted.length === 0 ? (
        <p className="m-0 py-3 text-body text-muted">Bạn chưa có thông báo nào.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {sorted.slice(0, 5).map((n) => {
            const unread = n.readAt == null;
            return (
              <li key={n.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  data-testid="bell-item"
                  aria-label={unread ? `${n.message} (chưa đọc, bấm để đánh dấu đã đọc)` : n.message}
                  onClick={() => unread && markRead.mutate(n.id)}
                  className="flex w-full cursor-pointer items-start gap-2 border-0 bg-transparent px-0 py-2 text-left"
                >
                  <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-primary" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-body ${unread ? "font-medium text-ink" : "text-ink"}`}>{n.message}</span>
                    <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} className="text-caption text-muted">
                      {formatRelativeTime(n.createdAt)}
                    </time>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-body">
        <Button size="small" type="link" className="px-0" disabled={count === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
          Đọc hết
        </Button>
        <Link to="/notifications" onClick={() => setOpen(false)} className="font-medium text-primary no-underline hover:underline">
          Xem tất cả
        </Link>
      </div>
    </div>
  );

  return (
    <Popover trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen} title="Thông báo" content={panel}>
      <Tooltip title={failed ? "Không tải được thông báo" : undefined}>
        <button
          type="button"
          aria-label={`Thông báo, ${count} chưa đọc`}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="grid size-8 cursor-pointer place-items-center rounded-control border border-line bg-surface text-muted hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <Badge count={count} size="small" overflowCount={99} offset={[2, -2]}>
            <BellOutlined className="text-base" aria-hidden />
          </Badge>
        </button>
      </Tooltip>
    </Popover>
  );
}
