import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiKey, toErrorInfo, useSession } from "@/api";
import { Alert, Button, Empty, Input, Pagination, Select, Spin, Switch, Tag, describeError, formatMoney } from "@/ui";
import type { Page, StockItem } from "../_lib/sales";

/** Request danh sách mặt hàng cố định: trang đầu (chỉ số 0), 30 dòng. */
const PAGE_INDEX = 0;
const PAGE_SIZE = 30;
const VIEW_SIZE = 8;

type Sort = "name" | "priceAsc" | "priceDesc" | "stockDesc";

const SORTS: { value: Sort; label: string }[] = [
  { value: "name", label: "Tên A → Z" },
  { value: "priceAsc", label: "Giá tăng dần" },
  { value: "priceDesc", label: "Giá giảm dần" },
  { value: "stockDesc", label: "Tồn nhiều nhất" },
];

/** Một request duy nhất: PAGE_INDEX = 0, PAGE_SIZE = 30. `truncated` khi còn mặt hàng ngoài 30 dòng này. */
async function loadAll(signal?: AbortSignal): Promise<{ items: StockItem[]; truncated: boolean }> {
  const p = await apiFetch<Page<StockItem>>(`/api/sales/stock-items?page=${PAGE_INDEX}&size=${PAGE_SIZE}`, { signal });
  return { items: p.items, truncated: p.total > p.items.length };
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();

const distinct = (xs: (string | null | undefined)[]) =>
  [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "vi"));

/**
 * Danh sách chọn sách của POS: lọc theo từ khóa (tên/SKU, không phân biệt dấu), mặc định chỉ hiện mặt hàng còn tồn,
 * thêm bộ lọc sắp hết, vị trí kệ, nhà cung cấp, khoảng giá và sắp xếp. Bấm "Thêm" để đưa vào giỏ.
 */
