import { PERMISSIONS, can, gatewayFetch, requireSession, toErrorInfo, type ErrorInfo } from "@mfe/api";
import { Breadcrumb, Button, Card, ErrorPanel, KeyValueList, NoPermission, PageHeader, Result, Statistic, Text, formatMoney } from "@mfe/ui";
import { CopiesPanel } from "../../_components/CopiesPanel";
import { ReserveButton } from "../../_components/ReserveButton";
import type { CopyView, TitleView } from "../../types";

type SP = Record<string, string | string[] | undefined>;

export default async function BookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const path = `/catalog/books/${encodeURIComponent(id)}`;
  const s = await requireSession(path);

  if (!can(s, PERMISSIONS.BOOK_VIEW)) {
    return (
      <>
        <PageHeader title="Chi tiết sách" />
        <NoPermission feature="Xem chi tiết sách" />
      </>
    );
  }

  let book: TitleView | null = null;
  let bookError: ErrorInfo | null = null;
  try {
    book = await gatewayFetch<TitleView>(`/api/books/${encodeURIComponent(id)}`);
  } catch (e) {
    bookError = toErrorInfo(e);
  }

  if (!book) {
    return (
      <>
        <div className="max-w-[1200px]">
          {bookError?.status === 404 ? (
            <Result
              status="404"
              title="Không tìm thấy sách"
              extra={
                <Button type="primary" href="/catalog">
                  Về danh sách
                </Button>
              }
            />
          ) : (
            <ErrorPanel error={bookError ?? { status: 500 }} retryHref={path} />
          )}
        </div>
      </>
    );
  }

  const canList = can(s, PERMISSIONS.COPY_LIST);
  const canAdd = can(s, PERMISSIONS.COPY_ADD);
  const canChange = can(s, PERMISSIONS.COPY_CHANGE_STATUS);
  const canReserve = can(s, PERMISSIONS.RESERVE) && book.availableCopies === 0;

  let copies: CopyView[] | null = null;
  let copiesError: ErrorInfo | null = null;
  if (canList) {
    try {
      copies = await gatewayFetch<CopyView[]>(`/api/book-copies?titleId=${encodeURIComponent(id)}`);
    } catch (e) {
      copiesError = toErrorInfo(e);
    }
  }

  const openAdd = (Array.isArray(sp.addCopy) ? sp.addCopy[0] : sp.addCopy) === "1";

  return (
    <>
      <div className="flex max-w-[1200px] flex-col gap-5">
        <Breadcrumb items={[{ title: <a href="/catalog">Sách</a> }, { title: book.name }]} />
        <PageHeader
          title={book.name}
          description={book.author}
          actions={canReserve ? <ReserveButton titleId={book.id} /> : undefined}
        />
        <Card title="Thông tin">
          <KeyValueList
            columns={2}
            items={[
              { label: "Tên sách", value: book.name },
              { label: "Tác giả", value: book.author },
              { label: "ISBN", value: book.isbn, mono: true },
              { label: "Giá bìa", value: formatMoney(book.coverPrice) },
              {
                label: "Số bản sẵn có",
                value: <Statistic value={book.availableCopies} styles={{ content: { fontSize: 18 } }} />,
              },
            ]}
          />
          <Text type="secondary" className="text-sm">
            Chức năng sửa thông tin sách chưa có vì hệ thống chưa hỗ trợ.
          </Text>
        </Card>
        {canList ? (
          <CopiesPanel
            titleId={book.id}
            titleName={book.name}
            initial={copies}
            error={copiesError}
            canAdd={canAdd}
            canChange={canChange}
            openAdd={openAdd}
          />
        ) : (
          <Card title="Bản sao">
            <Text type="secondary">Bạn không có quyền xem danh sách bản sao.</Text>
          </Card>
        )}
      </div>
    </>
  );
}
