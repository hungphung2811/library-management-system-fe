import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { NoPermission, PageHeader, QueryBoundary, type Opt } from "@/ui";
import { CollectFinesButton } from "./_components/CollectFinesButton";
import { FineReaderPicker } from "./_components/FineReaderPicker";
import { FinesTable } from "./_components/FinesTable";
import { UUID_RE, shortId, userLabel, type ReaderFines, type UserBrief } from "./_lib/circulation";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

export default function FinesPage() {
  const s = useSession();
  const [sp] = useSearchParams();
  const staff = can(s, PERMISSIONS.FINE_BY_READER);
  const readerId = sp.get("readerId") ?? "";
  const validReader = UUID_RE.test(readerId) ? readerId : "";

  const header = (
    <PageHeader
      title="Phạt"
      description={staff ? "Tra cứu và thu phí phạt của độc giả." : "Các khoản phạt của bạn."}
    />
  );

  // Thủ thư: chọn độc giả rồi xem; người dùng thường: chỉ xem phạt của mình.
  const fines = useApi<ReaderFines>(staff ? (validReader ? `/api/fines?readerId=${validReader}` : null) : "/api/fines/mine");
  const user = useApi<UserBrief>(staff && validReader && can(s, PERMISSIONS.USER_VIEW) ? `/api/users/${validReader}` : null);

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

  // Không lấy được tên thì ô chọn hiện mã rút gọn.
  const reader: Opt | undefined = staff
    ? user.data
      ? { value: user.data.id, label: userLabel(user.data) }
      : { value: validReader, label: shortId(validReader) }
    : undefined;

  return (
    <>
      {header}
      <div className="flex max-w-[1200px] flex-col gap-5">
        {staff && <FineReaderPicker current={reader} />}
        <QueryBoundary query={fines}>
          {(data) => {
            const canCollect = staff && can(s, PERMISSIONS.FINE_COLLECT) && data.totalUnpaid > 0;
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line p-4">
                  <div>
                    <div className="text-sm text-muted">Tổng chưa thanh toán</div>
                    <div className="text-2xl font-semibold">{vnd(data.totalUnpaid)}</div>
                  </div>
                  {canCollect && <CollectFinesButton readerId={data.readerId} total={vnd(data.totalUnpaid)} />}
                  {staff && !can(s, PERMISSIONS.FINE_COLLECT) && data.totalUnpaid > 0 && <NoPermission feature="Thu phạt" />}
                </div>
                <FinesTable fines={data.fines ?? []} />
              </>
            );
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
