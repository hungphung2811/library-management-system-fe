"use client";
import { DataTable, Tag, type DataTableProps } from "@mfe/ui";
import type { TitleView } from "../types";

/** Bảng sách (client vì cột "Còn sẵn" cần render Tag). Phân trang client 20 dòng/trang. */
export function BooksTable({ books, empty }: { books: TitleView[]; empty: DataTableProps["empty"] }) {
  return (
    <DataTable
      rowKey="id"
      rows={books}
      empty={empty}
      pagination={{ mode: "client", pageSize: 20 }}
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
          render: (v) =>
            Number(v) > 0 ? <Tag color="success">{String(v)} bản</Tag> : <Tag>Hết bản</Tag>,
        },
      ]}
    />
  );
}
