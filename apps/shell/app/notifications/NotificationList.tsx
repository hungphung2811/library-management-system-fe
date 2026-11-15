"use client";
import { useEffect, useState } from "react";
import { Empty, Pagination, Segmented, Tag, formatDateTime, formatRelativeTime } from "@mfe/ui";

export type NotificationItem = { id: string; type?: string | null; message: string; createdAt: string; readAt?: string | null };

const PAGE_SIZE = 20;
// Cùng khóa với NotificationBell để hai nơi dùng chung mốc "đã xem lần cuối".
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
    /* localStorage bị chặn: bỏ qua */
  }
}

/**
 * Danh sách đầy đủ, chỉ đọc. "Chưa đọc" dùng đúng định nghĩa của chuông: `readAt == null` VÀ `createdAt` sau mốc
 * "đã xem lần cuối". Mốc cũ được giữ lại trong phiên xem này (để còn thấy mục nào mới) rồi mới ghi mốc mới.
 */
export function NotificationList({ userId, items }: { userId: string; items: NotificationItem[] }) {
  // null = chưa mount: dùng riêng `readAt` để SSR và lần render đầu của client giống nhau (tránh lệch hydrate).
  const [seen, setSeen] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSeen(readSeen(userId));
    setNow(Date.now());
    writeSeen(userId, Date.now());
  }, [userId]);

  const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const isUnread = (n: NotificationItem) => n.readAt == null && (seen === null || Date.parse(n.createdAt) > seen);
  const unreadCount = sorted.filter(isUnread).length;
  const shown = filter === "unread" ? sorted.filter(isUnread) : sorted;
  const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={filter}
        onChange={(v) => {
          setFilter(v as "all" | "unread");
          setPage(1);
        }}
        options={[
          { label: `Tất cả (${sorted.length})`, value: "all" },
          { label: `Chưa đọc (${unreadCount})`, value: "unread" },
        ]}
        aria-label="Lọc thông báo"
      />

      {shown.length === 0 ? (
        <Empty
          description={
            sorted.length === 0 ? "Bạn chưa có thông báo nào." : "Không có thông báo chưa đọc."
          }
        />
      ) : (
        <ul className="m-0 list-none divide-y divide-line rounded-xl border border-line bg-white p-0">
          {pageItems.map((n) => {
            const unread = isUnread(n);
            return (
              <li key={n.id} data-testid="notification-item" className="flex items-start gap-3 px-4 py-3">
                <span aria-hidden className={`mt-2 size-2 shrink-0 rounded-full ${unread ? "bg-brand-500" : "bg-transparent"}`} />
                <div className="min-w-0 flex-1">
                  {unread && <span className="sr-only">Chưa đọc. </span>}
                  <div className={`text-sm ${unread ? "font-medium text-ink" : "text-ink"}`}>{n.message}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {n.type ? <Tag className="me-0">{n.type}</Tag> : null}
                    <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                      {now === null ? formatDateTime(n.createdAt) : formatRelativeTime(n.createdAt, now)}
                    </time>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {shown.length > PAGE_SIZE && (
        <Pagination current={page} pageSize={PAGE_SIZE} total={shown.length} onChange={setPage} showSizeChanger={false} align="end" />
      )}
    </div>
  );
}
