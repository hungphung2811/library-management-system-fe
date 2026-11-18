import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useInvalidateApi, useSession, type ErrorInfo } from "@/api";
import { Alert, Button, DataTable, ErrorPanel, Eye, Form, FormModal, Input, Modal, Pencil, QueryBoundary, Spin, Tag, actionsColumn, describeError, type DataColumn } from "@/ui";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, typeLabel, type NotificationTemplate } from "../../_lib/notifications";

type Values = { subject: string; body: string };
type Preview = { subject: string; body: string };

const pathOf = (t: { type: string; channel: string }) => `/api/notification-templates/${encodeURIComponent(t.type)}/${encodeURIComponent(t.channel)}` as const;

/** recipient_name và tenant_name do hệ thống điền lúc gửi nên mọi loại đều dùng được. */
const SYSTEM_PARAMS = ["recipient_name", "tenant_name"];

function EditorBody({ tpl, canPreview }: { tpl: NotificationTemplate; canPreview: boolean }) {
  const form = Form.useFormInstance<Values>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState<ErrorInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const params = [...tpl.allowedParams, ...SYSTEM_PARAMS.filter((p) => !tpl.allowedParams.includes(p))];
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const v = form.getFieldsValue();
      setPreview(await apiFetch<Preview>(`${pathOf(tpl)}/preview`, { method: "POST", json: { subject: v.subject, body: v.body } }));
    } catch (e) {
      setPreview(null);
      setErr(toErrorInfo(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Form.Item name="subject" label="Tiêu đề thư" rules={[{ required: true, whitespace: true, message: "Nhập tiêu đề" }, { max: 200, message: "Tối đa 200 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="body" label="Nội dung thư" rules={[{ required: true, whitespace: true, message: "Nhập nội dung" }, { max: 5000, message: "Tối đa 5000 ký tự" }]}>
        <Input.TextArea rows={8} maxLength={5000} showCount />
      </Form.Item>
      <div className="mb-3 text-sm" data-testid="template-params">
        <span className="text-muted">Tham số dùng được (bấm để chèn dạng {"{{tên}}"}): </span>
        <span className="inline-flex flex-wrap gap-1">
          {params.map((p) => (
            <Button key={p} size="small" aria-label={`Chèn tham số ${p}`} onClick={() => form.setFieldValue("body", `${form.getFieldValue("body") ?? ""}{{${p}}}`)}>
              {p}
            </Button>
          ))}
        </span>
      </div>
      {canPreview && (
        <div className="flex flex-col gap-2">
          <div>
            <Button loading={busy} onClick={() => void run()}>
              Xem trước
            </Button>
          </div>
          {err && <Alert type="error" showIcon title={describeError(err).text} />}
          {preview && (
            <div className="rounded-control border border-line p-3" data-testid="template-preview" aria-live="polite">
              <div className="font-medium">{preview.subject}</div>
              <pre className="m-0 mt-2 font-sans whitespace-pre-wrap">{preview.body}</pre>
              <div className="mt-2 text-xs text-muted">Dữ liệu giả, không gửi thư thật.</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Sửa mẫu: lưu tạo phiên bản mới (bản cũ thôi hiệu lực, không xóa). Chỉ có khóa xem thì hiện chỉ đọc. */
function TemplateDialog({ row, onClose }: { row: NotificationTemplate; onClose: () => void }) {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const canSave = can(s, PERMISSIONS.NOTIFICATION_TEMPLATE_SAVE);
  const canPreview = can(s, PERMISSIONS.NOTIFICATION_TEMPLATE_PREVIEW);
  const canGet = can(s, PERMISSIONS.NOTIFICATION_TEMPLATE_GET);
  const q = useApi<NotificationTemplate>(canGet ? pathOf(row) : null);
  const tpl = q.data ?? row;
  const title = `${typeLabel(row.type)} · ${NOTIFICATION_CHANNELS[row.channel] ?? row.channel}`;
  if (canGet && q.isPending)
    return (
      <Modal open title={title} footer={null} onCancel={onClose} centered>
        <div className="flex justify-center p-6" role="status" aria-label="Đang tải mẫu">
          <Spin />
        </div>
      </Modal>
    );
  if (canGet && q.isError)
    return (
      <Modal open title={title} footer={null} onCancel={onClose} centered>
        <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} />
      </Modal>
    );
  if (!canSave)
    return (
      <Modal open title={title} footer={null} onCancel={onClose} centered width={720}>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="template-readonly">
          <dt className="text-muted">Tiêu đề</dt>
          <dd className="m-0">{tpl.subject}</dd>
          <dt className="text-muted">Nội dung</dt>
          <dd className="m-0 whitespace-pre-wrap">{tpl.body}</dd>
          <dt className="text-muted">Tham số</dt>
          <dd className="m-0">{tpl.allowedParams.join(", ") || "—"}</dd>
        </dl>
      </Modal>
    );
  return (
    <FormModal<Values>
      open
      title={title}
      okText="Lưu phiên bản mới"
      onCancel={onClose}
      initialValues={{ subject: tpl.subject, body: tpl.body }}
      successMessage="Đã lưu mẫu (phiên bản mới)."
      onSubmit={async (v) => {
        await apiFetch(pathOf(tpl), { method: "PUT", json: { subject: v.subject.trim(), body: v.body } });
        await invalidate("/api/notification-templates");
      }}
    >
      <p className="mt-0 text-sm text-muted">
        Đang dùng: {tpl.source === "TENANT" ? "mẫu của đơn vị" : "mẫu mặc định"}, phiên bản {tpl.version}. Lưu sẽ tạo phiên bản mới; phiên bản cũ thôi hiệu lực.
      </p>
      <EditorBody tpl={tpl} canPreview={canPreview} />
    </FormModal>
  );
}

/** Danh sách mẫu nội dung thông báo của tenant: xem, sửa (phiên bản mới), xem trước với dữ liệu giả. */
export function TemplatesTab() {
  const s = useSession();
  const q = useApi<NotificationTemplate[]>("/api/notification-templates");
  const [open, setOpen] = useState<NotificationTemplate | null>(null);
  const canSave = can(s, PERMISSIONS.NOTIFICATION_TEMPLATE_SAVE);
  const canOpen = canSave || can(s, PERMISSIONS.NOTIFICATION_TEMPLATE_GET);
  const columns: DataColumn[] = [
    { key: "t", title: "Loại thông báo", dataIndex: "type", render: (v) => typeLabel(v as string) },
    { key: "c", title: "Nhóm", dataIndex: "category", render: (v) => NOTIFICATION_CATEGORIES[v as string] ?? String(v) },
    { key: "ch", title: "Kênh", dataIndex: "channel", render: (v) => NOTIFICATION_CHANNELS[v as string] ?? String(v) },
    { key: "src", title: "Nguồn", dataIndex: "source", render: (v) => <Tag color={v === "TENANT" ? "blue" : "default"}>{v === "TENANT" ? "Của đơn vị" : "Mặc định"}</Tag> },
    { key: "v", title: "Phiên bản", dataIndex: "version", align: "right" },
    { key: "s", title: "Tiêu đề", dataIndex: "subject" },
    ...(canOpen
      ? [
          actionsColumn(
            (row) => [
              {
                key: "open",
                label: canSave ? "Sửa mẫu" : "Xem mẫu",
                icon: canSave ? <Pencil size={16} /> : <Eye size={16} />,
                onClick: () => setOpen(row as unknown as NotificationTemplate),
              },
            ],
            1,
          ),
        ]
      : []),
  ];
  return (
    <div data-testid="templates-tab">
      <QueryBoundary query={q}>
        {(list) => (
          <DataTable
            columns={columns}
            rows={(Array.isArray(list) ? list : []).map((r) => ({ ...r, _k: `${r.type}:${r.channel}` }))}
            rowKey="_k"
            mobileTitleKey="t"
            empty={{ title: "Chưa có mẫu nào." }}
          />
        )}
      </QueryBoundary>
      {open && <TemplateDialog key={`${open.type}:${open.channel}`} row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
