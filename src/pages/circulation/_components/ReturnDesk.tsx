import { useRef, useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import { Alert, Button, Card, ConfirmAction, Input, LinkButton, ScanInput, Segmented, describeError } from "@/ui";
import {
  CIRC_ERRORS,
  COPY_CONDITIONS,
  UUID_RE,
  shortId,
  type BorrowingView,
  type CopyDetails,
  type CopyInfo,
} from "../_lib/circulation";
import { BorrowingPanel } from "./BorrowingPanel";
import { NewFinesAlert } from "./NewFinesAlert";

type Outcome = { kind: "returned" | "lost"; code: string; condition?: string; b: BorrowingView };

/** Trả/báo mất theo mã vạch bản sao (không cần mã phiếu): chọn tình trạng Tốt/Hỏng; hỏng và mất sẽ phát sinh phạt. */
function BarcodeDesk({ canReturnCopy, canReportLost }: { canReturnCopy: boolean; canReportLost: boolean }) {
  const invalidate = useInvalidateApi();
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED">("GOOD");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [lostCode, setLostCode] = useState("");
  const [lostError, setLostError] = useState<ErrorInfo | null>(null);

  const returnCopy = async (barcode: string) => {
    const b = await apiFetch<BorrowingView>("/api/borrowings/returns", { method: "POST", json: { barcode, condition } });
    setOutcome({ kind: "returned", code: barcode, condition, b });
    void invalidate("/api/borrowings", "/api/fines");
  };

  const reportLost = async () => {
    const barcode = lostCode.trim();
    setLostError(null);
    try {
      const b = await apiFetch<BorrowingView>("/api/borrowings/losses", { method: "POST", json: { barcode } });
      setOutcome({ kind: "lost", code: barcode, b });
      setLostCode("");
      void invalidate("/api/borrowings", "/api/fines");
    } catch (e) {
      setLostError(toErrorInfo(e));
    }
  };

  return (
    <>
      {canReturnCopy && (
        <Card title="Trả theo mã vạch">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-ink">Tình trạng sách khi trả</span>
            <Segmented
              aria-label="Tình trạng sách khi trả"
              value={condition}
              onChange={(v) => setCondition(v as "GOOD" | "DAMAGED")}
              options={[
                { label: COPY_CONDITIONS.GOOD, value: "GOOD" },
                { label: COPY_CONDITIONS.DAMAGED, value: "DAMAGED" },
              ]}
            />
          </div>
          <ScanInput
            label="Mã vạch sách cần trả (không cần mã phiếu)"
            hint="Nhấn Enter để nhận trả. Chọn Hỏng thì hệ thống lập khoản phạt hư hỏng."
            maxLength={64}
            onScan={returnCopy}
          />
        </Card>
      )}
      {canReportLost && (
        <Card title="Báo mất sách">
          <label htmlFor="lost-barcode" className="mb-1 block text-sm font-medium text-ink">
            Mã vạch sách bị mất
          </label>
          <div className="flex gap-2">
            <Input
              id="lost-barcode"
              autoComplete="off"
              spellCheck={false}
              value={lostCode}
              onChange={(e) => setLostCode(e.target.value)}
            />
            <ConfirmAction
              title={`Báo mất sách «${lostCode.trim()}»?`}
              description="Hệ thống sẽ lập khoản phạt mất sách cho độc giả đang mượn. Không hoàn tác được."
              okText="Xác nhận báo mất"
              danger
              onConfirm={reportLost}
            >
              <Button danger disabled={!lostCode.trim()}>
                Báo mất
              </Button>
            </ConfirmAction>
          </div>
          {lostError && (
            <Alert
              className="mt-3"
              type="error"
              showIcon
              title={
                lostError.status === 404
                  ? "Không tìm thấy bản sao hoặc phiếu mượn đang mở."
                  : describeError(lostError, CIRC_ERRORS).text
              }
            />
          )}
        </Card>
      )}
      {outcome && (
        <div className="flex flex-col gap-3" data-testid="barcode-outcome">
          <Alert
            type={outcome.kind === "lost" || outcome.condition === "DAMAGED" ? "warning" : "success"}
            showIcon
            title={
              outcome.kind === "lost"
                ? `Đã ghi nhận mất sách «${outcome.code}».`
                : `Đã nhận trả sách «${outcome.code}» (${COPY_CONDITIONS[outcome.condition ?? "GOOD"]}).`
            }
            description={
              <span>
                Phiếu <span className="font-mono">{shortId(outcome.b.id)}</span>{" "}
                ({outcome.b.status === "RETURNED" ? "đã trả hết" : "còn sách chưa trả"}){" "}
                <LinkButton size="small" type="link" to={`/circulation/borrowings/${outcome.b.id}`}>
                  Xem phiếu
                </LinkButton>
              </span>
            }
          />
          <NewFinesAlert fines={outcome.b.fines ?? []} readerId={outcome.b.userId} />
        </div>
      )}
    </>
  );
}

/** Nhận trả sách: trả/báo mất theo mã vạch, hoặc nhập mã phiếu (dán từ phiếu in) rồi quét/bấm "Trả" từng dòng. */
export function ReturnDesk({
  canReturn,
  canReturnCopy = false,
  canReportLost = false,
  canRenew,
  canScan,
  canViewCopy,
}: {
  canReturn: boolean;
  canReturnCopy?: boolean;
  canReportLost?: boolean;
  canRenew: boolean;
  canScan: boolean;
  canViewCopy: boolean;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [loaded, setLoaded] = useState<{ b: BorrowingView; copies: Record<string, CopyInfo> } | null>(null);
  const busy = useRef(false);
  const session = useSession();
  // Nhân viên (khóa getAny) tra phiếu bất kỳ qua /detail; người khác chỉ tra được phiếu của chính mình qua /{id}.
  const staff = can(session, PERMISSIONS.BORROWING_GET_ANY);

  const valid = UUID_RE.test(code.trim());

  const load = async () => {
    const id = code.trim();
    if (!UUID_RE.test(id) || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const b = await apiFetch<BorrowingView>(`/api/borrowings/${encodeURIComponent(id)}${staff ? "/detail" : ""}`);
      const copies: Record<string, CopyInfo> = {};
      if (canViewCopy) {
        const r = await Promise.allSettled(
          b.items.map((i) => apiFetch<CopyDetails>(`/api/book-copies/${encodeURIComponent(i.bookCopyId)}`)),
        );
        r.forEach((x, idx) => {
          if (x.status === "fulfilled") copies[b.items[idx].bookCopyId] = { titleName: x.value.titleName, barcode: x.value.barcode };
        });
      }
      setLoaded({ b, copies });
    } catch (e) {
      setLoaded(null);
      setError(toErrorInfo(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="flex max-w-[960px] flex-col gap-5">
      <BarcodeDesk canReturnCopy={canReturnCopy} canReportLost={canReportLost} />

      {canReturn && (
        <Card title="Trả theo mã phiếu mượn">
          <label htmlFor="borrowing-code" className="mb-1 block text-sm font-medium text-ink">
            Mã phiếu mượn (UUID, dán từ phiếu in)
          </label>
          <div className="flex gap-2">
            <Input
              id="borrowing-code"
              autoFocus={!canReturnCopy}
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPressEnter={() => void load()}
            />
            <Button type="primary" loading={loading} disabled={!valid} onClick={() => void load()}>
              Tải phiếu
            </Button>
          </div>
          {code.trim() && !valid && <div className="mt-1 text-xs text-red-600">Mã phiếu phải có dạng UUID.</div>}
        </Card>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          title={error.status === 404 ? "Không tìm thấy phiếu mượn." : describeError(error, CIRC_ERRORS).text}
        />
      )}

      {loaded && (
        <BorrowingPanel
          key={loaded.b.id}
          initial={loaded.b}
          copies={loaded.copies}
          canReturn={canReturn}
          canRenew={canRenew}
          canScan={canScan}
          canReportLost={canReportLost}
          withScan
        />
      )}
    </div>
  );
}
