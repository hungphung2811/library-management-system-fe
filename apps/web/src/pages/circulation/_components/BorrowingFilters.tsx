import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { apiFetch } from "@/api";
import { Button, FilterBar, Input, Segmented, useFilterParams, type FilterField, type FilterParams } from "@/ui";
import { UUID_RE, shortId, userLabel, type BorrowingFilter, type UserBrief } from "../_lib/circulation";

export const BORROWING_PAGE_SIZES = [10, 20, 50];

const STATUS_OPTIONS: { label: string; value: BorrowingFilter | "" }[] = [
  { label: "Tất cả", value: "" },
  { label: "Đang mượn", value: "ACTIVE" },
  { label: "Quá hạn", value: "OVERDUE" },
  { label: "Đã trả hết", value: "RETURNED" },
];

const searchReaders = async (q: string) => {
  const r = await apiFetch<{ items: UserBrief[] }>(`/api/users?keyword=${encodeURIComponent(q)}&page=0&size=10`);
  return r.items.map((u) => ({ value: u.id, label: userLabel(u) }));
};
// Không xem được hồ sơ người dùng thì chip hiện mã rút gọn.
const readerLabel = async (id: string) => {
  try {
    return userLabel(await apiFetch<UserBrief>(`/api/users/${encodeURIComponent(id)}`));
  } catch {
    return shortId(id);
  }
};

/** Ô tra phiếu theo mã (UUID) nằm trong thanh lọc: Enter hoặc "Xem phiếu" chuyển tới trang chi tiết phiếu. */
function CodeLookup() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const id = code.trim();
  const valid = UUID_RE.test(id);
  const go = () => valid && void navigate(`/circulation/borrowings/${encodeURIComponent(id)}`);
  return (
    <div className="flex min-w-0 flex-1 basis-full flex-col sm:basis-auto sm:flex-none">
      <div className="flex gap-1">
        <Input
          aria-label="Mã phiếu mượn (UUID)"
          placeholder="Tra theo mã phiếu (UUID)"
          className="sm:w-72"
          autoComplete="off"
          spellCheck={false}
          allowClear
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onPressEnter={go}
        />
        <Button disabled={!valid} onClick={go}>
          Xem phiếu
        </Button>
      </div>
      {id && !valid && <div className="mt-1 text-xs text-red-600">Mã phiếu phải có dạng UUID.</div>}
    </div>
  );
}

/**
 * Thanh lọc của danh sách phiếu mượn (dùng FilterBar chung, mọi lọc nằm trên URL): trạng thái (Segmented), độc giả
 * (readerId, tìm từ xa nếu có quyền tìm người dùng), số dòng mỗi trang, đếm kết quả, chip, "Xóa bộ lọc" và ô tra mã phiếu.
 * Trả về `filters` để trang dựng truy vấn.
 */
export function useBorrowingFilters(canSearchUsers: boolean) {
  const schema = useMemo<FilterField[]>(
    () =>
      canSearchUsers
        ? [{ type: "remote", name: "readerId", label: "Độc giả", placeholder: "Tìm độc giả (tên, tài khoản, email)", fetcher: searchReaders, resolveLabel: readerLabel }]
        : [{ type: "text", name: "readerId", label: "Mã độc giả", placeholder: "Mã độc giả (UUID)" }],
    [canSearchUsers],
  );
  const f = useFilterParams(schema, { defaultSize: 20 });
  const [sp, setSp] = useSearchParams();
  const raw = sp.get("status") ?? "";
  const status: BorrowingFilter | "" = raw === "ACTIVE" || raw === "OVERDUE" || raw === "RETURNED" ? raw : "";
  const readerId = UUID_RE.test(f.str("readerId")) ? f.str("readerId") : "";

  const setStatus = (v: string) =>
    setSp(
      (prev) => {
        const q = new URLSearchParams(prev);
        if (v) q.set("status", v);
        else q.delete("status");
        q.delete("page");
        return q;
      },
      { replace: true },
    );

  // Bộ lọc gộp: trạng thái cũng được tính vào hasFilter và bị xóa bởi "Xóa bộ lọc".
  const merged: FilterParams = {
    ...f,
    hasFilter: f.hasFilter || status !== "",
    clear: () => {
      f.clear();
      setSp(
        (prev) => {
          const q = new URLSearchParams(prev);
          q.delete("status");
          q.delete("readerId");
          q.delete("page");
          return q;
        },
        { replace: true },
      );
    },
  };
  return { filters: merged, status, readerId, setStatus };
}

export function BorrowingFilters({
  filters,
  status,
  setStatus,
  total,
}: {
  filters: FilterParams;
  status: BorrowingFilter | "";
  setStatus: (v: string) => void;
  total?: number;
}) {
  return (
    <FilterBar
      filters={filters}
      total={total}
      unit="phiếu"
      pageSizes={BORROWING_PAGE_SIZES}
      extra={
        <>
          <Segmented
            aria-label="Lọc theo trạng thái phiếu mượn"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(String(v))}
          />
          <CodeLookup />
        </>
      }
    />
  );
}
