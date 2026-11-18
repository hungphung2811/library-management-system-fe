import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Button, Input, Select, Text } from "@/ui";
import { AvailableToggle } from "./AvailableToggle";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, SORTS, parseSize, parseSort } from "./catalog-filters";

/** Cập nhật một số tham số URL, luôn bỏ `page` (đổi bộ lọc thì về trang 1). Chuỗi rỗng/null = xóa tham số. */
function useSetParams() {
  const [sp, setSp] = useSearchParams();
  return (changes: Record<string, string | null>, keepPage = false) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    if (!keepPage) q.delete("page");
    setSp(q, { replace: true });
  };
}

/** Ô ISBN (debounce 300ms) đẩy `isbn` lên URL. Đồng bộ lại khi URL đổi từ ngoài (nút Xóa bộ lọc). */
function IsbnInput() {
  const [sp] = useSearchParams();
  const set = useSetParams();
  const url = sp.get("isbn") ?? "";
  const [value, setValue] = useState(url);
  const pushed = useRef(url);

  useEffect(() => {
    if (url !== pushed.current) {
      pushed.current = url;
      setValue(url);
    }
  }, [url]);

  useEffect(() => {
    const id = setTimeout(() => {
      const t = value.trim();
      if (t === pushed.current) return;
      pushed.current = t;
      set({ isbn: t });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      aria-label="Lọc theo ISBN"
      className="w-44"
      placeholder="ISBN"
      allowClear
      autoComplete="off"
      maxLength={20}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

type RefOption = { id: string; name: string };

/** Lọc theo một danh mục chuẩn (tải `/options`, tối đa 200 mục). Không có quyền `options` thì không hiện ô. */
function RefFilter({ path, param, permission, label }: { path: "/api/categories" | "/api/publishers"; param: string; permission: string; label: string }) {
  const s = useSession();
  const [sp] = useSearchParams();
  const set = useSetParams();
  const allowed = can(s, permission);
  const q = useApi<RefOption[]>(allowed ? `${path}/options` : null);
  if (!allowed) return null;
  const current = sp.get(param) ?? undefined;
  const options = (q.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  return (
    <Select
      aria-label={`Lọc theo ${label.toLowerCase()}`}
      className="w-44"
      allowClear
      showSearch={{ optionFilterProp: "label" }}
      loading={q.isPending}
      placeholder={label}
      value={current}
      options={options}
      onChange={(v) => set({ [param]: v ?? null })}
    />
  );
}

/** Hàng điều khiển: ISBN, thể loại, NXB, còn bản, sắp xếp, cỡ trang. Từ khóa nằm ở SearchBar (cùng hàng qua `extra`). */
export function CatalogControls({ available }: { available: boolean }) {
  const [sp] = useSearchParams();
  const set = useSetParams();
  return (
    <>
      <IsbnInput />
      <RefFilter path="/api/categories" param="categoryId" permission={PERMISSIONS.CATEGORY_OPTIONS} label="Thể loại" />
      <RefFilter path="/api/publishers" param="publisherId" permission={PERMISSIONS.PUBLISHER_OPTIONS} label="Nhà xuất bản" />
      <AvailableToggle checked={available} />
      <Select
        aria-label="Sắp xếp"
        className="w-48"
        value={parseSort(sp.get("sort"))}
        options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        onChange={(v) => set({ sort: v === "name" ? null : v })}
      />
    </>
  );
}

/** Hàng "Đang lọc": đếm kết quả và nút Xóa bộ lọc luôn hiện (giá trị lọc đã hiện trong ô lọc, không lặp lại bằng chip). */
export function ActiveFilters({ total, q, isbn, available }: { total: number; q: string; isbn: string; available: boolean }) {
  const [sp, setSp] = useSearchParams();
  const set = useSetParams();
  const active = !!q || !!isbn || available || !!sp.get("categoryId") || !!sp.get("publisherId");
  const clear = () => {
    const keep = new URLSearchParams();
    for (const k of ["sort", "size"]) if (sp.get(k)) keep.set(k, sp.get(k)!);
    setSp(keep, { replace: true });
  };
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Bộ lọc đang áp dụng">
      <Text strong data-testid="result-count">
        {total} đầu sách
      </Text>
      <Button size="small" type="link" disabled={!active} onClick={clear}>
        Xóa bộ lọc
      </Button>
    </div>
  );
}
