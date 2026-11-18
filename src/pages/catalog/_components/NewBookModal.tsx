import { useRef } from "react";
import { useNavigate } from "react-router";
import { apiFetch, useApiMutation } from "@/api";
import { Form, FormModal, Input, InputNumber } from "@/ui";
import { ClassificationFields, classificationBody, type ClassificationValues } from "./ClassificationFields";
import { PublicationFields, publicationBody, type PublicationValues } from "./PublicationFields";
import type { TitleView } from "./types";

type Values = { name: string; author: string; isbn?: string; coverPrice: number } & ClassificationValues & PublicationValues;

/**
 * Hộp thoại thêm đầu sách (POST /api/books, khóa TitleController/create). Lưu xong chuyển tới trang chi tiết sách;
 * "Lưu và thêm bản sao" mở sẵn hộp thoại thêm bản sao ở đó (?addCopy=1). Mở bằng nút ở danh sách hoặc `?new=1`.
 */
export function NewBookModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  // Đã chuyển sang trang chi tiết thì không đóng bằng cách sửa URL của trang danh sách (sẽ xóa ?addCopy=1 vừa đặt).
  const left = useRef(false);
  const create = useApiMutation(
    (v: Values) => {
      const isbn = v.isbn?.trim();
      return apiFetch<TitleView>("/api/books", {
        method: "POST",
        json: { name: v.name.trim(), author: v.author.trim(), ...(isbn ? { isbn } : {}), coverPrice: v.coverPrice, ...classificationBody(v), ...publicationBody(v) },
      });
    },
    { invalidate: ["/api/books"] },
  );

  const save = (then: "save" | "copy") => async (v: Values) => {
    const created = await create.mutateAsync(v);
    left.current = true;
    void navigate(`/catalog/books/${encodeURIComponent(created.id)}${then === "copy" ? "?addCopy=1" : ""}`);
  };

  return (
    <FormModal<Values>
      open={open}
      title="Thêm sách"
      successMessage="Đã thêm sách."
      onCancel={() => {
        if (left.current) left.current = false;
        else onClose();
      }}
      onSubmit={save("save")}
      secondary={{ text: "Lưu và thêm bản sao", onSubmit: save("copy") }}
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
      <Form.Item name="isbn" label="ISBN" extra="Tùy chọn, tối đa 20 ký tự." rules={[{ max: 20, message: "Tối đa 20 ký tự" }]}>
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
      <ClassificationFields />
      <PublicationFields />
    </FormModal>
  );
}
