import { PERMISSIONS, can, useSession } from "@/api";
import { NoPermission, PageHeader } from "@/ui";
import { BorrowDesk } from "./_components/BorrowDesk";

export default function BorrowPage() {
  const s = useSession();
  return (
    <>
      <PageHeader title="Lập phiếu mượn" description="Chọn độc giả, quét mã vạch sách rồi lập phiếu." />
      {can(s, PERMISSIONS.BORROW_BOOK) ? (
        <BorrowDesk
          canSearchUsers={can(s, PERMISSIONS.USER_SEARCH)}
          canViewReader={can(s, PERMISSIONS.READER_VIEW)}
          canScan={can(s, PERMISSIONS.COPY_BY_BARCODE)}
          canIssueCard={can(s, PERMISSIONS.READER_ISSUE)}
          canRenewCard={can(s, PERMISSIONS.READER_RENEW)}
        />
      ) : (
        <NoPermission feature="Lập phiếu mượn" />
      )}
    </>
  );
}
