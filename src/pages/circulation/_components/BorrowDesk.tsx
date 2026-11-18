import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, toErrorInfo, useInvalidateApi, type ErrorInfo } from "@/api";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Input,
  KeyValueList,
  LinkButton,
  RemoteSelect,
  type Opt,
  ScanInput,
  Statistic,
  StatusTag,
  Tag,
  Text,
  X,
  actionsColumn,
  describeError,
  formatDate,
} from "@/ui";
import { CIRC_ERRORS, UUID_RE, type BorrowingView, type CopyDetails } from "../_lib/circulation";

type UserView = { id: string; username: string; fullName: string; email: string };
type ReaderProfile = {
  userId: string;
  cardNo: string;
  fullName: string;
  email: string;
  readerType: string;
  cardExpiryDate: string;
  status: string;
  cardValid: boolean;
};

const READER_TYPES: Record<string, string> = { STUDENT: "Sinh viên", LECTURER: "Giảng viên" };

type Reader = { id: string; label: string };
type Profile =
  | { state: "loading" }
  | { state: "ok"; data: ReaderProfile }
  | { state: "none" }
  | { state: "unchecked" }
  | { state: "error"; error: ErrorInfo };
type Status = { kind: "success" | "warning"; text: string } | null;

function ErrorAlert({ error }: { error: ErrorInfo }) {
  const d = describeError(error, CIRC_ERRORS);
  return (
    <Alert
      type="error"
      showIcon
      title={d.text}
      description={
        d.detail || d.details?.length ? (
          <div>
            {d.detail && <div>{d.detail}</div>}
            {d.details?.map((x) => (
              <div key={x}>{x}</div>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}

/**
 * Lập phiếu mượn trên một màn hình: chọn độc giả (kiểm thẻ), quét sách vào giỏ, lập phiếu.
 * Các cờ `can*` là boolean từ server (can()), chỉ ẩn/hiện UI; BE vẫn quyết định.
 */
export function BorrowDesk({
  canSearchUsers,
  canViewReader,
  canScan,
  canIssueCard,
  canRenewCard,
}: {
  canSearchUsers: boolean;
  canViewReader: boolean;
  canScan: boolean;
  canIssueCard: boolean;
  canRenewCard: boolean;
}) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [profile, setProfile] = useState<Profile>({ state: "unchecked" });
  const [uuidInput, setUuidInput] = useState("");
  const [cart, setCart] = useState<CopyDetails[]>([]);
  const [scanStatus, setScanStatus] = useState<Status>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [created, setCreated] = useState<{ borrowing: BorrowingView; items: CopyDetails[]; reader: Reader } | null>(
    null,
  );
  const [resetKey, setResetKey] = useState(0);
  const busy = useRef(false);
  const invalidate = useInvalidateApi();

  const cardOk = profile.state === "unchecked" || (profile.state === "ok" && profile.data.cardValid);
  const canScanNow = !!reader && cardOk && !created;
  const canSubmit = canScanNow && cart.length > 0 && !submitting;
  const lockReason =
    !reader || created || profile.state === "loading"
      ? null
      : profile.state === "none"
        ? "Độc giả chưa có thẻ. Cấp thẻ độc giả trước khi mượn sách."
        : profile.state === "ok" && !profile.data.cardValid
          ? "Thẻ độc giả không hợp lệ (hết hạn hoặc bị khóa). Gia hạn thẻ trước khi mượn sách."
          : profile.state === "error"
            ? "Chưa kiểm tra được thẻ độc giả nên chưa thể nhập sách."
            : null;

  const pickReader = useCallback(
    async (r: Reader | null) => {
      setReader(r);
      setCart([]);
      setScanStatus(null);
      setError(null);
      if (!r || !canViewReader) return setProfile({ state: "unchecked" });
      setProfile({ state: "loading" });
      try {
        const data = await apiFetch<ReaderProfile>(`/api/users/${encodeURIComponent(r.id)}/reader-profile`);
        setProfile({ state: "ok", data });
      } catch (e) {
        const info = toErrorInfo(e);
        setProfile(info.status === 404 ? { state: "none" } : { state: "error", error: info });
      }
    },
    [canViewReader],
  );

  const searchUsers = async (q: string): Promise<Opt[]> => {
    const r = await apiFetch<{ items: UserView[] }>(`/api/users?keyword=${encodeURIComponent(q)}&page=0&size=10`);
    return r.items.map((u) => ({ value: u.id, label: `${u.fullName} · ${u.username} · ${u.email}` }));
  };

  const onScan = async (raw: string) => {
    if (!canScanNow) return;
    let copy: CopyDetails;
    if (canScan) {
      try {
        copy = await apiFetch<CopyDetails>(`/api/book-copies/by-barcode/${encodeURIComponent(raw)}`);
      } catch (e) {
        const info = toErrorInfo(e);
        setScanStatus({
          kind: "warning",
          text:
            info.status === 404
              ? `Không tìm thấy bản sao có mã vạch «${raw}».`
              : describeError(info, CIRC_ERRORS).text,
        });
        return;
      }
    } else {
      // Không có quyền tra mã vạch: chỉ nhập được mã bản sao (UUID), BE kiểm tra khi lập phiếu.
      if (!UUID_RE.test(raw)) {
        setScanStatus({ kind: "warning", text: "Bạn không có quyền tra mã vạch. Hãy nhập mã bản sao (UUID)." });
        return;
      }
      copy = { id: raw, titleId: "", barcode: raw, status: "AVAILABLE" };
    }
    if (cart.some((c) => c.id === copy.id)) {
      setScanStatus({ kind: "warning", text: "Mã này đã có trong phiếu." });
      return;
    }
    const name = copy.titleName ?? copy.barcode;
    if (copy.status === "LOANED" || copy.status === "DAMAGED" || copy.status === "LOST") {
      const why = copy.status === "LOANED" ? "đang cho mượn" : copy.status === "DAMAGED" ? "hư hỏng" : "đã mất";
      setScanStatus({ kind: "warning", text: `Không thêm được: bản sao «${name}» ${why}.` });
      return;
    }
    setCart((c) => [...c, copy]);
    setScanStatus(
      copy.status === "RESERVED"
        ? {
            kind: "warning",
            text: `Đã thêm «${name}», nhưng bản sao đang được giữ chỗ; hệ thống sẽ kiểm tra khi lập phiếu.`,
          }
        : { kind: "success", text: `Đã thêm «${name}».` },
    );
  };

  const submit = useCallback(async () => {
    if (busy.current || !reader || cart.length === 0) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const b = await apiFetch<BorrowingView>("/api/borrowings", {
        method: "POST",
        json: { userId: reader.id, bookCopyIds: cart.map((c) => c.id) },
      });
      setCreated({ borrowing: b, items: cart, reader });
      void invalidate("/api/borrowings", "/api/book-copies");
    } catch (e) {
      setError(toErrorInfo(e));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }, [reader, cart, invalidate]);

  // Ctrl+Enter lập phiếu
  useEffect(() => {
    if (!canSubmit) return;
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [canSubmit, submit]);

  const reset = () => {
    setCreated(null);
    setReader(null);
    setProfile({ state: "unchecked" });
    setCart([]);
    setScanStatus(null);
    setError(null);
    setUuidInput("");
    setResetKey((k) => k + 1);
  };

  if (created) {
    const b = created.borrowing;
    return (
      <Card title="Đã lập phiếu mượn" className="max-w-[720px]" data-testid="borrow-created">
        <div role="status" className="mb-4">
          <Alert type="success" showIcon title={`Đã lập phiếu cho ${created.reader.label}.`} />
        </div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted">Mã phiếu</div>
            <span data-testid="borrowing-id">
              <Text copyable className="font-mono text-base">
                {b.id}
              </Text>
            </span>
            <div className="mt-1 text-sm text-muted">Ngày mượn: {formatDate(b.borrowDate)}</div>
          </div>
          <Statistic title="Hạn trả" value={formatDate(b.dueDate)} />
        </div>
        <div className="mb-4">
          <DataTable
            embedded
            rowKey="id"
            mobileTitleKey="titleName"
            empty={{ title: "Phiếu chưa có sách" }}
            columns={[
              { key: "titleName", title: "Sách", dataIndex: "titleName" },
              { key: "barcode", title: "Mã vạch", dataIndex: "barcode", kind: "mono", width: 200 },
            ]}
            rows={created.items.map((c) => ({ id: c.id, titleName: c.titleName ?? "Bản sao", barcode: c.barcode }))}
          />
        </div>
        <p className="text-sm text-muted">
          Mã phiếu là thông tin cần có để nhận trả sách. Hãy in hoặc ghi lại cho độc giả.
        </p>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button onClick={() => window.print()}>In phiếu</Button>
          <Button type="primary" onClick={reset}>
            Lập phiếu mới
          </Button>
          <LinkButton to={`/circulation/borrowings/${encodeURIComponent(b.id)}`}>Xem phiếu</LinkButton>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      <Card title="1. Độc giả">
        {canSearchUsers ? (
          <div>
            <label htmlFor="reader-select" className="mb-1 block text-sm font-medium text-ink">
              Tìm độc giả theo tên, tên đăng nhập hoặc email
            </label>
            <RemoteSelect
              key={resetKey}
              id="reader-select"
              autoFocus
              fetcher={searchUsers}
              placeholder="Chọn độc giả"
              value={reader ? { value: reader.id, label: reader.label } : undefined}
              onChange={(o) => void pickReader(o ? { id: o.value, label: o.label } : null)}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="reader-uuid" className="mb-1 block text-sm font-medium text-ink">
              Mã người dùng (UUID)
            </label>
            <div className="flex gap-2">
              <Input
                id="reader-uuid"
                value={uuidInput}
                autoComplete="off"
                onChange={(e) => setUuidInput(e.target.value)}
                onPressEnter={() =>
                  UUID_RE.test(uuidInput.trim()) && void pickReader({ id: uuidInput.trim(), label: uuidInput.trim() })
                }
              />
              <Button
                disabled={!UUID_RE.test(uuidInput.trim())}
                onClick={() => void pickReader({ id: uuidInput.trim(), label: uuidInput.trim() })}
              >
                Chọn
              </Button>
            </div>
            <div className="mt-1 text-xs text-muted">
              Bạn không có quyền tìm người dùng nên cần nhập thẳng mã người dùng.
            </div>
          </div>
        )}

        {reader && (
          <div className="mt-4" aria-live="polite">
            {profile.state === "loading" && <Text type="secondary">Đang kiểm tra thẻ độc giả...</Text>}
            {profile.state === "unchecked" && !canViewReader && (
              <Text type="secondary">
                Bạn không có quyền xem hồ sơ độc giả; hệ thống sẽ kiểm tra thẻ khi lập phiếu.
              </Text>
            )}
            {profile.state === "none" && (
              <Alert
                type="warning"
                showIcon
                title="Người này chưa có thẻ độc giả."
                action={
                  canIssueCard ? (
                    <LinkButton size="small" to={`/admin/users/${encodeURIComponent(reader.id)}`}>
                      Cấp thẻ
                    </LinkButton>
                  ) : undefined
                }
              />
            )}
            {profile.state === "error" && <ErrorAlert error={profile.error} />}
            {profile.state === "ok" && (
              <div>
                <div className="mb-3">
                  {profile.data.cardValid ? (
                    <Tag color="success" className="px-3 py-1 text-sm">
                      Thẻ hợp lệ
                    </Tag>
                  ) : (
                    <Tag color="error" className="px-3 py-1 text-sm">
                      Thẻ không hợp lệ
                    </Tag>
                  )}
                </div>
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Họ tên", value: profile.data.fullName },
                    { label: "Số thẻ", value: profile.data.cardNo, mono: true },
                    { label: "Loại độc giả", value: READER_TYPES[profile.data.readerType] ?? profile.data.readerType },
                    { label: "Hạn thẻ", value: formatDate(profile.data.cardExpiryDate) },
                    { label: "Trạng thái", value: <StatusTag domain="reader" value={profile.data.status} /> },
                  ]}
                />
                {!profile.data.cardValid && (
                  <Alert
                    type="error"
                    showIcon
                    className="mt-3"
                    title="Thẻ đã hết hạn hoặc tài khoản bị khóa. Không thể lập phiếu."
                    action={
                      canRenewCard ? (
                        <LinkButton size="small" to={`/admin/users/${encodeURIComponent(reader.id)}`}>
                          Gia hạn thẻ
                        </LinkButton>
                      ) : undefined
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="2. Sách">
        {lockReason && (
          <p className="m-0 mb-2 text-sm text-muted" data-testid="scan-locked-note">
            {lockReason}
          </p>
        )}
        <ScanInput
          key={resetKey}
          label={canScan ? "Quét hoặc nhập mã vạch sách" : "Nhập mã bản sao (UUID)"}
          hint={reader ? "Nhấn Enter để thêm vào phiếu." : "Chọn độc giả ở trên trước, rồi mới quét hoặc nhập mã vạch."}
          autoFocus={canScanNow}
          busy={submitting}
          disabled={!canScanNow}
          onScan={onScan}
          status={
            scanStatus && <Text type={scanStatus.kind === "success" ? "success" : "warning"}>{scanStatus.text}</Text>
          }
        />
        {cart.length === 0 ? (
          <p className="m-0 mt-2 text-sm text-muted">Chưa có sách. Quét mã vạch trên sách để thêm.</p>
        ) : (
          <div className="mt-2">
            <div className="mb-1 text-sm font-medium text-ink">{cart.length} cuốn</div>
            <DataTable
              embedded
              rowKey="id"
              mobileTitleKey="titleName"
              empty={{ title: "Chưa có sách" }}
              columns={[
                { key: "titleName", title: "Sách", dataIndex: "titleName" },
                { key: "barcode", title: "Mã vạch", dataIndex: "barcode", kind: "mono", width: 200 },
                { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "copy", width: 150 },
                actionsColumn((row) => [
                  {
                    key: "remove",
                    label: `Bỏ «${String(row.titleName ?? row.barcode)}» khỏi phiếu`,
                    icon: <X size={16} />,
                    disabled: submitting,
                    onClick: () => setCart((cur) => cur.filter((x) => x.id !== row.id)),
                  },
                ], 1),
              ]}
              rows={cart.map((c) => ({ id: c.id, titleName: c.titleName ?? "Bản sao", barcode: c.barcode, status: c.status }))}
            />
          </div>
        )}
      </Card>

      {error && <ErrorAlert error={error} />}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
        <span className="text-sm text-muted">
          {reader ? `Độc giả ${reader.label} · ${cart.length} cuốn` : "Chưa chọn độc giả"}
        </span>
        <Button type="primary" loading={submitting} disabled={!canSubmit} onClick={() => void submit()}>
          Lập phiếu mượn
        </Button>
      </div>
      <p className="m-0 text-xs text-muted">Phím tắt: Ctrl+Enter để lập phiếu.</p>
    </div>
  );
}
