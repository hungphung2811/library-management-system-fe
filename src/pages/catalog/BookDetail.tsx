import { Link, useParams, useSearchParams } from "react-router";
import { PERMISSIONS, can, toErrorInfo, useApi, useSession } from "@/api";
import {
  Breadcrumb,
  Card,
  ErrorPanel,
  KeyValueList,
  LinkButton,
  NoPermission,
  PageHeader,
  PageSkeleton,
  Result,
  Text,
  formatMoney,
} from "@/ui";
import { BookEditButton } from "./_components/BookEditButton";
import { BookPreviewCard } from "./_components/BookPreviewCard";
import { CopiesPanel } from "./_components/CopiesPanel";
import { ReserveButton } from "./_components/ReserveButton";
import type { TitleView } from "./_components/types";

export default function BookDetailPage() {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const s = useSession();
  const allowed = can(s, PERMISSIONS.BOOK_VIEW);
  const query = useApi<TitleView>(allowed ? `/api/books/${encodeURIComponent(id)}` : null);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Chi tiết sách" />
        <NoPermission feature="Xem chi tiết sách" />
      </>
    );
  }
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError) {
    const err = toErrorInfo(query.error);
    return (
      <div className="max-w-[1200px]">
        {err.status === 404 ? (
          <Result
            status="404"
            title="Không tìm thấy sách"
            extra={
              <LinkButton type="primary" to="/catalog">
                Về danh sách
              </LinkButton>
            }
          />
        ) : (
          <ErrorPanel error={err} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const book = query.data;
  const canList = can(s, PERMISSIONS.COPY_LIST);
  const canAdd = can(s, PERMISSIONS.COPY_ADD);
  const canChange = can(s, PERMISSIONS.COPY_CHANGE_STATUS);
  const canEdit = can(s, PERMISSIONS.BOOK_UPDATE);
  const canReserve = can(s, PERMISSIONS.RESERVE) && book.availableCopies === 0;
  const openAdd = sp.get("addCopy") === "1";

  return (
    <div className="flex max-w-[1200px] flex-col gap-5">
      <Breadcrumb items={[{ title: <Link to="/catalog">Sách</Link> }, { title: book.name }]} />
      <PageHeader
        title={book.name}
        description={book.author}
        actions={
          canEdit || canReserve ? (
            <>
              {canEdit && <BookEditButton book={book} />}
              {canReserve && <ReserveButton titleId={book.id} />}
            </>
          ) : undefined
        }
      />
      <Card title="Thông tin">
        <KeyValueList
          columns={2}
          items={[
            { label: "Tên sách", value: book.name },
            { label: "Tác giả", value: book.author },
            ...(book.authors?.length ? [{ label: "Tác giả (danh mục)", value: book.authors.map((a) => a.name).join(", ") }] : []),
            { label: "Nhà xuất bản", value: book.publisherName },
            { label: "Thể loại", value: book.categoryName },
            { label: "ISBN", value: book.isbn, mono: true },
            { label: "Giá bìa", value: formatMoney(book.coverPrice) },
            {
              label: "Số bản sẵn có",
              value: book.availableCopies,
            },
          ]}
        />
      </Card>
      {can(s, PERMISSIONS.BOOK_PREVIEW_VIEW) && (
        <BookPreviewCard titleId={book.id} canEdit={can(s, PERMISSIONS.BOOK_PREVIEW_UPDATE)} />
      )}
      {canList ? (
        <CopiesPanel titleId={book.id} titleName={book.name} canAdd={canAdd} canChange={canChange} openAdd={openAdd} />
      ) : (
        <Card title="Bản sao">
          <Text type="secondary">Bạn không có quyền xem danh sách bản sao.</Text>
        </Card>
      )}
    </div>
  );
}
