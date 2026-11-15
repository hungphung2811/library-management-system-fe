import { NoPermission, PageHeader } from "@mfe/ui";
import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { ReturnDesk } from "../../components/ReturnDesk";

export default async function ReturnPage() {
  const s = await requireSession("/circulation/return");
  return (
    <>
      <PageHeader title="Nhận trả sách" description="Nhập mã phiếu mượn rồi quét sách để nhận trả." />
      {can(s, PERMISSIONS.RETURN_BOOK) ? (
        <ReturnDesk
          canReturn
          canRenew={can(s, PERMISSIONS.RENEW)}
          canScan={can(s, PERMISSIONS.COPY_BY_BARCODE)}
          canViewCopy={can(s, PERMISSIONS.COPY_VIEW)}
        />
      ) : (
        <NoPermission feature="Nhận trả sách" />
      )}
    </>
  );
}
