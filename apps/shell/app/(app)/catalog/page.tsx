import { PERMISSIONS, can, gatewayFetch, requireSession, toErrorInfo } from "@mfe/api";
import { Button, ErrorPanel, NoPermission, PageHeader, PlusOutlined, ScanOutlined, SearchBar } from "@mfe/ui";
import { AvailableToggle } from "./_components/AvailableToggle";
import { BooksTable } from "./_components/BooksTable";
import type { TitleView } from "./types";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const available = one(sp.available) === "true";
  const s = await requireSession("/catalog");

  if (!can(s, PERMISSIONS.BOOK_SEARCH)) {
    return (
      <>
        <PageHeader title="Sách" description="Tìm đầu sách và xem số bản sẵn có." />
        <NoPermission feature="Tra cứu sách" />
      </>
    );
  }

  const canCreate = can(s, PERMISSIONS.BOOK_CREATE);
  const canBarcode = can(s, PERMISSIONS.COPY_BY_BARCODE);

  const params = new URLSearchParams();
  if (q) params.set("keyword", q);
  if (available) params.set("available", "true");
  const qs = params.size ? `?${params}` : "";

  let books: TitleView[] | null = null;
  let error = null;
  try {
    books = await gatewayFetch<TitleView[]>(`/api/books${qs}`);
  } catch (e) {
    error = toErrorInfo(e);
  }

  const filtered = !!q || available;
  const empty = filtered
    ? {
        title: q ? `Không tìm thấy sách cho «${q}».` : "Không có sách nào còn bản sẵn sàng.",
        action: { label: "Xóa bộ lọc", href: "/catalog" },
      }
    : {
        title: "Chưa có đầu sách nào.",
        action: canCreate ? { label: "Thêm sách đầu tiên", href: "/catalog/books/new" } : undefined,
      };

  return (
    <>
      <PageHeader
        title="Sách"
        description="Tìm đầu sách và xem số bản sẵn có."
        actions={
          <>
            {canBarcode && (
              <Button href="/catalog/barcode" icon={<ScanOutlined />}>
                Tra theo mã vạch
              </Button>
            )}
            {canCreate && (
              <Button type="primary" href="/catalog/books/new" icon={<PlusOutlined />}>
                Thêm sách
              </Button>
            )}
          </>
        }
      />
      <div className="flex max-w-[1200px] flex-col gap-5">
        <SearchBar
          placeholder="Tìm theo tên sách, tác giả hoặc ISBN"
          defaultValue={q}
          extra={<AvailableToggle checked={available} />}
        />
        {error ? (
          <ErrorPanel error={error} retryHref={`/catalog${qs}`} />
        ) : (
          <BooksTable books={books ?? []} empty={empty} />
        )}
      </div>
    </>
  );
}
