import { useMemo } from "react";
import { useApi } from "@/api";
import { DataTable, FilterBar, PageHeader, QueryBoundary, useFilterParams, type FilterField, Eye, actionsColumn } from "@/ui";
import { displayStatus, overdueDays, shortId, type BorrowingView } from "./_lib/circulation";


/** Phiếu mượn của chính người đăng nhập (GET /api/borrowings/mine: chỉ cần đăng nhập, BE trả mảng nên lọc/phân trang phía client). */
export default function MinePage() {
  const schema = useMemo<FilterField[]>(
    () => [
      {
        type: "select",
        name: "status",
        label: "Trạng thái",
        options: [
          { value: "ACTIVE", label: "Đang mượn" },
          { value: "OVERDUE", label: "Quá hạn" },
          { value: "RETURNED", label: "Đã trả hết" },
        ],
      },
      { type: "dateRange", name: "borrowDate", label: "Ngày mượn" },
    ],
    [],
  );
  const f = useFilterParams(schema, { defaultSize: 20 });
  const q = useApi<BorrowingView[]>("/api/borrowings/mine");
  const status = f.str("status");
  const range = f.range("borrowDate");

  return (
    <>
      <PageHeader title="Phiếu của tôi" description="Các phiếu mượn của bạn: sách đang mượn, hạn trả và lịch sử." />
      <div className="flex flex-col gap-4">
        <QueryBoundary query={q}>
          {(all) => {
            const list = all
              .filter((b) => {
                if (status === "OVERDUE") return overdueDays(b) > 0;
                return !status || b.status === status;
              })
              .filter((b) => (!range.from || b.borrowDate >= range.from) && (!range.to || b.borrowDate <= range.to))
              .sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));
            const rows = list.map((b) => {
              const returned = b.items.filter((i) => i.returnDate).length;
              return {
                id: b.id,
                code: shortId(b.id),
                borrowDate: b.borrowDate,
                dueDate: b.dueDate,
                books: returned > 0 ? `${b.items.length} cuốn (đã trả ${returned})` : `${b.items.length} cuốn`,
                renewCount: String(b.renewCount),
                shownStatus: displayStatus(b),
              };
            });
            return (
              <>
                <FilterBar filters={f} total={rows.length} unit="phiếu" />
                <DataTable
                  key={`${f.params.toString()}|${f.size}`}
                  rowKey="id"
                  rows={rows}
                  mobileTitleKey="code"
                  empty={
                    f.hasFilter
                      ? { title: "Không có phiếu nào khớp bộ lọc.", action: { label: "Xóa bộ lọc", href: "/circulation/mine" } }
                      : { title: "Bạn chưa có phiếu mượn nào." }
                  }
                  pagination={{ mode: "client", pageSize: f.size, onSizeChange: f.setSize }}
                  columns={[
                    { key: "code", title: "Mã phiếu", dataIndex: "code", kind: "link", href: "/circulation/borrowings/{id}" },
                    { key: "borrowDate", title: "Ngày mượn", dataIndex: "borrowDate", kind: "date" },
                    { key: "dueDate", title: "Hạn trả", dataIndex: "dueDate", kind: "date" },
                    { key: "books", title: "Số sách", dataIndex: "books" },
                    { key: "renewCount", title: "Gia hạn", dataIndex: "renewCount", align: "right" },
                    { key: "status", title: "Trạng thái", dataIndex: "shownStatus", kind: "status", statusDomain: "borrowing" },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/circulation/borrowings/${encodeURIComponent(String(row.id))}` }], 1),
]}
                />
              </>
            );
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
