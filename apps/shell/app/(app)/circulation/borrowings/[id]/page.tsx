import { Button, NoPermission, PageHeader, Result } from "@mfe/ui";
import { ErrorPanel } from "@mfe/ui";
import { GatewayError, PERMISSIONS, can, gatewayFetch, requireSession } from "@mfe/api";
import { toErrorInfo } from "@mfe/api/client";
import { BorrowingPanel } from "../../_components/BorrowingPanel";
import { UUID_RE, shortId, type BorrowingView, type CopyDetails, type CopyInfo } from "../../_lib/circulation";

export default async function BorrowingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/circulation/borrowings/${id}`;
  const s = await requireSession(path); // ngoài try: redirect() hoạt động bằng cách ném lỗi

  const wrap = (children: React.ReactNode, title = "Phiếu mượn") => (
    <>
      <PageHeader title={title} />
      {children}
    </>
  );
  const notFound = wrap(
    <Result
      status="404"
      title="Không tìm thấy phiếu mượn"
      extra={<Button href="/circulation/borrowings">Về trang phiếu mượn</Button>}
    />,
  );

  if (!UUID_RE.test(id)) return notFound;

  let b: BorrowingView;
  try {
    b = await gatewayFetch<BorrowingView>(`/api/borrowings/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof GatewayError && e.status === 404) return notFound;
    if (e instanceof GatewayError && e.status === 403) return wrap(<NoPermission feature="Xem phiếu mượn này" />);
    return wrap(<ErrorPanel error={toErrorInfo(e)} retryHref={path} />);
  }

  // BorrowingView chỉ có bookCopyId: lấy thêm tên sách/mã vạch nếu có quyền xem bản sao (thất bại từng dòng thì hiện mã rút gọn).
  const copies: Record<string, CopyInfo> = {};
  if (can(s, PERMISSIONS.COPY_VIEW)) {
    const r = await Promise.allSettled(
      b.items.map((i) => gatewayFetch<CopyDetails>(`/api/book-copies/${encodeURIComponent(i.bookCopyId)}`)),
    );
    r.forEach((x, idx) => {
      if (x.status === "fulfilled") copies[b.items[idx].bookCopyId] = { titleName: x.value.titleName, barcode: x.value.barcode };
    });
  }

  return (
    <>
      <PageHeader title="Phiếu mượn" description={<span className="font-mono">{shortId(b.id)}…</span>} />
      <div className="max-w-[960px]">
        <BorrowingPanel
          initial={b}
          copies={copies}
          canReturn={can(s, PERMISSIONS.RETURN_BOOK)}
          canRenew={can(s, PERMISSIONS.RENEW)}
          canScan={can(s, PERMISSIONS.COPY_BY_BARCODE)}
        />
      </div>
    </>
  );
}
