import { PERMISSIONS, can, gatewayFetch, requireSession, toErrorInfo } from "@mfe/api";
import { DataTable, ErrorPanel, NoPermission, PageHeader } from "@mfe/ui";
import { CollectFinesButton } from "../_components/CollectFinesButton";
import { FineReaderPicker } from "../_components/FineReaderPicker";
import { FINE_REASONS, UUID_RE, shortId, type ReaderFines } from "../_lib/circulation";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

type UserBrief = { id: string; username: string; fullName: string; email: string };

export default async function FinesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requireSession("/circulation/fines");
  const staff = can(s, PERMISSIONS.FINE_BY_READER);
  const readerId = one(sp.readerId);
  const validReader = UUID_RE.test(readerId) ? readerId : "";

  const header = (
    <PageHeader
      title="Phạt"
      description={staff ? "Tra cứu và thu phí phạt của độc giả." : "Các khoản phạt của bạn."}
    />
  );

  // Thủ thư: chọn độc giả rồi xem; người dùng thường: chỉ xem phạt của mình.
  if (staff && !validReader) {
    return (
      <>
        {header}
        <div className="flex max-w-[1200px] flex-col gap-5">
          <FineReaderPicker />
          <p className="text-sm text-muted">Chọn một độc giả để xem các khoản phạt.</p>
        </div>
      </>
    );
  }

  let data: ReaderFines | null = null;
  let error = null;
  try {
    data = await gatewayFetch<ReaderFines>(staff ? `/api/fines?readerId=${validReader}` : "/api/fines/mine");
  } catch (e) {
    error = toErrorInfo(e);
  }

  let reader: { value: string; label: string } | undefined;
  if (staff && can(s, PERMISSIONS.USER_VIEW)) {
    try {
      const u = await gatewayFetch<UserBrief>(`/api/users/${validReader}`);
      reader = { value: u.id, label: `${u.fullName} · ${u.username} · ${u.email}` };
    } catch {
      // Không lấy được tên thì ô chọn hiện mã rút gọn.
    }
  }
  reader ??= staff ? { value: validReader, label: shortId(validReader) } : undefined;

  const rows = (data?.fines ?? []).map((f) => ({
    id: f.id,
    createdAt: f.createdAt,
    reason: FINE_REASONS[f.reason] ?? f.reason,
    borrowing: shortId(f.borrowingId),
    amount: f.amount,
    status: f.status,
    paidAt: f.paidAt,
  }));
  const canCollect = staff && can(s, PERMISSIONS.FINE_COLLECT) && (data?.totalUnpaid ?? 0) > 0;

  return (
    <>
      {header}
      <div className="flex max-w-[1200px] flex-col gap-5">
        {staff && <FineReaderPicker current={reader} />}
        {error ? (
          <ErrorPanel error={error} retryHref={`/circulation/fines?${new URLSearchParams(sp as Record<string, string>)}`} />
        ) : (
          data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <div className="text-sm text-muted">Tổng chưa thanh toán</div>
                  <div className="text-2xl font-semibold">{vnd(data.totalUnpaid)}</div>
                </div>
                {canCollect && <CollectFinesButton readerId={data.readerId} total={vnd(data.totalUnpaid)} />}
                {staff && !can(s, PERMISSIONS.FINE_COLLECT) && data.totalUnpaid > 0 && (
                  <NoPermission feature="Thu phạt" />
                )}
              </div>
              <DataTable
                rowKey="id"
                rows={rows}
                mobileTitleKey="reason"
                empty={{ title: "Độc giả không có khoản phạt nào." }}
                columns={[
                  { key: "createdAt", title: "Ngày phát sinh", dataIndex: "createdAt", kind: "date" },
                  { key: "reason", title: "Lý do", dataIndex: "reason" },
                  { key: "borrowing", title: "Phiếu mượn", dataIndex: "borrowing", kind: "mono" },
                  { key: "amount", title: "Số tiền", dataIndex: "amount", kind: "money", align: "right" },
                  { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "fine" },
                  { key: "paidAt", title: "Ngày thanh toán", dataIndex: "paidAt", kind: "date" },
                ]}
              />
            </>
          )
        )}
      </div>
    </>
  );
}
