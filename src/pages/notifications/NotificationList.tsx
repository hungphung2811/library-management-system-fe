import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { ApiCallError } from "@/api";
import { App, Button, DEFAULT_PAGE_SIZES, DatePicker, Empty, Pagination, Segmented, Select, Tag, dayjs, formatDateTime, formatRelativeTime, usePageSize } from "@/ui";
import { useNotificationActions } from "@/ui/NotificationBell";

export type NotificationItem = { id: string; type?: string | null; message: string; createdAt: string; readAt?: string | null };

const DATE_FORMAT = "DD/MM/YYYY";

/**
 * Danh sách đầy đủ. "Chưa đọc" = `readAt == null` (theo BE). Bộ lọc nằm trên URL: `filter=unread`, `type`, `from`, `to`
 * (yyyy-MM-dd, lọc phía client trên toàn bộ danh sách vì BE không phân trang) và `page`. Mỗi mục có "Đánh dấu đã đọc",
 * ngoài ra có "Đọc hết".
 */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const { message } = App.useApp();
  const [sp, setSp] = useSearchParams();
  const { markRead, markAll } = useNotificationActions();

  const filter = sp.get("filter") === "unread" ? "unread" : "all";
  const type = sp.get("type") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const PAGE_SIZE = usePageSize();

  const set = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    if (!("page" in patch)) q.delete("page");
    setSp(q, { replace: true });
  };

  const sorted = useMemo(() => [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [items]);
  const types = useMemo(() => [...new Set(sorted.map((n) => n.type).filter((t): t is string => !!t))].sort(), [sorted]);
  const isUnread = (n: NotificationItem) => n.readAt == null;
  const unreadCount = sorted.filter(isUnread).length;

  const shown = sorted.filter((n) => {
    if (filter === "unread" && !isUnread(n)) return false;
    if (type && n.type !== type) return false;
    const day = dayjs(n.createdAt);
    if (from && day.isBefore(dayjs(from).startOf("day"))) return false;
    if (to && day.isAfter(dayjs(to).endOf("day"))) return false;
    return true;
  });
  const lastPage = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, lastPage);
  const pageItems = shown.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const hasFilter = !!(type || from || to);

  const read = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch (e) {
      message.error(e instanceof ApiCallError ? e.message : "Không đánh dấu được đã đọc.");
    }
  };
  const readAll = async () => {
    try {
      const r = await markAll.mutateAsync();
      message.success(`Đã đánh dấu ${r?.updated ?? unreadCount} thông báo là đã đọc.`);
    } catch (e) {
      message.error(e instanceof ApiCallError ? e.message : "Không đánh dấu được đã đọc.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={(v) => set({ filter: v === "unread" ? "unread" : undefined })}
          options={[
            { label: `Tất cả (${sorted.length})`, value: "all" },
            { label: `Chưa đọc (${unreadCount})`, value: "unread" },
          ]}
          aria-label="Lọc thông báo"
        />
        <Select
          aria-label="Lọc theo loại"
          className="min-w-40"
          placeholder="Loại thông báo"
          allowClear
          value={type || undefined}
          options={types.map((t) => ({ value: t, label: t }))}
          onChange={(v) => set({ type: v })}
        />
        <DatePicker.RangePicker
          aria-label="Lọc theo khoảng ngày"
          format={DATE_FORMAT}
          value={from && to ? [dayjs(from), dayjs(to)] : from ? [dayjs(from), null] : to ? [null, dayjs(to)] : null}
          onChange={(v) => set({ from: v?.[0]?.format("YYYY-MM-DD"), to: v?.[1]?.format("YYYY-MM-DD") })}
          allowEmpty={[true, true]}
        />
        {hasFilter && (
          <Button onClick={() => set({ type: undefined, from: undefined, to: undefined })}>Xóa bộ lọc</Button>
        )}
        <Button className="ml-auto" disabled={unreadCount === 0} loading={markAll.isPending} onClick={() => void readAll()}>
          Đọc hết
        </Button>
      </div>
      <div className="text-sm text-muted" role="status" data-testid="notification-count">
        {shown.length} thông báo
      </div>

      {shown.length === 0 ? (
        <Empty
          description={
            sorted.length === 0
              ? "Bạn chưa có thông báo nào."
              : filter === "unread" && !hasFilter
                ? "Không có thông báo chưa đọc."
                : "Không có thông báo khớp bộ lọc."
          }
        />
      ) : (
        <ul className="m-0 list-none divide-y divide-line rounded-card border border-line bg-surface p-0">
          {pageItems.map((n) => {
            const unread = isUnread(n);
            return (
              <li key={n.id} data-testid="notification-item" className="flex items-start gap-3 px-4 py-3">
                <span aria-hidden className={`mt-2 size-2 shrink-0 rounded-full ${unread ? "bg-primary" : "bg-transparent"}`} />
                <div className="min-w-0 flex-1">
                  {unread && <span className="sr-only">Chưa đọc. </span>}
                  <div className={`text-sm ${unread ? "font-medium text-ink" : "text-ink"}`}>{n.message}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {n.type ? <Tag className="me-0">{n.type}</Tag> : null}
                    <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                      {formatRelativeTime(n.createdAt)}
                    </time>
                  </div>
                </div>
                {unread && (
                  <Button size="small" aria-label={`Đánh dấu đã đọc: ${n.message}`} onClick={() => void read(n.id)}>
                    Đánh dấu đã đọc
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {shown.length > Math.min(PAGE_SIZE, ...DEFAULT_PAGE_SIZES) && (
        <Pagination
          current={cur}
          pageSize={PAGE_SIZE}
          total={shown.length}
          onChange={(p, s) => (s !== PAGE_SIZE ? set({ size: s === 20 ? undefined : String(s), page: undefined }) : set({ page: p > 1 ? String(p) : undefined }))}
          showSizeChanger
          pageSizeOptions={Array.from(new Set([...DEFAULT_PAGE_SIZES, PAGE_SIZE])).sort((a, b) => a - b)}
          locale={{ items_per_page: "/ trang", page_size: "Số dòng mỗi trang" }}
          align="end"
        />
      )}
    </div>
  );
}
