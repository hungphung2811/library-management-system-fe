import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiCallError, apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  ConfirmAction,
  Form,
  Input,
  InputNumber,
  KeyValueList,
  PageHeader,
  QueryBoundary,
  StatusTag,
  Text,
  describeError,
  formatDateTime,
  useDetailModal,
} from "@/ui";
import { PlatformGate } from "./_components/PlatformGate";
import { PLATFORM_ERRORS } from "./_lib/format";
import type { CmsPage } from "./_lib/types";

export default function CmsPageDetailPage() {
  return (
    <PlatformGate>
      <Detail />
    </PlatformGate>
  );
}

function Detail() {
  const { id = "" } = useParams();
  const query = useApi<CmsPage>(`/api/cms/pages/${encodeURIComponent(id)}`);
  return (
    <QueryBoundary query={query} errorMessages={PLATFORM_ERRORS}>
      {(page) => <Editor key={page.id} page={page} reload={() => void query.refetch()} />}
    </QueryBoundary>
  );
}

type Values = { title: string; bodyMarkdown: string; sortOrder: number | null };

/** Biểu mẫu sửa trang. Khi `version` đổi (sau lưu hoặc tải lại do xung đột) biểu mẫu nạp lại giá trị của bản mới. */
function Editor({ page, reload }: { page: CmsPage; reload: () => void }) {
  const [form] = Form.useForm<Values>();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const modal = useDetailModal();
  const inModal = !!modal;
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const base = `/api/cms/pages/${encodeURIComponent(page.id)}` as const;
  const inv = { invalidate: ["/api/cms/pages"] };

  const save = useApiMutation(
    (v: Values) =>
      apiFetch<CmsPage>(base, {
        method: "PUT",
        json: { title: v.title.trim(), bodyMarkdown: v.bodyMarkdown ?? "", sortOrder: v.sortOrder ?? 0, version: page.version },
      }),
    inv,
  );
  const publish = useApiMutation(
    () => apiFetch<CmsPage>(`${base}/publication`, { method: "POST", json: { version: page.version } }),
    inv,
  );
  const unpublish = useApiMutation(() => apiFetch<CmsPage>(`${base}/publication`, { method: "DELETE" }), inv);
  const remove = useApiMutation(() => apiFetch<void>(base, { method: "DELETE" }), inv);

  /** Chạy một thao tác ghi: 409 CMS_VERSION_CONFLICT thì tải lại bản mới và báo người dùng (thay đổi chưa lưu bị bỏ). */
  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setError(null);
    try {
      await fn();
      void message.success(ok);
      after?.();
    } catch (e) {
      const info = toErrorInfo(e);
      const text = describeError(info, PLATFORM_ERRORS).text;
      if (e instanceof ApiCallError && info.code === "CMS_VERSION_CONFLICT") {
        setConflict(true);
        reload();
      }
      setError(text);
    }
  };

  useEffect(() => {
    form.setFieldsValue({ title: page.title, bodyMarkdown: page.bodyMarkdown, sortOrder: page.sortOrder ?? 0 });
  }, [form, page.version, page.title, page.bodyMarkdown, page.sortOrder]);

  const unpublished = page.status === "DRAFT";
  return (
    <div className={inModal ? "flex flex-col gap-4" : "flex max-w-[1000px] flex-col gap-4"}>
      {!inModal && <Breadcrumb items={[{ title: <Link to="/platform/cms-pages">Trang website</Link> }, { title: page.title }]} />}
      <PageHeader
        title={page.title}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusTag domain="cms" value={page.status} />
            <Text type="secondary" className="font-mono">
              {page.slug}
            </Text>
          </span>
        }
        actions={
          <>
            <ConfirmAction
              title="Xuất bản trang này?"
              description="Khách sẽ thấy bản làm việc đã lưu (không gồm thay đổi chưa lưu)."
              okText="Xuất bản"
              onConfirm={() => run(() => publish.mutateAsync(), "Đã xuất bản.")}
            >
              <Button type="primary" disabled={page.status === "PUBLISHED"}>
                Xuất bản
              </Button>
            </ConfirmAction>
            {!unpublished && (
              <ConfirmAction
                title="Gỡ xuất bản?"
                description="Khách không còn thấy trang; bản làm việc được giữ."
                okText="Gỡ"
                danger
                onConfirm={() => run(() => unpublish.mutateAsync(), "Đã gỡ xuất bản.")}
              >
                <Button>Gỡ xuất bản</Button>
              </ConfirmAction>
            )}
            <ConfirmAction
              title="Xóa trang này?"
              description="Không hoàn tác được."
              okText="Xóa"
              danger
              onConfirm={() => run(() => remove.mutateAsync(), "Đã xóa trang.", () => (modal ? modal.close() : void navigate("/platform/cms-pages")))}
            >
              <Button danger>Xóa</Button>
            </ConfirmAction>
          </>
        }
      />
      {error && (
        <Alert
          type={conflict ? "warning" : "error"}
          showIcon
          title={error}
          closable={{ onClose: () => setError(null) }}
        />
      )}
      <Card title="Nội dung làm việc">
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ title: page.title, bodyMarkdown: page.bodyMarkdown, sortOrder: page.sortOrder ?? 0 }}
          onFinish={(v) => void run(() => save.mutateAsync(v), "Đã lưu.")}
          disabled={save.isPending}
        >
          <Form.Item label="Slug" extra="Không đổi được sau khi tạo.">
            <Input value={page.slug} readOnly disabled aria-label="Slug" />
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
            <Input.TextArea rows={14} maxLength={50000} showCount className="font-mono" />
          </Form.Item>
          <Form.Item name="sortOrder" label="Thứ tự hiển thị">
            <InputNumber precision={0} className="w-40" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={save.isPending}>
            Lưu
          </Button>
        </Form>
      </Card>
      <Card title="Thông tin">
        <KeyValueList
          columns={2}
          items={[
            { label: "Xuất bản lúc", value: page.publishedAt ? formatDateTime(page.publishedAt) : null },
            { label: "Cập nhật", value: formatDateTime(page.updatedAt) },
            { label: "Người cập nhật", value: page.updatedBy },
            { label: "Phiên bản", value: String(page.version), mono: true },
          ]}
        />
      </Card>
      {page.publishedBodyMarkdown != null && (
        <Card title={`Bản đang công khai: ${page.publishedTitle ?? ""}`}>
          {/* Văn bản thô (React tự escape, không innerHTML): bản xem trước dựng HTML từ Markdown chưa có, không tin HTML thô trong nội dung. */}
          <div className="whitespace-pre-wrap break-words font-mono text-body">{page.publishedBodyMarkdown}</div>
        </Card>
      )}
    </div>
  );
}
