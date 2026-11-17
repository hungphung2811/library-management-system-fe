import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import type { Opt } from "./RemoteSelect";

/**
 * useFilterParams(schema): trạng thái bộ lọc nằm HOÀN TOÀN trên URL (query string, replace), dùng chung với <FilterBar>.
 *
 * Schema (mảng FilterField) mô tả từng ô lọc; hook đọc giá trị từ URL, `set` ghi lại và luôn xóa `page`
 * (không ở lại trang 5 của kết quả cũ). Giá trị mặc định (rỗng / false / size mặc định) không ghi lên URL.
 *
 * Quy ước URL theo loại field:
 *   text/select/remote  ?name=giá-trị  (remote chỉ lưu id; nhãn do FilterBar tra bằng `resolveLabel`)
 *   multiselect         ?name=A&name=B (khóa lặp)
 *   switch              ?name=true     (hoặc `trueValue`)
 *   dateRange           ?nameFrom=2026-01-01&nameTo=2026-01-31 (yyyy-MM-dd; đổi tên bằng fromParam/toParam)
 *   phân trang          ?page=2 (từ 1), ?size=50 (chỉ khi khác mặc định)
 *
 * Ví dụ:
 *   const SCHEMA: FilterField[] = [
 *     { type: "text", name: "keyword", label: "Từ khóa", placeholder: "Tên, tài khoản hoặc email" },
 *     { type: "select", name: "status", label: "Trạng thái", options: [{ value: "ACTIVE", label: "Hoạt động" }] },
 *   ];
 *   const f = useFilterParams(SCHEMA, { defaultSize: 20 });
 *   // gọi BE: `/api/users?${f.params}&page=${f.page - 1}&size=${f.size}` (params chỉ chứa các lọc đang áp dụng)
 *   <FilterBar filters={f} total={data.total} pageSizes={[10, 20, 50]} />
 */

export type FilterField =
  | { type: "text"; name: string; label: string; placeholder?: string; /** ms, mặc định 300 */ debounce?: number }
  | { type: "select"; name: string; label: string; options: Opt[]; allowClear?: boolean }
  | { type: "multiselect"; name: string; label: string; options: Opt[] }
  | { type: "switch"; name: string; label: string; /** giá trị ghi lên URL khi bật, mặc định "true" */ trueValue?: string }
  | { type: "dateRange"; name: string; label: string; fromParam?: string; toParam?: string }
  | {
      type: "remote";
      name: string;
      label: string;
      fetcher: (q: string) => Promise<Opt[]>;
      /** Tra nhãn từ id khi tải lại trang (URL chỉ có id). Không truyền thì chip hiện id. */
      resolveLabel?: (id: string) => Promise<string>;
      placeholder?: string;
    };

export type DateRangeValue = { from: string; to: string };
export type FilterValue = string | string[] | boolean | DateRangeValue;
export type FilterValues = Record<string, FilterValue>;

export type UseFilterParamsOptions = {
  /** Kích thước trang mặc định khi URL không có `size` (mặc định 20). */
  defaultSize?: number;
  /** Tham số phụ bị xóa mỗi khi đổi lọc, ngoài `page` (ví dụ ["cursor"]). */
  resetKeys?: string[];
};

export type FilterParams = {
  schema: FilterField[];
  /** Giá trị hiện tại theo `name` (text/select/remote: string; multiselect: string[]; switch: boolean; dateRange: {from,to}). */
  values: FilterValues;
  /** Truy cập có kiểu: string ("" khi trống) / string[] / boolean / {from,to}. */
  str: (name: string) => string;
  list: (name: string) => string[];
  bool: (name: string) => boolean;
  range: (name: string) => DateRangeValue;
  /** Chỉ các lọc đang áp dụng, đúng tên tham số gửi BE (dateRange tách thành hai tham số, không có page/size). */
  params: URLSearchParams;
  /** Trang hiện tại, đánh số từ 1. */
  page: number;
  size: number;
  defaultSize: number;
  /** Đặt giá trị một field (rỗng/false/[]/null thì bỏ khỏi URL). Luôn xóa `page`. */
  set: (name: string, value: FilterValue | null) => void;
  setSize: (size: number) => void;
  /** Bỏ mọi bộ lọc (giữ `size`). */
  clear: () => void;
  hasFilter: boolean;
  resetKeys: string[];
};

export const PAGE_PARAM = "page";
export const SIZE_PARAM = "size";
const MAX_SIZE = 200;

export const rangeParams = (f: Extract<FilterField, { type: "dateRange" }>) => ({
  from: f.fromParam ?? `${f.name}From`,
  to: f.toParam ?? `${f.name}To`,
});

