import { useNavigate } from "react-router";
import { apiFetch } from "@/api";
import { Button, Form, FormModal, Input, InputNumber, PlusOutlined, useFormModal } from "@/ui";
import { withPlatformErrors } from "../_lib/format";
import type { CmsPage } from "../_lib/types";

type Values = { slug: string; title: string; bodyMarkdown: string; sortOrder?: number | null };

export const SLUG_RE = /^[a-z0-9-]+$/;

/** Nút + hộp thoại "Thêm trang". Slug không đổi được sau khi tạo. Tạo xong chuyển sang trang sửa. */
export function CreateCmsPageButton() {
  const navigate = useNavigate();
  const create = useFormModal<Values, CmsPage>({
    title: "Thêm trang",
    okText: "Tạo",
    successMessage: "Đã tạo trang (bản nháp).",
    initialValues: { bodyMarkdown: "" },
    invalidate: ["/api/cms/pages"],
    request: (v) =>
      withPlatformErrors(() =>
        apiFetch<CmsPage>("/api/cms/pages", {
          method: "POST",
          json: {
            slug: v.slug.trim(),
            title: v.title.trim(),
            bodyMarkdown: v.bodyMarkdown ?? "",
            ...(v.sortOrder == null ? {} : { sortOrder: v.sortOrder }),
          },
        }),
      ),
    onSuccess: (created) => {
      if (created?.id) void navigate(`/platform/cms-pages/${encodeURIComponent(created.id)}`);
    },
  });
  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => create.openModal()}>
        Thêm trang
      </Button>
      <FormModal<Values> {...create.modalProps}>
        <Form.Item
          name="slug"
          label="Đường dẫn (slug)"
          extra="Chữ thường a-z, số, dấu gạch ngang; tối đa 80 ký tự. Không đổi được sau khi tạo."
          rules={[
            { required: true, message: "Nhập slug" },
            { max: 80, message: "Tối đa 80 ký tự" },
            { pattern: SLUG_RE, message: "Chỉ gồm chữ thường a-z, số và dấu gạch ngang" },
          ]}
        >
          <Input autoComplete="off" maxLength={80} />
        </Form.Item>
        <Form.Item
          name="title"
          label="Tiêu đề"
          rules={[
            { required: true, whitespace: true, message: "Nhập tiêu đề" },
            { max: 200, message: "Tối đa 200 ký tự" },
          ]}
        >
          <Input autoComplete="off" maxLength={200} showCount />
        </Form.Item>
        <Form.Item name="bodyMarkdown" label="Nội dung (Markdown)" rules={[{ max: 50000, message: "Tối đa 50000 ký tự" }]}>
          <Input.TextArea rows={6} maxLength={50000} showCount />
        </Form.Item>
        <Form.Item name="sortOrder" label="Thứ tự hiển thị">
          <InputNumber precision={0} className="w-full" />
        </Form.Item>
      </FormModal>
    </>
  );
}
