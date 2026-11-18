import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { DataTable, NoPermission, PageHeader, QueryBoundary, Eye, actionsColumn } from "@/ui";
import { BorrowingFilters, useBorrowingFilters } from "./_components/BorrowingFilters";
import { LookupForm } from "./_components/LookupForm";
import {
  displayStatus,
  overdueDays,
  shortId,
  type BorrowingFilter,
  type BorrowingPage,
  type BorrowingView,
  type UserBrief,
} from "./_lib/circulation";

const matchFilter = (b: BorrowingView, f: BorrowingFilter | "") =>
  f === "" || (f === "OVERDUE" ? overdueDays(b) > 0 : b.status === f);
/** Cắt trang phía client cho danh sách theo độc giả của khóa byReader (BE trả mảng không phân trang; page từ 1). */
const readerPage = (all: BorrowingView[], f: BorrowingFilter | "", page: number, size: number): BorrowingPage => {
  const m = all.filter((b) => matchFilter(b, f));
  return { items: m.slice((page - 1) * size, page * size), total: m.length, page: page - 1, size };
};

export default function BorrowingsPage() {
  const s = useSession();
  const canSearch = can(s, PERMISSIONS.BORROWING_SEARCH);
  const canByReader = can(s, PERMISSIONS.BORROWING_BY_READER);
  const { filters, status: filter, readerId, setStatus } = useBorrowingFilters(can(s, PERMISSIONS.USER_SEARCH));
  const { page, size } = filters;

  // Có khóa search: lọc cả trạng thái và độc giả ở server (size tối đa 100, trang từ 0). Chỉ có khóa byReader (không có
  // search) mà đã chọn độc giả: dùng GET /api/borrowings?readerId rồi lọc/cắt trang phía client.
  const viaReader = !canSearch && canByReader && readerId !== "";
  const q = new URLSearchParams({ page: String(page - 1), size: String(size) });
  if (filter === "ACTIVE" || filter === "RETURNED") q.set("status", filter);
  if (filter === "OVERDUE") q.set("overdue", "true");
  if (readerId) q.set("readerId", readerId);
  const list = useApi<BorrowingPage>(canSearch ? `/api/borrowings/search?${q}` : null);
  const byReader = useApi<BorrowingView[]>(viaReader ? `/api/borrowings?readerId=${encodeURIComponent(readerId)}` : null);
  // Tên độc giả chỉ hiện khi có quyền xem danh sách người dùng; không có/lỗi thì hiện mã rút gọn.
  const users = useApi<{ items: UserBrief[] }>(
    (canSearch || viaReader) && can(s, PERMISSIONS.USER_SEARCH) ? "/api/users?size=100" : null,
  );
  const names = new Map<string, string>();
  for (const u of users.data?.items ?? []) names.set(u.id, `${u.fullName} (${u.username})`);

  const header = <PageHeader title="Phiếu mượn" description="Danh sách phiếu mượn và tra phiếu theo mã phiếu." />;

  if (!canSearch && !viaReader) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-4">
          <LookupForm />
          {canByReader ? (
            <BorrowingFilters filters={filters} status={filter} setStatus={setStatus} />
          ) : (
            <NoPermission feature="Danh sách phiếu mượn" />
          )}
        </div>
      </>
    );
  }

  const empty = filters.hasFilter
    ? { title: "Không có phiếu mượn nào khớp bộ lọc.", action: { label: "Xóa bộ lọc", href: "/circulation/borrowings" } }
    : { title: "Chưa có phiếu mượn nào.", action: { label: "Lập phiếu mượn", href: "/circulation/borrow" } };

  const query = (viaReader ? byReader : list) as typeof list;
  const total = viaReader
    ? byReader.data && byReader.data.filter((b) => matchFilter(b, filter)).length
    : list.data?.total;

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        <BorrowingFilters filters={filters} status={filter} setStatus={setStatus} total={total} />
        <QueryBoundary query={query}>
          {(raw) => {
            const data: BorrowingPage = viaReader ? readerPage(raw as unknown as BorrowingView[], filter, page, size) : raw;
            const rows = (data.items ?? []).map((b) => {
              const returned = b.items.filter((i) => i.returnDate).length;
              return {
                id: b.id,
                code: shortId(b.id),
                reader: names.get(b.userId) ?? shortId(b.userId),
                borrowDate: b.borrowDate,
                dueDate: b.dueDate,
                books: returned > 0 ? `${b.items.length} cuốn (đã trả ${returned})` : `${b.items.length} cuốn`,
                renewCount: String(b.renewCount),
                shownStatus: displayStatus(b),
              };
            });
            return (
              <DataTable
                rowKey="id"
                rows={rows}
                empty={empty}
                mobileTitleKey="code"
                pagination={{ mode: "server", page, pageSize: size, total: data.total ?? 0 }}
                columns={[
                  { key: "code", title: "Mã phiếu", dataIndex: "code", kind: "link", href: "/circulation/borrowings/{id}" },
                  { key: "reader", title: "Độc giả", dataIndex: "reader" },
                  { key: "borrowDate", title: "Ngày mượn", dataIndex: "borrowDate", kind: "date" },
                  { key: "dueDate", title: "Hạn trả", dataIndex: "dueDate", kind: "date" },
                  { key: "books", title: "Số sách", dataIndex: "books" },
                  { key: "renewCount", title: "Gia hạn", dataIndex: "renewCount", align: "right" },
                  { key: "status", title: "Trạng thái", dataIndex: "shownStatus", kind: "status", statusDomain: "borrowing" },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/circulation/borrowings/${encodeURIComponent(String(row.id))}` }], 1),
]}
              />
            );
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
