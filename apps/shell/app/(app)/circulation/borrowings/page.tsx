import { PERMISSIONS, can, gatewayFetch, requireSession, toErrorInfo } from "@mfe/api";
import { DataTable, ErrorPanel, NoPermission, PageHeader } from "@mfe/ui";
import { BorrowingStatusFilter } from "../_components/BorrowingStatusFilter";
import { LookupForm } from "../_components/LookupForm";
import {
  BORROWING_FILTERS,
  displayStatus,
  shortId,
  type BorrowingFilter,
  type BorrowingPage,
} from "../_lib/circulation";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const PAGE_SIZE = 20;

/** Tên độc giả chỉ hiện khi người dùng có quyền xem danh sách người dùng; không có thì hiện mã rút gọn. */
type UserBrief = { id: string; username: string; fullName: string };

export default async function BorrowingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const raw = one(sp.status);
  const filter: BorrowingFilter | "" = (BORROWING_FILTERS as readonly string[]).includes(raw) ? (raw as BorrowingFilter) : "";
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const s = await requireSession("/circulation/borrowings");

  const header = <PageHeader title="Phiếu mượn" description="Danh sách phiếu mượn và tra phiếu theo mã phiếu." />;

  if (!can(s, PERMISSIONS.BORROWING_SEARCH)) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-4">
          <LookupForm />
          <NoPermission feature="Danh sách phiếu mượn" />
        </div>
      </>
    );
  }

  // BE đánh số trang từ 0; URL của FE từ 1 (DataTable mode server).
  const q = new URLSearchParams({ page: String(page - 1), size: String(PAGE_SIZE) });
  if (filter === "ACTIVE" || filter === "RETURNED") q.set("status", filter);
  if (filter === "OVERDUE") q.set("overdue", "true");

  let data: BorrowingPage | null = null;
  let error = null;
  try {
    data = await gatewayFetch<BorrowingPage>(`/api/borrowings/search?${q}`);
  } catch (e) {
    error = toErrorInfo(e);
  }

  const names = new Map<string, string>();
  if (data && can(s, PERMISSIONS.USER_SEARCH)) {
    try {
      const users = await gatewayFetch<{ items: UserBrief[] }>("/api/users?size=100");
      for (const u of users.items ?? []) names.set(u.id, `${u.fullName} (${u.username})`);
    } catch {
      // Không lấy được tên thì hiện mã rút gọn, không làm hỏng cả trang.
    }
  }

  const rows = (data?.items ?? []).map((b) => {
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

  const empty = filter
    ? { title: "Không có phiếu mượn nào ở trạng thái này.", action: { label: "Xóa bộ lọc", href: "/circulation/borrowings" } }
    : { title: "Chưa có phiếu mượn nào.", action: { label: "Lập phiếu mượn", href: "/circulation/borrow" } };

  return (
    <>
      {header}
      <div className="flex max-w-[1200px] flex-col gap-5">
        <LookupForm />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BorrowingStatusFilter value={filter} />
          {data && <span className="text-sm text-muted">{data.total} phiếu</span>}
        </div>
        {error ? (
          <ErrorPanel error={error} retryHref={`/circulation/borrowings?${new URLSearchParams(sp as Record<string, string>)}`} />
        ) : (
          <DataTable
            rowKey="id"
            rows={rows}
            empty={empty}
            mobileTitleKey="code"
            pagination={{ mode: "server", page, pageSize: PAGE_SIZE, total: data?.total ?? 0 }}
            columns={[
              { key: "code", title: "Mã phiếu", dataIndex: "code", kind: "link", href: "/circulation/borrowings/{id}" },
              { key: "reader", title: "Độc giả", dataIndex: "reader" },
              { key: "borrowDate", title: "Ngày mượn", dataIndex: "borrowDate", kind: "date" },
              { key: "dueDate", title: "Hạn trả", dataIndex: "dueDate", kind: "date" },
              { key: "books", title: "Số sách", dataIndex: "books" },
              { key: "renewCount", title: "Gia hạn", dataIndex: "renewCount", align: "right" },
              { key: "status", title: "Trạng thái", dataIndex: "shownStatus", kind: "status", statusDomain: "borrowing" },
            ]}
          />
        )}
      </div>
    </>
  );
}
