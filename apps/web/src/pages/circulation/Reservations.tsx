import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { NoPermission, PageHeader, PageSkeleton, QueryBoundary } from "@/ui";
import { ReservationsView, type ReservationRow } from "./_components/ReservationsView";
import { useTitleNames } from "./_lib/hooks";
import { shortId, type ReservationView } from "./_lib/circulation";

const ORDER: Record<string, number> = { READY: 0, WAITING: 1 };

export default function ReservationsPage() {
  const s = useSession();
  const header = <PageHeader title="Đặt trước" description="Hàng đợi và hạn nhận sách bạn đã đặt trước." />;
  const allowed = can(s, PERMISSIONS.RESERVATION_MINE);
  const canViewBook = can(s, PERMISSIONS.BOOK_VIEW);
  const q = useApi<ReservationView[]>(allowed ? "/api/reservations" : null);
  // ReservationView chỉ có titleId: lấy tên sách song song (cần quyền xem sách); lỗi thì hiện "Sách #xxxxxxxx".
  const names = useTitleNames(
    (q.data ?? []).map((r) => r.titleId),
    canViewBook,
  );

  if (!allowed) {
    return (
      <>
        {header}
        <NoPermission feature="Đặt trước" />
      </>
    );
  }

  const skeleton = (
    <>
      {header}
      <PageSkeleton />
    </>
  );

  return (
    <QueryBoundary query={q} skeleton={skeleton}>
      {(list) => {
        if (canViewBook && list.length > 0 && names.isPending) return skeleton;
        const rows: ReservationRow[] = list
          .map((r) => ({
            id: r.id,
            titleId: r.titleId,
            titleName: names.data?.[r.titleId] ?? `Sách #${shortId(r.titleId)}`,
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
          <ReservationsView
            header={header}
            rows={rows}
            canReserve={can(s, PERMISSIONS.RESERVE)}
            canCancel={can(s, PERMISSIONS.RESERVATION_CANCEL)}
            canExpire={can(s, PERMISSIONS.RESERVATION_EXPIRE)}
            canSearchBooks={can(s, PERMISSIONS.BOOK_SEARCH)}
          />
        );
      }}
    </QueryBoundary>
  );
}
