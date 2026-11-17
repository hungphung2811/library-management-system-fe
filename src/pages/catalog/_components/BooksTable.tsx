import { DataTable, Tag, type DataTableProps } from "@/ui";
import type { TitleView } from "./types";

/** Bảng sách. Danh sách đã lọc/sắp xếp; trang và cỡ trang đến từ URL (link `?page=n`), cắt dòng ở đây. */
export function BooksTable({
  books,
  empty,
  page,
  pageSize,
}: {
  books: TitleView[];
  empty: DataTableProps["empty"];
  page: number;
  pageSize: number;
}) {
  const last = Math.max(1, Math.ceil(books.length / pageSize));
  const current = Math.min(page, last);
  return (
    <DataTable
      rowKey="id"
      rows={books.slice((current - 1) * pageSize, current * pageSize)}
      empty={empty}
      pagination={{ mode: "server", page: current, pageSize, total: books.length }}
      mobileTitleKey="name"
      columns={[
        { key: "name", title: "Tên sách", dataIndex: "name", kind: "link", href: "/catalog/books/{id}" },
        { key: "author", title: "Tác giả", dataIndex: "author" },
        { key: "isbn", title: "ISBN", dataIndex: "isbn", kind: "mono" },
        { key: "coverPrice", title: "Giá bìa", dataIndex: "coverPrice", kind: "money", align: "right" },
        {
          key: "availableCopies",
          title: "Còn sẵn",
          dataIndex: "availableCopies",
          render: (v) => (Number(v) > 0 ? <Tag color="success">{String(v)} bản</Tag> : <Tag>Hết bản</Tag>),
        },
      ]}
    />
  );
}
