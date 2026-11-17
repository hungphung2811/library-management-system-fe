import { useState } from "react";
import { useNavigate } from "react-router";
import { apiFetch, toErrorInfo, useApiMutation } from "@/api";
import { Alert, App, Button, Card, Form, Input, InputNumber, LinkButton, Space, describeError, type DescribedError } from "@/ui";
import type { TitleView } from "./types";

type Values = { name: string; author: string; isbn?: string; coverPrice: number };

export function NewBookForm() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [submitting, setSubmitting] = useState<"save" | "copy" | null>(null);
  const [error, setError] = useState<DescribedError | null>(null);
  const create = useApiMutation(
    (v: Values) => {
      const isbn = v.isbn?.trim();
      return apiFetch<TitleView>("/api/books", {
        method: "POST",
        json: { name: v.name.trim(), author: v.author.trim(), ...(isbn ? { isbn } : {}), coverPrice: v.coverPrice },
      });
    },
    { invalidate: ["/api/books"] },
  );

  const submit = async (then: "save" | "copy") => {
    if (submitting) return;
    let v: Values;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(then);
    setError(null);
    try {
      const created = await create.mutateAsync(v);
      message.success(`Đã thêm sách «${created.name}».`);
      void navigate(`/catalog/books/${encodeURIComponent(created.id)}${then === "copy" ? "?addCopy=1" : ""}`);
    } catch (e) {
      const d = describeError(toErrorInfo(e));
      const fields: { name: string[]; errors: string[] }[] = [];
      const rest: string[] = [];
      for (const line of d.details ?? []) {
        const m = /^(\w+)\s*:\s*(.+)$/.exec(line);
        if (m && ["name", "author", "isbn", "coverPrice"].includes(m[1])) fields.push({ name: [m[1]], errors: [m[2]] });
        else rest.push(line);
      }
      if (fields.length) form.setFields(fields as never);
      setError({ ...d, details: rest });
      setSubmitting(null);
    }
  };

  return (
    <Card>
      {error && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          title={error.text}
          description={
            error.detail || error.details?.length ? (
              <div>
                {error.detail && <div>{error.detail}</div>}
                {error.details?.map((x) => <div key={x}>{x}</div>)}
              </div>
            ) : undefined
          }
        />
      )}
      <Form form={form} layout="vertical" disabled={!!submitting} onFinish={() => submit("save")} requiredMark>
        <Form.Item
          name="name"
          label="Tên sách"
          rules={[
            { required: true, whitespace: true, message: "Nhập tên sách" },
            { max: 255, message: "Tối đa 255 ký tự" },
          ]}
        >
          <Input autoFocus autoComplete="off" />
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
        <Space wrap>
          <Button type="primary" htmlType="submit" loading={submitting === "save"} disabled={!!submitting}>
            Lưu
          </Button>
          <Button onClick={() => submit("copy")} loading={submitting === "copy"} disabled={!!submitting}>
            Lưu và thêm bản sao
          </Button>
          <LinkButton to="/catalog" disabled={!!submitting}>
            Hủy
          </LinkButton>
        </Space>
      </Form>
    </Card>
  );
}
