import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Empty, Pagination, Spin, Table } from "./antd";
import { LinkButton } from "./LinkButton";
import { formatDate, formatDateTime, formatMoney } from "./format";
import { ShortId } from "./ShortId";
import { StatusTag } from "./StatusTag";
import type { StatusDomain } from "./status-labels";

type Row = Record<string, unknown>;

/** Các cỡ trang mặc định của ô "/ trang" cạnh phân trang (trang truyền `pageSizes` để thay). */
export const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

export type DataColumn = {
  key: string;
  title: string;
  dataIndex: string | string[];
  kind?: "text" | "mono" | "date" | "datetime" | "money" | "status" | "bool" | "link" | "id";
  /** Khi kind = "status". */
  statusDomain?: StatusDomain;
  /** Khi kind = "link": mẫu đường dẫn đầy đủ, ví dụ "/catalog/books/{id}"; {field} lấy từ dòng (đã encodeURIComponent). */
  href?: string;
  width?: number;
  align?: "left" | "right" | "center";
  /** Tuỳ biến ô (mọi trang giờ là client nên dùng thoải mái). Có render thì `kind` bị bỏ qua. */
  render?: (value: unknown, row: Row) => ReactNode;
};

/**
 * Ô đổi kích thước trang luôn hiện cạnh phân trang. `pageSizes` thay danh sách mặc định; `onSizeChange` để trang tự lưu `size`.
 * Không truyền `onSizeChange`: server mode ghi `size` lên URL (bỏ `page`, trang đọc lại bằng `usePageSize`), client mode giữ cỡ trang trong state.
 */
type PageSizeOpts = { pageSizes?: number[]; onSizeChange?: (size: number) => void };

export type DataTablePagination =
  | ({ mode: "client"; pageSize: number } & PageSizeOpts)
  /** Phân trang server: `page` đánh số từ 1 trên URL (trang tự trừ 1 khi gọi BE); DataTable tự dựng href `?page=n` từ URL hiện tại. */
  | ({ mode: "server"; page: number; pageSize: number; total: number; param?: string } & PageSizeOpts);

export type DataTableProps = {
  columns: DataColumn[];
  rows: Row[];
  rowKey: string;
  empty: { title: string; hint?: string; action?: { label: string; href: string } };
  pagination?: DataTablePagination;
  /** Có thì trên điện thoại (< 640px) hiện danh sách thẻ; giá trị là `key` của cột làm dòng đậm. */
  mobileTitleKey?: string;
  loading?: boolean;
  /** Bảng nằm trong Card/khung đã có viền: bỏ viền và bo góc của chính bảng. */
  embedded?: boolean;
};

const DASH = "—";

function valueAt(row: Row, path: string | string[]): unknown {
  const keys = Array.isArray(path) ? path : [path];
  let cur: unknown = row;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Row)[k];
  }
  return cur;
}

function fillHref(tpl: string, row: Row) {
  return tpl.replace(/\{([^}]+)\}/g, (_, f: string) => encodeURIComponent(String(valueAt(row, f.split(".")) ?? "")));
}

function cell(col: DataColumn, row: Row): ReactNode {
  const v = valueAt(row, col.dataIndex);
  if (col.render) return col.render(v, row);
  const empty = v === null || v === undefined || v === "";
  switch (col.kind) {
    case "id":
      return <ShortId value={empty ? null : String(v)} />;
    case "mono":
      return empty ? DASH : <span className="font-mono">{String(v)}</span>;
    case "date":
      return formatDate(v as string);
    case "datetime":
      return formatDateTime(v as string);
    case "money":
      return formatMoney(v as number);
    case "status":
      return col.statusDomain ? <StatusTag domain={col.statusDomain} value={v as string} /> : String(v ?? DASH);
    case "bool":
      return empty ? DASH : v ? "Có" : "Không";
    case "link": {
      if (empty) return DASH;
      const text = String(v);
      return col.href ? (
        <Link to={fillHref(col.href, row)} className="font-medium text-primary no-underline hover:underline">
          {text}
        </Link>
      ) : (
        text
      );
    }
    default:
      return empty ? DASH : String(v);
  }
}

/**
 * Bảng dữ liệu: `columns` (có `kind`, hoặc `render` tuỳ biến) + `rows`; không dùng `rowHref` (cả dòng bấm được
 * kém truy cập bàn phím), thay bằng cột kind="link". Trang không có dữ liệu hiện `empty`; trang tự chọn nội dung empty
 * theo việc có bộ lọc hay không. Có `mobileTitleKey` thì render CẢ bảng (`hidden sm:block`) và thẻ (`sm:hidden`) bằng CSS.
 */
