import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import {
  Alert,
  App,
  Button,
  Card,
  ConfirmAction,
  DataTable,
  KeyValueList,
  ScanInput,
  StatusTag,
  Tag,
  Text,
  describeError,
  formatDate,
} from "@/ui";
import {
  CIRC_ERRORS,
  COPY_CONDITIONS,
  MAX_RENEWALS,
  displayStatus,
  overdueDays,
  shortId,
  type BorrowingView,
  type CopyDetails,
  type CopyInfo,
  type FineView,
} from "../_lib/circulation";
import { NewFinesAlert } from "./NewFinesAlert";

const isBorrowing = (v: unknown): v is BorrowingView =>
  !!v && typeof v === "object" && Array.isArray((v as BorrowingView).items) && typeof (v as BorrowingView).id === "string";

/**
 * Chi tiết một phiếu mượn kèm thao tác gia hạn và trả sách; dùng ở trang chi tiết phiếu và trang nhận trả.
 * `copies` là tên sách/mã vạch của từng bản sao (do trang lấy thêm); thiếu thì hiện mã bản sao rút gọn.
 * `canReturn`/`canRenew`/`canScan` là boolean từ server, chỉ ẩn/hiện UI.
 */
export function BorrowingPanel({
  initial,
  copies,
  canReturn,
  canRenew,
  canScan,
  canReportLost,
  withScan,
}: {
  initial: BorrowingView;
  copies: Record<string, CopyInfo>;
  canReturn: boolean;
  canRenew: boolean;
  canScan: boolean;
  /** Có khóa BorrowingController/reportLost: hiện nút "Báo mất" ở từng dòng chưa trả. */
  canReportLost?: boolean;
  /** Hiện ô quét mã vạch để trả (trang nhận trả). */
  withScan?: boolean;
}) {
  const { message } = App.useApp();
  const session = useSession();
  const [b, setB] = useState(initial);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const [newFines, setNewFines] = useState<FineView[]>([]);

  const od = overdueDays(b);
  const active = b.status === "ACTIVE";
  const copyName = (id: string) => copies[id]?.titleName ?? `Bản sao ${shortId(id)}`;

  const invalidate = useInvalidateApi();
  const apply = async (res: unknown) => {
    if (isBorrowing(res)) {
      setB(res);
      setNewFines(res.fines ?? []);
    } else {
      const suffix = can(session, PERMISSIONS.BORROWING_GET_ANY) ? "/detail" : "";
      setB(await apiFetch<BorrowingView>(`/api/borrowings/${encodeURIComponent(b.id)}${suffix}`));
    }
    void invalidate("/api/borrowings", "/api/fines");
  };

  const doReturn = async (bookCopyId: string) => {
    setError(null);
    setInfo(null);
    setReturning(bookCopyId);
    try {
      const res = await apiFetch<BorrowingView>(`/api/borrowings/${encodeURIComponent(b.id)}/returns`, {
        method: "POST",
        json: { bookCopyId },
      });
      await apply(res);
      message.success(`Đã nhận trả «${copyName(bookCopyId)}».`);
    } catch (e) {
      const ei = toErrorInfo(e);
      if (/đã được trả/i.test(ei.message ?? "")) setInfo(ei.message ?? "Bản sao đã được trả.");
      else setError(ei);
    } finally {
      setReturning(null);
    }
  };

  const doReportLost = async (bookCopyId: string) => {
    setError(null);
    setInfo(null);
    setReturning(bookCopyId);
    try {
      const res = await apiFetch<BorrowingView>("/api/borrowings/losses", { method: "POST", json: { bookCopyId } });
      await apply(res);
      message.warning(`Đã ghi nhận mất «${copyName(bookCopyId)}».`);
    } catch (e) {
      setError(toErrorInfo(e));
    } finally {
      setReturning(null);
    }
  };

  const doRenew = async () => {
    setError(null);
    setInfo(null);
    try {
      const res = await apiFetch<BorrowingView>(`/api/borrowings/${encodeURIComponent(b.id)}/renewals`, {
        method: "POST",
      });
      await apply(res);
      message.success(isBorrowing(res) ? `Đã gia hạn. Hạn trả mới: ${formatDate(res.dueDate)}.` : "Đã gia hạn.");
    } catch (e) {
      setError(toErrorInfo(e)); // lỗi gia hạn (quá hạn, đủ số lần...): message BE đã là tiếng Việt, hiện trong Alert
    }
  };

  const onScan = async (code: string) => {
    setError(null);
    setInfo(null);
    let copy: CopyDetails;
    try {
      copy = await apiFetch<CopyDetails>(`/api/book-copies/by-barcode/${encodeURIComponent(code)}`);
    } catch (e) {
      const ei = toErrorInfo(e);
      setError(ei.status === 404 ? { status: 404, message: `Không tìm thấy bản sao có mã vạch «${code}».` } : ei);
      return;
    }
    const item = b.items.find((i) => i.bookCopyId === copy.id);
    if (!item) {
      setError({ status: 400, message: "Sách này không thuộc phiếu mượn đang chọn." });
      return;
    }
    if (item.returnDate) {
      setInfo(`«${copy.titleName ?? code}» đã được trả trước đó.`);
      return;
    }
    await doReturn(copy.id);
  };

  const rows = b.items.map((i) => ({
    key: i.bookCopyId,
    bookCopyId: i.bookCopyId,
    titleName: copies[i.bookCopyId]?.titleName ?? `Bản sao ${shortId(i.bookCopyId)}`,
    barcode: copies[i.bookCopyId]?.barcode ?? "",
    returnDate: i.returnDate,
    condition: i.condition ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      {b.status === "RETURNED" && <Alert type="success" showIcon title="Phiếu đã trả hết." />}
      {error && (
        <Alert
          type={error.status === 409 ? "warning" : "error"}
          showIcon
          title={describeError(error, CIRC_ERRORS).text}
          description={describeError(error, CIRC_ERRORS).detail}
        />
      )}
      {info && <Alert type="info" showIcon title={info} />}
      <NewFinesAlert fines={newFines} readerId={b.userId} />

      <Card
        title="Thông tin phiếu"
        extra={
          <div className="flex flex-wrap gap-2">
            {canRenew && active && b.renewCount < MAX_RENEWALS && (
              <ConfirmAction
                title="Gia hạn phiếu mượn?"
                description="Hạn trả mới sẽ được tính theo quy định thư viện."
                okText="Gia hạn"
                onConfirm={doRenew}
              >
                <Button>Gia hạn</Button>
              </ConfirmAction>
            )}
          </div>
        }
      >
        <KeyValueList
          columns={2}
          items={[
            { label: "Mã phiếu", value: <Text copyable>{b.id}</Text>, mono: true },
            { label: "Độc giả (mã người dùng)", value: b.userId, mono: true },
            { label: "Ngày mượn", value: formatDate(b.borrowDate) },
            {
              label: "Hạn trả",
              value: <span className={od > 0 ? "font-semibold text-red-600" : undefined}>{formatDate(b.dueDate)}</span>,
            },
            {
              label: "Trạng thái",
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  <StatusTag domain="borrowing" value={displayStatus(b)} />
                  {od > 0 && <Tag color="error">Quá hạn {od} ngày</Tag>}
                </span>
              ),
            },
            { label: "Đã gia hạn", value: `${b.renewCount}/${MAX_RENEWALS} lần` },
          ]}
        />
        {!canRenew && !canReturn && <Text type="secondary">Bạn chỉ có quyền xem.</Text>}
      </Card>

      {withScan && canReturn && active && (
        <Card title="Quét sách để trả">
          <ScanInput
            autoFocus
            busy={returning !== null}
            label={canScan ? "Quét hoặc nhập mã vạch sách" : "Mã vạch sách"}
            hint="Nhấn Enter để nhận trả. Sách phải thuộc phiếu này."
            onScan={onScan}
          />
        </Card>
      )}

      <Card title="Sách trong phiếu">
        <DataTable
          rowKey="key"
          mobileTitleKey="titleName"
          empty={{ title: "Phiếu này không có sách." }}
          rows={rows}
          columns={[
            { key: "titleName", title: "Tên sách", dataIndex: "titleName" },
            { key: "barcode", title: "Mã vạch", dataIndex: "barcode", kind: "mono" },
            {
              key: "returnDate",
              title: "Ngày trả",
              dataIndex: "returnDate",
              render: (v) => (v ? formatDate(String(v)) : "Chưa trả"),
            },
            {
              key: "state",
              title: "Trạng thái",
              dataIndex: "returnDate",
              render: (v, row) =>
                row.condition === "LOST" ? (
                  <Tag color="error">Đã mất</Tag>
                ) : v ? (
                  <Tag color="success">Đã trả</Tag>
                ) : (
                  <Tag color="processing">Đang mượn</Tag>
                ),
            },
            {
              key: "condition",
              title: "Tình trạng",
              dataIndex: "condition",
              render: (v) =>
                v ? <Tag color={v === "GOOD" ? "success" : v === "DAMAGED" ? "orange" : "error"}>{COPY_CONDITIONS[String(v)] ?? String(v)}</Tag> : "—",
            },
            ...(canReturn || canReportLost
              ? [
                  {
                    key: "action",
                    title: "Thao tác",
                    dataIndex: "bookCopyId",
                    render: (id: unknown, row: Record<string, unknown>) =>
                      row.returnDate ? null : (
                        <span className="flex gap-2">
                          {canReturn && (
                            <Button
                              size="small"
                              loading={returning === id}
                              disabled={returning !== null}
                              aria-label={`Trả «${String(row.titleName)}»`}
                              onClick={() => void doReturn(String(id))}
                            >
                              Trả
                            </Button>
                          )}
                          {canReportLost && (
                            <ConfirmAction
                              title={`Báo mất «${String(row.titleName)}»?`}
                              description="Hệ thống sẽ lập khoản phạt mất sách cho độc giả. Không hoàn tác được."
                              okText="Xác nhận báo mất"
                              danger
                              onConfirm={() => doReportLost(String(id))}
                            >
                              <Button size="small" danger disabled={returning !== null} aria-label={`Báo mất «${String(row.titleName)}»`}>
                                Báo mất
                              </Button>
                            </ConfirmAction>
                          )}
                        </span>
                      ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </div>
  );
}
