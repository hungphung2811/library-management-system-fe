"use client";
import { useState } from "react";
import { ApiCallError, bffFetch } from "@mfe/api/client";
import { Alert, Button, Card, KeyValueList, ScanInput, StatusTag, formatMoney } from "@mfe/ui";
import type { CopyDetailsView } from "../types";
import { CopyStatusActions } from "./CopyStatusActions";

const MAX_RECENT = 5;

/** Tra bản sao theo mã vạch; sau mỗi lần quét focus về ô để quét tiếp. Giữ 5 kết quả gần nhất trong state. */
export function BarcodeLookup({ canChange }: { canChange: boolean }) {
  const [current, setCurrent] = useState<CopyDetailsView | null>(null);
  const [recent, setRecent] = useState<CopyDetailsView[]>([]);
  const [notFound, setNotFound] = useState<string | null>(null);

  const remember = (c: CopyDetailsView) =>
    setRecent((r) => [c, ...r.filter((x) => x.id !== c.id)].slice(0, MAX_RECENT));

  const onScan = async (code: string) => {
    setNotFound(null);
    try {
      const c = await bffFetch<CopyDetailsView>(`/api/book-copies/by-barcode/${encodeURIComponent(code)}`);
      setCurrent(c);
      remember(c);
    } catch (e) {
      if (e instanceof ApiCallError && e.status === 404) {
        setCurrent(null);
        setNotFound(code);
        return;
      }
      throw e; // ScanInput hiện câu lỗi theo bảng lỗi chung
    }
  };

  const onChanged = ({ id, status }: { id: string; status: string }) => {
    setCurrent((c) => (c && c.id === id ? { ...c, status } : c));
    setRecent((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <ScanInput
          autoFocus
          label="Quét hoặc nhập mã vạch"
          hint="Nhấn Enter để tra."
          maxLength={64}
          status={
            notFound ? (
              <Alert type="warning" showIcon title={`Không tìm thấy bản sao có mã vạch «${notFound}».`} />
            ) : undefined
          }
          onScan={onScan}
        />
      </Card>

      {current && (
        <Card
          title="Kết quả"
          extra={
            <Button onClick={() => setCurrent(null)}>Tra tiếp</Button>
          }
        >
          <KeyValueList
            items={[
              { label: "Tên sách", value: <a href={`/catalog/books/${encodeURIComponent(current.titleId)}`}>{current.titleName ?? "Xem sách"}</a> },
              { label: "Mã vạch", value: current.barcode, mono: true },
              { label: "Trạng thái", value: <StatusTag domain="copy" value={current.status} /> },
              { label: "Giá bìa", value: formatMoney(current.coverPrice) },
            ]}
          />
          {canChange && (
            <div className="mt-2">
              <CopyStatusActions copy={current} onChanged={onChanged} />
            </div>
          )}
        </Card>
      )}

      {recent.length > 0 && (
        <Card title="Vừa tra" size="small">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {recent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-mono">{c.barcode}</span> · {c.titleName ?? "—"}
                </span>
                <StatusTag domain="copy" value={c.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
