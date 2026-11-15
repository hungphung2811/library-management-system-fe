import { ErrorPanel, NoPermission, PageHeader } from "@mfe/ui";
import { PERMISSIONS, can, gatewayFetch, requireSession } from "@mfe/api";
import { toErrorInfo } from "@mfe/api/client";
import { ReservationsView, type ReservationRow } from "../../components/ReservationsView";
import { shortId, type ReservationView } from "../../lib/circulation";

const ORDER: Record<string, number> = { READY: 0, WAITING: 1 };

export default async function ReservationsPage() {
  const s = await requireSession("/circulation/reservations"); // ngoài try: redirect() ném lỗi
  const header = <PageHeader title="Đặt trước" description="Hàng đợi và hạn nhận sách bạn đã đặt trước." />;

  if (!can(s, PERMISSIONS.RESERVATION_MINE)) {
    return (
      <>
        {header}
        <NoPermission feature="Đặt trước" />
      </>
    );
  }

  let list: ReservationView[];
  try {
    list = await gatewayFetch<ReservationView[]>("/api/reservations");
  } catch (e) {
    return (
      <>
        {header}
        <ErrorPanel error={toErrorInfo(e)} retryHref="/circulation/reservations" />
      </>
    );
  }

  // ReservationView chỉ có titleId: lấy tên sách song song (cần quyền xem sách); lỗi thì hiện "Sách #xxxxxxxx".
  const names = new Map<string, string>();
  if (can(s, PERMISSIONS.BOOK_VIEW)) {
    const ids = [...new Set(list.map((r) => r.titleId))];
    const r = await Promise.allSettled(
      ids.map((id) => gatewayFetch<{ name: string }>(`/api/books/${encodeURIComponent(id)}`)),
    );
    r.forEach((x, i) => {
      if (x.status === "fulfilled" && x.value.name) names.set(ids[i], x.value.name);
    });
  }

  const rows: ReservationRow[] = list
    .map((r) => ({
      id: r.id,
      titleId: r.titleId,
      titleName: names.get(r.titleId) ?? `Sách #${shortId(r.titleId)}`,
      status: r.status,
      queuePosition: r.queuePosition ?? null,
      reservedAt: r.reservedAt ?? null,
      copyId: r.copyId ?? null,
      holdUntil: r.holdUntil ?? null,
    }))
    .sort(
      (a, b) =>
        (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || String(b.reservedAt).localeCompare(String(a.reservedAt)),
    );

  return (
    <>
      <ReservationsView
        header={header}
        rows={rows}
        canReserve={can(s, PERMISSIONS.RESERVE)}
        canCancel={can(s, PERMISSIONS.RESERVATION_CANCEL)}
        canExpire={can(s, PERMISSIONS.RESERVATION_EXPIRE)}
        canSearchBooks={can(s, PERMISSIONS.BOOK_SEARCH)}
      />
    </>
  );
}
