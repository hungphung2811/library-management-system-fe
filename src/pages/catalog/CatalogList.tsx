import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Button, EXCEL_IMPORTS, ExcelImportButton, NoPermission, PageHeader, PlusOutlined, QueryBoundary, SearchBar } from "@/ui";
import { BooksTable } from "./_components/BooksTable";
import { NewBookModal } from "./_components/NewBookModal";
import { ActiveFilters, CatalogControls } from "./_components/CatalogFilters";
import { filterByIsbn, parsePage, parseSize, parseSort, sortBooks } from "./_components/catalog-filters";
import type { TitleView } from "./_components/types";

export default function CatalogListPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const q = (sp.get("q") ?? "").trim();
  const isbn = (sp.get("isbn") ?? "").trim();
  const available = sp.get("available") === "true";
  const sort = parseSort(sp.get("sort"));
  const size = parseSize(sp.get("size"));
  const page = parsePage(sp.get("page"));
  const allowed = can(s, PERMISSIONS.BOOK_SEARCH);
  const canCreate = can(s, PERMISSIONS.BOOK_CREATE);

  // BE chỉ nhận keyword (khớp tên và tác giả) và available; ISBN lọc phía client trên kết quả đã tải.
  const params = new URLSearchParams();
  if (q) params.set("keyword", q);
  if (available) params.set("available", "true");
  const categoryId = sp.get("categoryId");
  const publisherId = sp.get("publisherId");
  if (categoryId) params.set("categoryId", categoryId);
  if (publisherId) params.set("publisherId", publisherId);
  const qs = params.size ? `?${params}` : "";
  const query = useApi<TitleView[]>(allowed ? `/api/books${qs}` : null);

  const newOpen = canCreate && sp.get("new") === "1";
  const setNewOpen = (open: boolean) => {
    const n = new URLSearchParams(sp);
    if (open) n.set("new", "1");
    else n.delete("new");
    setSp(n, { replace: true });
  };

  const header = (
    <PageHeader
      title="Sách"
      description="Tìm đầu sách và xem số bản sẵn có."
      actions={
        <>
          <ExcelImportButton cfg={EXCEL_IMPORTS.titles} />
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>
              Thêm sách
            </Button>
          )}
        </>
      }
    />
  );
  if (!allowed) {
    return (
      <>
        {header}
        <NoPermission feature="Tra cứu sách" />
      </>
    );
  }

  const filtered = !!q || !!isbn || available || !!categoryId || !!publisherId;
  const empty = filtered
    ? {
        title: q ? `Không tìm thấy sách cho «${q}».` : categoryId || publisherId ? "Không có sách nào thuộc thể loại/nhà xuất bản đã chọn." : isbn ? `Không có sách nào có ISBN chứa «${isbn}».` : "Không có sách nào còn bản sẵn sàng.",
        hint: "Thử bớt bộ lọc (bỏ chip hoặc bấm «Xóa bộ lọc» phía trên) hoặc dùng từ khóa khác.",
      }
    : {
        title: "Chưa có đầu sách nào.",
        action: canCreate ? { label: "Thêm sách đầu tiên", href: "/catalog?new=1" } : undefined,
      };

  return (
    <>
      {header}
      <NewBookModal open={newOpen} onClose={() => setNewOpen(false)} />
      <div className="flex flex-col gap-4">
        <SearchBar placeholder="Tìm theo tên sách hoặc tác giả" extra={<CatalogControls available={available} />} />
        <QueryBoundary query={query}>
          {(books) => {
            const rows = sortBooks(filterByIsbn(Array.isArray(books) ? books : [], isbn), sort);
            return (
              <>
                <ActiveFilters total={rows.length} q={q} isbn={isbn} available={available} />
                <BooksTable books={rows} empty={empty} page={page} pageSize={size} />
              </>
            );
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
