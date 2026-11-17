import { useState } from "react";
import { ApiCallError, apiFetch, useApi, useApiMutation } from "@/api";
import { Button, Card, EditOutlined, Form, FormModal, Input, QueryBoundary, Text } from "@/ui";
import type { TitlePreviewView } from "./types";

export const DESCRIPTION_MAX = 500;
export const PREVIEW_MAX = 2000;

const ERRORS = {
  TITLE_PREVIEW_TOO_LONG: `Mô tả tối đa ${DESCRIPTION_MAX} ký tự và đoạn đọc thử tối đa ${PREVIEW_MAX} ký tự.`,
  TITLE_NOT_FOUND: "Không tìm thấy đầu sách này.",
};

/** Độ dài theo code point (emoji tính 1), sau khi chuẩn hóa NFC và đổi xuống dòng như BE, để bộ đếm khớp giới hạn BE. */
export function codePointLength(s: string | null | undefined): number {
  return [...(s ?? "").normalize("NFC").replace(/\r\n?/g, "\n")].length;
}

const lengthRule = (max: number) => ({
  validator: (_: unknown, v: string | undefined) =>
    codePointLength(v) > max ? Promise.reject(new Error(`Tối đa ${max} ký tự`)) : Promise.resolve(),
});

const counter = (max: number) => ({ show: true, max, strategy: codePointLength });

type Values = { description?: string; previewText?: string };

/**
 * Khối "Mô tả và đọc thử" của đầu sách. Xem cần `TitleController/preview`, sửa cần `TitleController/updatePreview`.
 * Cả hai trường là văn bản thuần: hiển thị bằng nội suy của React + `white-space: pre-wrap`, KHÔNG dùng innerHTML.
 */
export function BookPreviewCard({ titleId, canEdit }: { titleId: string; canEdit: boolean }) {
  const path = `/api/books/${encodeURIComponent(titleId)}/preview` as const;
  const query = useApi<TitlePreviewView>(path);
  const [open, setOpen] = useState(false);
  const save = useApiMutation((v: Values) => apiFetch<TitlePreviewView>(path, { method: "PUT", json: { description: v.description ?? "", previewText: v.previewText ?? "" } }), {
    invalidate: [path],
  });

  return (
    <Card
      title="Mô tả và đọc thử"
      extra={
        canEdit ? (
          <Button icon={<EditOutlined />} onClick={() => setOpen(true)} disabled={!query.data}>
            Sửa
          </Button>
        ) : undefined
      }
    >
      <QueryBoundary query={query} errorMessages={ERRORS}>
        {(p) => (
          <>
            <div className="flex flex-col gap-4">
              <section>
                <div className="mb-1 text-muted">Mô tả ngắn</div>
                {p.description ? (
                  <div className="break-words whitespace-pre-wrap" data-testid="preview-description">
                    {p.description}
                  </div>
                ) : (
                  <Text type="secondary">Chưa nhập.</Text>
                )}
              </section>
              <section>
                <div className="mb-1 text-muted">Đoạn đọc thử</div>
                {p.previewText ? (
                  <div className="break-words whitespace-pre-wrap" data-testid="preview-text">
                    {p.previewText}
                  </div>
                ) : (
                  <Text type="secondary">Chưa nhập.</Text>
                )}
              </section>
            </div>
            {canEdit && (
              <FormModal<Values>
                open={open}
                title="Sửa mô tả và đọc thử"
                successMessage="Đã lưu."
                onCancel={() => setOpen(false)}
                initialValues={{ description: p.description ?? "", previewText: p.previewText ?? "" }}
                onSubmit={async (v) => {
                  try {
                    await save.mutateAsync(v);
                  } catch (e) {
                    if (e instanceof ApiCallError && e.code && e.code in ERRORS) {
                      throw new ApiCallError(e.status, e.code, ERRORS[e.code as keyof typeof ERRORS], e.details);
                    }
                    throw e;
                  }
                }}
              >
                <Form.Item name="description" label="Mô tả ngắn (văn bản thuần)" rules={[lengthRule(DESCRIPTION_MAX)]}>
                  <Input.TextArea rows={4} count={counter(DESCRIPTION_MAX)} />
                </Form.Item>
                <Form.Item
                  name="previewText"
                  label="Đoạn đọc thử (văn bản thuần)"
                  extra="Để trống để xóa. Ký tự < > được lưu nguyên văn."
                  rules={[lengthRule(PREVIEW_MAX)]}
                >
                  <Input.TextArea rows={10} count={counter(PREVIEW_MAX)} />
                </Form.Item>
              </FormModal>
            )}
          </>
        )}
      </QueryBoundary>
    </Card>
  );
}
