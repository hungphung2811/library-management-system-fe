import type { ReactNode } from "react";
import { useParams } from "react-router";
import { PERMISSIONS, can, toErrorInfo, useApi, useSession } from "@/api";
import { ErrorPanel, LinkButton, NoPermission, PageHeader, PageSkeleton, Result } from "@/ui";
import { BorrowingPanel } from "./_components/BorrowingPanel";
import { useCopyInfos } from "./_lib/hooks";
import { UUID_RE, shortId, type BorrowingView } from "./_lib/circulation";

export default function BorrowingDetailPage() {
  const { id = "" } = useParams();
  const s = useSession();
  const validId = UUID_RE.test(id);
  // Nhân viên (khóa getAny) xem phiếu bất kỳ qua /detail; người khác chỉ xem được phiếu của chính mình qua /{id}.
  const staff = can(s, PERMISSIONS.BORROWING_GET_ANY);
  const q = useApi<BorrowingView>(validId ? `/api/borrowings/${encodeURIComponent(id)}${staff ? "/detail" : ""}` : null);
  // BorrowingView chỉ có bookCopyId: lấy thêm tên sách/mã vạch nếu có quyền xem bản sao (lỗi từng dòng thì hiện mã rút gọn).
  const canViewCopy = can(s, PERMISSIONS.COPY_VIEW);
  const copies = useCopyInfos(
    (q.data?.items ?? []).map((i) => i.bookCopyId),
    canViewCopy,
  );

  const wrap = (children: ReactNode, title = "Phiếu mượn") => (
    <>
      <PageHeader title={title} />
      {children}
    </>
  );
  const notFound = wrap(
    <Result
      status="404"
      title="Không tìm thấy phiếu mượn"
      extra={<LinkButton to="/circulation/borrowings">Về trang phiếu mượn</LinkButton>}
    />,
  );

  if (!validId) return notFound;
  if (q.isPending) return wrap(<PageSkeleton variant="detail" />);
  if (q.isError) {
    const e = toErrorInfo(q.error);
    if (e.status === 404) return notFound;
    if (e.status === 403) return wrap(<NoPermission feature="Xem phiếu mượn này" />);
    return wrap(<ErrorPanel error={e} onRetry={() => void q.refetch()} />);
  }
  // Chờ thông tin bản sao (nếu có quyền) để bảng không nhấp nháy từ mã rút gọn sang tên sách.
  if (canViewCopy && q.data.items.length > 0 && copies.isPending) return wrap(<PageSkeleton variant="detail" />);

  const b = q.data;
  return (
    <>
      <PageHeader title="Phiếu mượn" description={<span className="font-mono">{shortId(b.id)}…</span>} />
      <div className="max-w-[960px]">
        <BorrowingPanel
          key={b.id}
          initial={b}
          copies={copies.data ?? {}}
          canReturn={can(s, PERMISSIONS.RETURN_BOOK)}
          canRenew={can(s, PERMISSIONS.RENEW)}
          canScan={can(s, PERMISSIONS.COPY_BY_BARCODE)}
          canReportLost={can(s, PERMISSIONS.BORROWING_REPORT_LOST)}
        />
      </div>
    </>
  );
}
