"use client";
import { useRef, useState } from "react";
import { bffFetch, toErrorInfo, type ErrorInfo } from "@mfe/api/client";
import { Alert, Button, Card, Input, describeError } from "@mfe/ui";
import { CIRC_ERRORS, UUID_RE, type BorrowingView, type CopyDetails, type CopyInfo } from "../_lib/circulation";
import { BorrowingPanel } from "./BorrowingPanel";

/** Nhận trả sách: nhập mã phiếu (dán từ phiếu in), xem phiếu rồi quét mã vạch hoặc bấm "Trả" từng dòng. */
export function ReturnDesk({
  canReturn,
  canRenew,
  canScan,
  canViewCopy,
}: {
  canReturn: boolean;
  canRenew: boolean;
  canScan: boolean;
  canViewCopy: boolean;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [loaded, setLoaded] = useState<{ b: BorrowingView; copies: Record<string, CopyInfo> } | null>(null);
  const busy = useRef(false);

  const valid = UUID_RE.test(code.trim());

  const load = async () => {
    const id = code.trim();
    if (!UUID_RE.test(id) || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const b = await bffFetch<BorrowingView>(`/api/borrowings/${encodeURIComponent(id)}`);
      const copies: Record<string, CopyInfo> = {};
      if (canViewCopy) {
        const r = await Promise.allSettled(
          b.items.map((i) => bffFetch<CopyDetails>(`/api/book-copies/${encodeURIComponent(i.bookCopyId)}`)),
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
      <Card title="1. Mã phiếu mượn">
        <label htmlFor="borrowing-code" className="mb-1 block text-sm font-medium text-ink">
          Mã phiếu mượn (UUID, dán từ phiếu in)
        </label>
        <div className="flex gap-2">
          <Input
            id="borrowing-code"
            autoFocus
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
        <p className="m-0 mt-2 text-xs text-muted">
          Trả sách theo mã vạch (không cần mã phiếu) và báo hư hỏng khi trả đang chờ hệ thống hỗ trợ.
        </p>
      </Card>

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
          withScan
        />
      )}
    </div>
  );
}
