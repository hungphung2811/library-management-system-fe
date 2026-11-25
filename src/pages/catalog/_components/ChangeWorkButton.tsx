import { useState } from "react";
import { apiFetch } from "@/api";
import { Button, Form, FormModal, Input, Radio, RemoteSelect, useFormModal, type Opt } from "@/ui";
import type { WorkPage } from "../_lib/works";
import type { TitleView } from "./types";

type Values = { mode: "existing" | "new"; work?: Opt; newTitle?: string };

/** Đổi tác phẩm của ấn bản (PUT /api/books/{id}/work): gắn vào tác phẩm có sẵn hoặc tách ra tác phẩm mới. */
export function ChangeWorkButton({ book }: { book: TitleView }) {
  const [mode, setMode] = useState<Values["mode"]>("existing");
  const form = useFormModal<Values>({
    title: `Đổi tác phẩm của «${book.name}»`,
    okText: "Lưu",
    successMessage: "Đã đổi tác phẩm của ấn bản.",
    invalidate: ["/api/books", "/api/works"],
    initialValues: { mode: "existing" },
    request: (v) =>
      apiFetch(`/api/books/${encodeURIComponent(book.id)}/work`, {
        method: "PUT",
        json: v.mode === "existing" ? { workId: v.work?.value } : { newWork: { title: v.newTitle?.trim(), kind: "SINGLE" } },
      }),
  });
  const fetchWorks = async (q: string): Promise<Opt[]> => {
    const r = await apiFetch<WorkPage>(`/api/works?size=30${q ? `&keyword=${encodeURIComponent(q)}` : ""}`);
    return (r.items ?? []).filter((w) => w.id !== book.workId).map((w) => ({ value: w.id, label: w.title }));
  };
  return (
    <>
      <Button
        onClick={() => {
          setMode("existing");
          form.openModal();
        }}
      >
        Đổi tác phẩm
      </Button>
      <FormModal<Values> {...form.modalProps}>
        <p className="mt-0 text-muted">
          Đổi tác phẩm làm thể loại, tác giả chuẩn và bộ sách của ấn bản này theo tác phẩm mới.
        </p>
        <Form.Item name="mode" label="Cách đổi">
          <Radio.Group onChange={(e) => setMode(e.target.value as Values["mode"])}>
            <Radio value="existing">Gắn vào tác phẩm có sẵn</Radio>
            <Radio value="new">Tách thành tác phẩm mới</Radio>
          </Radio.Group>
        </Form.Item>
        {mode === "existing" ? (
          <Form.Item name="work" label="Tác phẩm" rules={[{ required: true, message: "Chọn tác phẩm" }]}>
            <RemoteSelect fetcher={fetchWorks} placeholder="Gõ để tìm tác phẩm" />
          </Form.Item>
        ) : (
          <Form.Item
            name="newTitle"
            label="Tên tác phẩm mới"
            rules={[{ required: true, whitespace: true, message: "Nhập tên tác phẩm" }, { max: 255, message: "Tối đa 255 ký tự" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
        )}
      </FormModal>
    </>
  );
}
