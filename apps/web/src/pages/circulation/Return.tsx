import { PERMISSIONS, can, useSession } from "@/api";
import { NoPermission, PageHeader } from "@/ui";
import { ReturnDesk } from "./_components/ReturnDesk";

export default function ReturnPage() {
  const s = useSession();
  const canReturn = can(s, PERMISSIONS.RETURN_BOOK);
  const canReturnCopy = can(s, PERMISSIONS.BORROWING_RETURN_COPY);
  const canReportLost = can(s, PERMISSIONS.BORROWING_REPORT_LOST);
  return (
    <>
      <PageHeader
        title="Nhận trả sách"
        description="Trả theo mã vạch (chọn tình trạng Tốt/Hỏng), báo mất, hoặc nhập mã phiếu mượn rồi quét sách."
      />
      {canReturn || canReturnCopy || canReportLost ? (
        <ReturnDesk
          canReturn={canReturn}
          canReturnCopy={canReturnCopy}
          canReportLost={canReportLost}
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
