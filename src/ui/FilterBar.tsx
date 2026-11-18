import { useEffect, useRef, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { Button, DatePicker, Input, Select, SearchOutlined, Switch } from "./antd";
import { RemoteSelect, type Opt } from "./RemoteSelect";
import { isEmptyValue, rangeParams, type DateRangeValue, type FilterField, type FilterParams, type FilterValue } from "./useFilterParams";

/**
 * FilterBar: thanh lọc dùng chung, đồng bộ URL qua hook `useFilterParams` (xem chú thích ở file đó về quy ước URL).
 * Mọi nhãn mặc định bằng tiếng Việt. Gồm: các ô lọc theo schema (text có debounce, select, multiselect, switch,
 * dateRange yyyy-MM-dd, remote chỉ lưu id), chip cho từng lọc đang áp dụng (bấm x để bỏ), nút "Xóa bộ lọc",
 * "N kết quả" (khi có `total`), phím "/" focus ô text đầu.
 * Đổi bất kỳ lọc nào đều xóa `page`. Control cao 32px, flex-wrap nên điện thoại 390px không tràn.
 *
 * Ví dụ (Users):
 *   const SCHEMA: FilterField[] = [
 *     { type: "text", name: "keyword", label: "Từ khóa", placeholder: "Tên, tài khoản hoặc email" },
 *     { type: "remote", name: "readerId", label: "Độc giả", fetcher: searchReaders, resolveLabel: readerName },
 *     { type: "select", name: "status", label: "Trạng thái", options: STATUS_OPTIONS },
 *     { type: "dateRange", name: "borrowDate", label: "Ngày mượn" },
 *     { type: "switch", name: "available", label: "Chỉ sách còn bản" },
 *   ];
 *   function UsersPage() {
 *     const f = useFilterParams(SCHEMA, { defaultSize: 20 });
 *     const q = useApi<Page>(`/api/users?${f.params}&page=${f.page - 1}&size=${f.size}`);
 *     return (<>
 *       <FilterBar filters={f} total={q.data?.total} />
 *       <DataTable ... pagination={{ mode: "server", page: f.page, pageSize: f.size, total, onSizeChange: f.setSize }} />
 *     </>);
 *   }
 * Khi dùng FilterBar thì không đặt thêm SearchBar trên cùng trang (cùng bắt phím "/").
 */
export type FilterBarProps = {
  filters: FilterParams;
  /** Có thì hiện "N kết quả". */
  total?: number;
  /** Ví dụ [10, 20, 50]: hiện ô chọn kích thước trang, lưu `size` trên URL. */
  /** Không còn tác dụng: ô đổi cỡ trang nằm cạnh phân trang trong DataTable. Giữ để trang cũ biên dịch được, sẽ bỏ. */
  pageSizes?: number[];
  /** Từ "kết quả" ở phần đếm, ví dụ "người dùng" -> "12 người dùng". */
  unit?: string;
  /** Chỗ đặt nút/ô khác cùng hàng với các ô lọc. */
  extra?: ReactNode;
  /** Hàng dưới cùng, đứng trước phần đếm kết quả (ví dụ tab trạng thái) để đếm nằm cùng hàng, đỡ tốn chỗ. */
  bottom?: ReactNode;
  className?: string;
};

const CONTROL_W = "min-w-0 flex-1 basis-36 sm:flex-none sm:basis-auto sm:w-48";

function TextFilter({ field, value, onCommit, focusOnSlash }: { field: Extract<FilterField, { type: "text" }>; value: string; onCommit: (v: string) => void; focusOnSlash: boolean }) {
  const [text, setText] = useState(value);
  const lastPushed = useRef(value);
  const input = useRef<React.ComponentRef<typeof Input>>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;

  const push = (v: string) => {
    const t = v.trim();
    if (t === lastPushed.current) return;
    lastPushed.current = t;
    commit.current(t);
  };

  // URL đổi từ bên ngoài (chip, "Xóa bộ lọc") thì đồng bộ ô nhập; URL do chính ô này đẩy lên thì bỏ qua.
  useEffect(() => {
    if (value !== lastPushed.current) {
      lastPushed.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => push(text), field.debounce ?? 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (!focusOnSlash) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusOnSlash]);

  return (
    <Input
      ref={input}
      role="searchbox"
      aria-label={field.label}
      className="min-w-0 flex-1 basis-full sm:max-w-sm sm:basis-64"
      prefix={<SearchOutlined aria-hidden />}
      placeholder={field.placeholder ?? field.label}
      value={text}
      allowClear
      autoComplete="off"
      onChange={(e) => setText(e.target.value)}
      onPressEnter={() => push(text)}
    />
  );
}

const toDayjs = (s: string) => (s ? dayjs(s, "YYYY-MM-DD") : null);

function chipText(field: FilterField, v: FilterValue, labels: Record<string, string>): string {
  switch (field.type) {
    case "select":
      return `${field.label}: ${field.options.find((o) => o.value === v)?.label ?? String(v)}`;
    case "multiselect":
      return `${field.label}: ${(v as string[]).map((x) => field.options.find((o) => o.value === x)?.label ?? x).join(", ")}`;
    case "switch":
      return field.label;
    case "dateRange": {
      const r = v as DateRangeValue;
      const fmt = (s: string) => (s ? dayjs(s, "YYYY-MM-DD").format("DD/MM/YYYY") : "");
      if (r.from && r.to) return `${field.label}: ${fmt(r.from)} – ${fmt(r.to)}`;
      return r.from ? `${field.label}: từ ${fmt(r.from)}` : `${field.label}: đến ${fmt(r.to)}`;
    }
    case "remote":
      return `${field.label}: ${labels[v as string] ?? String(v)}`;
    default:
      return `${field.label}: ${String(v)}`;
  }
}

export function FilterBar({ filters, total, unit = "kết quả", extra, bottom, className = "" }: FilterBarProps) {
  const { schema, values, set, clear, hasFilter } = filters;
  // Nhãn của giá trị remote (URL chỉ có id): nhớ khi người dùng chọn, tra bằng resolveLabel khi tải lại.
  const [labels, setLabels] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());

  useEffect(() => {
    for (const f of schema) {
      if (f.type !== "remote") continue;
      const id = values[f.name] as string;
      if (!id || labels[id] || asked.current.has(id) || !f.resolveLabel) continue;
      asked.current.add(id);
      f.resolveLabel(id)
        .then((l) => setLabels((m) => ({ ...m, [id]: l })))
        .catch(() => undefined);
    }
  }, [schema, values, labels]);

  const firstText = schema.find((f) => f.type === "text")?.name;
  const chips = schema.filter((f) => !isEmptyValue(values[f.name]));
  const showMeta = total !== undefined || chips.length > 0 || bottom !== undefined;

  const render = (f: FilterField): ReactNode => {
    switch (f.type) {
      case "text":
        return <TextFilter key={f.name} field={f} value={values[f.name] as string} onCommit={(v) => set(f.name, v)} focusOnSlash={f.name === firstText} />;
      case "select":
        return (
          <Select
            key={f.name}
            aria-label={f.label}
            className={CONTROL_W}
            placeholder={f.label}
            allowClear={f.allowClear ?? true}
            options={f.options}
            value={(values[f.name] as string) || undefined}
            onChange={(v) => set(f.name, v ?? "")}
          />
        );
      case "multiselect":
        return (
          <Select
            key={f.name}
            mode="multiple"
            aria-label={f.label}
            className="min-w-0 flex-1 basis-48 sm:flex-none sm:basis-auto sm:w-60"
            placeholder={f.label}
            maxTagCount="responsive"
            allowClear
            options={f.options}
            value={values[f.name] as string[]}
            onChange={(v) => set(f.name, v as string[])}
          />
        );
      case "switch":
        return (
          <label key={f.name} className="inline-flex h-8 cursor-pointer items-center gap-2 text-body text-ink">
            <Switch size="small" checked={values[f.name] === true} onChange={(c) => set(f.name, c)} />
            {f.label}
          </label>
        );
      case "dateRange": {
        const r = values[f.name] as DateRangeValue;
        return (
          <DatePicker.RangePicker
            key={f.name}
            aria-label={f.label}
            className="min-w-0 flex-1 basis-full sm:flex-none sm:basis-auto sm:w-64"
            placeholder={[`${f.label}: từ`, "đến"]}
            format="DD/MM/YYYY"
            allowEmpty={[true, true]}
            allowClear
            classNames={{ popup: { root: "fb-range-popup" } }}
            value={[toDayjs(r.from), toDayjs(r.to)]}
            onChange={(d) => set(f.name, { from: d?.[0]?.format("YYYY-MM-DD") ?? "", to: d?.[1]?.format("YYYY-MM-DD") ?? "" })}
          />
        );
      }
      case "remote": {
        const id = values[f.name] as string;
        const value: Opt | undefined = id ? { value: id, label: labels[id] ?? id } : undefined;
        return (
          <div key={f.name} className="min-w-0 flex-1 basis-full sm:flex-none sm:basis-auto sm:w-60" aria-label={f.label}>
            <RemoteSelect
              fetcher={f.fetcher}
              placeholder={f.placeholder ?? f.label}
              value={value}
              onChange={(o) => {
                if (o) setLabels((m) => ({ ...m, [o.value]: o.label }));
                set(f.name, o ? o.value : "");
              }}
            />
          </div>
        );
      }
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`} role="search" aria-label="Bộ lọc">
      {/* Điện thoại: lịch khoảng ngày chỉ một bảng, hai bảng rộng hơn màn hình 390px. */}
      <style>{`@media (max-width: 639px){.fb-range-popup .ant-picker-panels>:nth-child(n+2){display:none}.fb-range-popup .ant-picker-panel-container{max-width:calc(100vw - 16px)}}`}</style>
      <div className="flex flex-wrap items-center gap-2">
        {schema.map(render)}
        {extra}
      </div>

      {showMeta && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body">
          {bottom}
          {total !== undefined && (
            <span role="status" aria-live="polite" className="text-muted">
              <b className="font-semibold text-ink">{total.toLocaleString("vi-VN")}</b> {unit}
            </span>
          )}
          {hasFilter && (
            <Button type="link" size="small" className="!px-0" onClick={clear}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