function readField(sp: URLSearchParams, f: FilterField): FilterValue {
  switch (f.type) {
    case "multiselect":
      return sp.getAll(f.name).filter(Boolean);
    case "switch":
      return sp.get(f.name) === (f.trueValue ?? "true");
    case "dateRange": {
      const p = rangeParams(f);
      return { from: sp.get(p.from) ?? "", to: sp.get(p.to) ?? "" };
    }
    default:
      return sp.get(f.name) ?? "";
  }
}

export function isEmptyValue(v: FilterValue | undefined | null): boolean {
  if (v == null || v === false || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return !v.from && !v.to;
  return false;
}

function writeField(q: URLSearchParams, f: FilterField, v: FilterValue | null) {
  if (f.type === "dateRange") {
    const p = rangeParams(f);
    q.delete(p.from);
    q.delete(p.to);
    const r = v && typeof v === "object" && !Array.isArray(v) ? v : { from: "", to: "" };
    if (r.from) q.set(p.from, r.from);
    if (r.to) q.set(p.to, r.to);
    return;
  }
  q.delete(f.name);
  if (isEmptyValue(v)) return;
  if (f.type === "multiselect") for (const x of v as string[]) q.append(f.name, x);
  else if (f.type === "switch") q.set(f.name, f.trueValue ?? "true");
  else q.set(f.name, typeof v === "string" ? v.trim() : String(v));
}

export function useFilterParams(schema: FilterField[], options: UseFilterParamsOptions = {}): FilterParams {
  const [sp, setSp] = useSearchParams();
  const defaultSize = options.defaultSize ?? 20;
  const resetKeys = useMemo(() => [PAGE_PARAM, ...(options.resetKeys ?? [])], [options.resetKeys]);

  const spKey = sp.toString();
  const derived = useMemo(() => {
    const values: FilterValues = {};
    const params = new URLSearchParams();
    for (const f of schema) {
      const v = readField(sp, f);
      values[f.name] = v;
      if (f.type === "dateRange") {
        const p = rangeParams(f);
        const r = v as DateRangeValue;
        if (r.from) params.set(p.from, r.from);
        if (r.to) params.set(p.to, r.to);
      } else if (f.type === "multiselect") for (const x of v as string[]) params.append(f.name, x);
      else if (f.type === "switch") {
        if (v) params.set(f.name, f.trueValue ?? "true");
      } else if (v !== "") params.set(f.name, v as string);
    }
    const hasFilter = schema.some((f) => !isEmptyValue(values[f.name]));
    return { values, params, hasFilter };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey, schema]);

  const page = (() => {
    const n = Number.parseInt(sp.get(PAGE_PARAM) ?? "", 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  })();
  const size = (() => {
    const n = Number.parseInt(sp.get(SIZE_PARAM) ?? "", 10);
    return Number.isFinite(n) && n >= 1 && n <= MAX_SIZE ? n : defaultSize;
  })();

  // Hai thao tác liên tiếp trước khi React render lại (ví dụ chọn xong rồi bấm ngay ô khác) phải cộng dồn, không ghi đè:
  // `pending` giữ query vừa đẩy đi cho tới khi URL render ra đúng giá trị đó.
  const pending = useRef<string | null>(null);
  // Xóa trong effect (sau commit), không xóa lúc render: render có thể bị hủy trong khi handler cũ vẫn đang gắn.
  useEffect(() => {
    if (pending.current === spKey) pending.current = null;
  }, [spKey]);
  const commit = useCallback(
    (mutate: (q: URLSearchParams) => void) => {
      const q = new URLSearchParams(pending.current ?? spKey);
      mutate(q);
      for (const k of resetKeys) q.delete(k);
      pending.current = q.toString();
      setSp(q, { replace: true });
    },
    [spKey, setSp, resetKeys],
  );

  const set = useCallback(
    (name: string, value: FilterValue | null) => {
      const f = schema.find((x) => x.name === name);
      if (f) commit((q) => writeField(q, f, value));
    },
    [schema, commit],
  );

  const setSize = useCallback(
    (n: number) =>
      commit((q) => {
        if (n === defaultSize) q.delete(SIZE_PARAM);
        else q.set(SIZE_PARAM, String(n));
      }),
    [commit, defaultSize],
  );

  const clear = useCallback(
    () =>
      commit((q) => {
        for (const f of schema) writeField(q, f, null);
      }),
    [schema, commit],
  );

  const { values } = derived;
  return {
    schema,
    values,
    str: (n) => (typeof values[n] === "string" ? (values[n] as string) : ""),
    list: (n) => (Array.isArray(values[n]) ? (values[n] as string[]) : []),
    bool: (n) => values[n] === true,
    range: (n) => {
      const v = values[n];
      return v && typeof v === "object" && !Array.isArray(v) ? v : { from: "", to: "" };
    },
    params: derived.params,
    page,
    size,
    defaultSize,
    set,
    setSize,
    clear,
    hasFilter: derived.hasFilter,
    resetKeys,
  };
}
