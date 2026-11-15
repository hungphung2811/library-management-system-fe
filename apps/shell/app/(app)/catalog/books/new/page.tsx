import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { NoPermission, PageHeader } from "@mfe/ui";
import { NewBookForm } from "../../_components/NewBookForm";

export default async function NewBookPage() {
  const s = await requireSession("/catalog/books/new");
  return (
    <>
      <PageHeader title="Thêm sách" description="Tạo đầu sách mới; thêm bản sao sau khi lưu." />
      {can(s, PERMISSIONS.BOOK_CREATE) ? (
        <div className="max-w-[720px]">
          <NewBookForm />
        </div>
      ) : (
        <NoPermission feature="Thêm sách" />
      )}
    </>
  );
}
