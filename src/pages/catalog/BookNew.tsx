import { PERMISSIONS, can, useSession } from "@/api";
import { NoPermission, PageHeader } from "@/ui";
import { NewBookForm } from "./_components/NewBookForm";

export default function BookNewPage() {
  const s = useSession();
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