export function DataTable({ columns, rows, rowKey, empty, pagination, mobileTitleKey, loading, embedded }: DataTableProps) {
  const [clientPage, setClientPage] = useState(1);
  const [localSize, setLocalSize] = useState<number | null>(null);
  const [sp, setSp] = useSearchParams();

  const pageSize =
    pagination?.mode === "client" && !pagination.onSizeChange && localSize ? localSize : (pagination?.pageSize ?? 0);
  const server = pagination?.mode === "server" ? pagination : null;
  const shown =
    pagination?.mode === "client" ? rows.slice((clientPage - 1) * pageSize, clientPage * pageSize) : rows;
  const total = server ? server.total : rows.length;
  const current = server ? server.page : clientPage;
  const param = server?.param ?? "page";

  const changeSize = (s: number) => {
    if (!pagination) return;
    if (pagination.onSizeChange) return pagination.onSizeChange(s);
    if (server) {
      const q = new URLSearchParams(sp.toString());
      q.delete(param);
      q.set("size", String(s));
      setSp(q);
      return;
    }
    setLocalSize(s);
    setClientPage(1);
  };
  const sizeOptions = pagination
    ? Array.from(new Set([...(pagination.pageSizes?.length ? pagination.pageSizes : DEFAULT_PAGE_SIZES), pagination.pageSize])).sort((a, b) => a - b)
    : [];

  const hrefFor = (p: number) => {
    const q = new URLSearchParams(sp.toString());
    if (p <= 1) q.delete(param);
    else q.set(param, String(p));
    return `?${q.toString()}`; // query thuần: react-router ghép vào đường dẫn hiện tại
  };

  const tableColumns = columns.map((c) => ({
    key: c.key,
    title: c.title,
    width: c.width,
    align: c.align,
    render: (_: unknown, row: Row) => cell(c, row),
  }));

  const emptyNode = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div>
          <div className="font-medium text-ink">{empty.title}</div>
          {empty.hint && <div className="text-muted">{empty.hint}</div>}
        </div>
      }
    >
      {empty.action && (
        <LinkButton type="primary" to={empty.action.href}>
          {empty.action.label}
        </LinkButton>
      )}
    </Empty>
  );

  const titleCol = columns.find((c) => c.key === mobileTitleKey);
  const hasCards = !!titleCol && rows.length > 0;

  return (
    <div>
      <div className={`overflow-hidden bg-surface ${embedded ? "" : "rounded-card border border-line"} ${hasCards ? "hidden sm:block" : ""}`}>
        <Table
          rowKey={rowKey}
          columns={tableColumns}
          dataSource={shown}
          loading={loading}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: emptyNode }}
        />
      </div>

      {hasCards && (
        <Spin spinning={!!loading}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:hidden">
            {shown.map((row) => (
              <li key={String(row[rowKey])} className="rounded-card border border-line bg-surface p-3.5">
                <div className="mb-2 font-semibold text-ink">{cell(titleCol, row)}</div>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body">
                  {columns
                    .filter((c) => c.key !== mobileTitleKey)
                    .map((c) => (
                      <div key={c.key} className="contents">
                        <dt className="text-muted">{c.title}</dt>
                        <dd className="m-0 min-w-0 break-words">{cell(c, row)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        </Spin>
      )}

      {pagination && total > Math.min(pageSize, ...sizeOptions) && (
        <div className="mt-3 flex justify-end">
          <Pagination
            current={current}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={sizeOptions}
            locale={{ items_per_page: "/ trang", page_size: "Số dòng mỗi trang" }}
            onShowSizeChange={(_, s) => changeSize(s)}
            showTotal={(t, [a, b]) => `Hiển thị ${a}–${b} trên tổng ${t}`}
            onChange={server ? undefined : (p) => setClientPage(p)}
            itemRender={
              server
                ? (p, type, original) => {
                    const last = Math.max(1, Math.ceil(total / pageSize));
                    if (type === "page")
                      return (
                        <Link to={hrefFor(p)} aria-label={`Trang ${p}`}>
                          {p}
                        </Link>
                      );
                    if (type === "prev" && current > 1)
                      return (
                        <Link to={hrefFor(p)} aria-label="Trang trước" className="ant-pagination-item-link">
                          ‹
                        </Link>
                      );
                    if (type === "next" && current < last)
                      return (
                        <Link to={hrefFor(p)} aria-label="Trang sau" className="ant-pagination-item-link">
                          ›
                        </Link>
                      );
                    return original;
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
