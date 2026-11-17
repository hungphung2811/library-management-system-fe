import { useState } from "react";
import { apiFetch, useApiMutation } from "@/api";
import { Button, EditOutlined, Form, FormModal, Input, InputNumber } from "@/ui";
import type { TitleView } from "./types";

type Values = { name: string; author: string; isbn?: string; coverPrice: number };

/** Nút "Sửa" + hộp thoại sửa đầu sách (PUT /api/books/{id}, khóa TitleController/update). Ô có sẵn giá trị hiện tại. */
export function BookEditButton({ book }: { book: TitleView }) {
  const [open, setOpen] = useState(false);
  const save = useApiMutation(
    (v: Values) => {
      const isbn = v.isbn?.trim();
      return apiFetch<TitleView>(`/api/books/${encodeURIComponent(book.id)}`, {
        method: "PUT",
        json: { name: v.name.trim(), author: v.author.trim(), isbn: isbn ? isbn : null, coverPrice: v.coverPrice },
      });
    },
    { invalidate: ["/api/books"] },
  );

  return (
    <>
      <Button icon={<EditOutlined />} onClick={() => setOpen(true)}>
        Sửa
      </Button>
      <FormModal<Values>
        open={open}
        title="Sửa thông tin sách"
        successMessage="Đã cập nhật thông tin sách."
        onCancel={() => setOpen(false)}
        initialValues={{ name: book.name, author: book.author, isbn: book.isbn ?? "", coverPrice: book.coverPrice }}
        onSubmit={async (v) => {
          await save.mutateAsync(v);
        }}
      >
        <Form.Item
          name="name"
          label="Tên sách"
          rules={[
            { required: true, whitespace: true, message: "Nhập tên sách" },
            { max: 255, message: "Tối đa 255 ký tự" },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="author"
          label="Tác giả"
          rules={[
            { required: true, whitespace: true, message: "Nhập tác giả" },
            { max: 255, message: "Tối đa 255 ký tự" },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="isbn" label="ISBN" extra="Để trống để xóa ISBN. Tối đa 20 ký tự." rules={[{ max: 20, message: "Tối đa 20 ký tự" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="coverPrice"
          label="Giá bìa"
          rules={[
            { required: true, message: "Nhập giá bìa" },
            { type: "number", min: 0, message: "Giá bìa không được âm" },
          ]}
        >
          <InputNumber
            className="w-full"
            min={0}
            step={1000}
            suffix="₫"
            formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            parser={(v) => Number((v ?? "").replace(/\./g, "")) as 0}
          />
        </Form.Item>
      </FormModal>
    </>
  );
}