export function PosCatalog({ onPick, disabled }: { onPick: (item: StockItem) => Promise<void> | void; disabled?: boolean }) {
  const tenantId = useSession().tenantId;
  const q = useQuery({
    queryKey: apiKey(tenantId, "/api/sales/stock-items?pos-catalog"),
    queryFn: ({ signal }) => loadAll(signal),
    staleTime: 30_000,
  });

  const [keyword, setKeyword] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);
  const [bin, setBin] = useState<string | undefined>();
  const [supplier, setSupplier] = useState<string | undefined>();
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = q.data?.items ?? [];
  const bins = useMemo(() => distinct(all.map((i) => i.binLocation)), [all]);
  const suppliers = useMemo(() => distinct(all.map((i) => i.supplier)), [all]);

  const rows = useMemo(() => {
    const kw = norm(keyword.trim());
    const out = all.filter((i) => {
      // Chỉ loại khi BE nói rõ ngừng bán: bản BE cũ không trả trường `active` (undefined vẫn là đang bán).
      if (i.active === false) return false;
      if (inStockOnly && i.available <= 0) return false;
      if (lowOnly && !i.lowStock) return false;
      if (bin && i.binLocation !== bin) return false;
      if (supplier && i.supplier !== supplier) return false;
      const price = i.effectivePrice;
      if (minPrice != null && (price == null || price < minPrice)) return false;
      if (maxPrice != null && (price == null || price > maxPrice)) return false;
      if (kw && !norm(`${i.titleName ?? ""} ${i.sku ?? ""}`).includes(kw)) return false;
      return true;
    });
    const byName = (a: StockItem, b: StockItem) => (a.titleName ?? "").localeCompare(b.titleName ?? "", "vi");
    const price = (i: StockItem, empty: number) => i.effectivePrice ?? empty;
    return out.sort((a, b) => {
      if (sort === "priceAsc") return price(a, Infinity) - price(b, Infinity) || byName(a, b);
      if (sort === "priceDesc") return price(b, -1) - price(a, -1) || byName(a, b);
      if (sort === "stockDesc") return b.available - a.available || byName(a, b);
      return byName(a, b);
    });
  }, [all, keyword, inStockOnly, lowOnly, bin, supplier, minPrice, maxPrice, sort]);

  const filtered = keyword.trim() !== "" || !inStockOnly || lowOnly || !!bin || !!supplier || minPrice != null || maxPrice != null;
  const reset = () => {
    setKeyword("");
    setInStockOnly(true);
    setLowOnly(false);
    setBin(undefined);
    setSupplier(undefined);
    setMinPrice(null);
    setMaxPrice(null);
    setSort("name");
    setPage(1);
  };
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const shown = rows.slice((page - 1) * VIEW_SIZE, page * VIEW_SIZE);

  const pick = async (i: StockItem) => {
    setBusyId(i.titleId);
    try {
      await onPick(i);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="pos-catalog">
      <div>
        <label htmlFor="pos-catalog-search" className="mb-1 block text-sm font-medium text-ink">
          Tìm theo tên hoặc SKU
        </label>
        <Input
          id="pos-catalog-search"
          allowClear
          placeholder="Gõ tên sách hoặc SKU (không cần dấu)"
          value={keyword}
          onChange={(e) => touch(setKeyword)(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch size="small" checked={inStockOnly} onChange={touch(setInStockOnly)} aria-label="Chỉ hiện sách còn hàng" />
          Chỉ còn hàng
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch size="small" checked={lowOnly} onChange={touch(setLowOnly)} aria-label="Chỉ hiện sách sắp hết" />
          Sắp hết
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          allowClear
          placeholder="Vị trí kệ"
          aria-label="Lọc theo vị trí kệ"
          value={bin}
          onChange={touch(setBin)}
          options={bins.map((b) => ({ value: b, label: b }))}
          disabled={bins.length === 0}
        />
        <Select
          allowClear
          placeholder="Nhà cung cấp"
          aria-label="Lọc theo nhà cung cấp"
          value={supplier}
          onChange={touch(setSupplier)}
          options={suppliers.map((s) => ({ value: s, label: s }))}
          disabled={suppliers.length === 0}
        />
        <Input
          inputMode="numeric"
          placeholder="Giá từ (₫)"
          aria-label="Giá từ"
          value={minPrice ?? ""}
          onChange={(e) => touch(setMinPrice)(e.target.value.trim() === "" || Number.isNaN(Number(e.target.value)) ? null : Number(e.target.value))}
        />
        <Input
          inputMode="numeric"
          placeholder="Giá đến (₫)"
          aria-label="Giá đến"
          value={maxPrice ?? ""}
          onChange={(e) => touch(setMaxPrice)(e.target.value.trim() === "" || Number.isNaN(Number(e.target.value)) ? null : Number(e.target.value))}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Select<Sort> className="min-w-40" aria-label="Sắp xếp" value={sort} onChange={touch(setSort)} options={SORTS} />
        {filtered && (
          <Button size="small" type="link" onClick={reset}>
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {q.isError ? (
        <Alert type="error" showIcon title={describeError(toErrorInfo(q.error)).text} />
      ) : q.isPending ? (
        <div className="flex justify-center py-6">
          <Spin />
        </div>
      ) : (
        <>
          {q.data?.truncated && (
            <Alert type="warning" showIcon title={`Chỉ tải ${PAGE_SIZE} mặt hàng đầu; dùng ô quét ISBN ở trên để thêm sách khác.`} />
          )}
          <div className="text-xs text-muted" aria-live="polite" data-testid="pos-catalog-count">
            {rows.length} / {all.length} mặt hàng
          </div>
          {rows.length === 0 ? (
            <Empty description={inStockOnly ? "Không có sách còn hàng khớp bộ lọc" : "Không có sách khớp bộ lọc"} />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Sách có thể bán">
              {shown.map((i) => {
                const sellable = i.effectivePrice != null && i.available > 0;
                return (
                  <li key={i.titleId} className="flex items-center justify-between gap-2 rounded-card border border-line p-2.5" data-testid="pos-catalog-item">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink" title={i.titleName ?? undefined}>
                        {i.titleName ?? i.titleId}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{i.effectivePrice == null ? "Chưa có giá" : formatMoney(i.effectivePrice)}</span>
                        <span>· còn {i.available}</span>
                        {i.sku && <span className="font-mono">· {i.sku}</span>}
                        {i.binLocation && <span>· kệ {i.binLocation}</span>}
                        {i.available <= 0 ? <Tag color="red">Hết hàng</Tag> : i.lowStock ? <Tag color="orange">Sắp hết</Tag> : null}
                      </div>
                    </div>
                    <Button size="small" type="primary" disabled={!sellable || disabled} loading={busyId === i.titleId} aria-label={`Thêm ${i.titleName ?? i.titleId}`} onClick={() => void pick(i)}>
                      Thêm
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {rows.length > VIEW_SIZE && (
            <Pagination size="small" align="center" current={page} pageSize={VIEW_SIZE} total={rows.length} showSizeChanger={false} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

type TitleCand = { id: string; name: string; isbn?: string | null };

/**
 * Dành cho tài khoản không có khóa liệt kê tồn: ô tìm theo tên là input thường, gõ là ra danh sách ngay (chờ 300 ms),
 * không dùng control select. Dữ liệu từ `find` (tra sách qua catalog).
 */
export function TitleSearchList({ find, onPick }: { find: (keyword: string) => Promise<TitleCand[]>; onPick: (c: TitleCand) => Promise<void> | void }) {
  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);
  const q = useQuery({
    queryKey: ["pos-title-search", debounced],
    queryFn: async () => (await find(debounced)).slice(0, 20),
    // Vào trang là tìm luôn với từ khóa rỗng (danh sách mặc định theo request sẵn có), gõ thì lọc tiếp.
    staleTime: 15_000,
  });
  return (
    <div className="flex flex-col gap-3" data-testid="pos-title-search">
      <div>
        <label htmlFor="pos-title-search-input" className="mb-1 block text-sm font-medium text-ink">
          Tìm theo tên sách
        </label>
        <Input id="pos-title-search-input" allowClear placeholder="Gõ tên sách" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>
      {q.isFetching && <Spin size="small" />}
      {!q.isFetching && q.data?.length === 0 && <Empty description="Không tìm thấy sách" />}
      {q.data && q.data.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Kết quả tìm sách">
          {q.data.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-card border border-line p-2.5">
              <div className="min-w-0 truncate">
                <span className="font-medium text-ink">{c.name}</span>
                {c.isbn && <span className="ml-2 font-mono text-xs text-muted">{c.isbn}</span>}
              </div>
              <Button size="small" type="primary" aria-label={`Thêm ${c.name}`} onClick={() => void onPick(c)}>
                Thêm
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
