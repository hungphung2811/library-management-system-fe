import { PERMISSIONS, apiFetch, can, useApi, useInvalidateApi, useSession } from "@/api";
import { App, Button, DataTable, Form, FormModal, Input, InputNumber, Pencil, PlusOutlined, QueryBoundary, Switch, Tag, Trash2, actionsColumn, dayjs, DatePicker, formatDateTime, type DataColumn, useFormModal } from "@/ui";
import { SalesGate } from "./_components/SalesGate";

type BannerStatus = "INACTIVE" | "SCHEDULED" | "LIVE" | "EXPIRED";
type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  linkPath: string | null;
  sortOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  status: BannerStatus;
  version: number;
};
type FormValues = { title: string; subtitle?: string; linkPath?: string; sortOrder?: number; active?: boolean; range?: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null };

const STATUS: Record<BannerStatus, { text: string; color?: string }> = {
  LIVE: { text: "Đang hiển thị", color: "green" },
  SCHEDULED: { text: "Chờ hiển thị", color: "blue" },
  EXPIRED: { text: "Đã hết hạn" },
  INACTIVE: { text: "Đã tắt" },
};
const LIMIT = 20;
// Khớp luật BE (INVALID_BANNER): bắt đầu bằng đúng một "/", không scheme, không "//", "\", "..", khoảng trắng.
const LINK_RE = /^\/(?!\/)[A-Za-z0-9\-._~/?#=&+,%]*$/;

const body = (v: FormValues) => ({
  title: v.title.trim(),
  subtitle: v.subtitle?.trim() || null,
  linkPath: v.linkPath?.trim() || null,
  sortOrder: v.sortOrder ?? 0,
  active: v.active ?? true,
  startsAt: v.range?.[0] ? v.range[0].toISOString() : null,
  endsAt: v.range?.[1] ? v.range[1].toISOString() : null,
});

export default function BannersPage() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.BANNER_LIST);
  const q = useApi<Banner[]>(allowed ? "/api/sales/banners" : null);
  const canUpdate = can(s, PERMISSIONS.BANNER_UPDATE);
  const canDelete = can(s, PERMISSIONS.BANNER_DELETE);
  const form = useFormModal<FormValues, unknown, Banner>({
    title: (b) => (b ? "Sửa banner" : "Thêm banner"),
    okText: (b) => (b ? "Lưu" : "Tạo"),
    invalidate: ["/api/sales/banners"],
    initialValues: (b) =>
      b
        ? { title: b.title, subtitle: b.subtitle ?? "", linkPath: b.linkPath ?? "", sortOrder: b.sortOrder, active: b.active, range: [b.startsAt ? dayjs(b.startsAt) : null, b.endsAt ? dayjs(b.endsAt) : null] }
        : { sortOrder: 0, active: true },
    request: (v, b) =>
      b
        ? apiFetch(`/api/sales/banners/${encodeURIComponent(b.id)}`, { method: "PUT", json: { ...body(v), version: b.version } })
        : apiFetch("/api/sales/banners", { method: "POST", json: body(v) }),
  });
  const remove = useApiRemove();

  const columns: DataColumn[] = [
    { key: "sortOrder", title: "Thứ tự", dataIndex: "sortOrder", width: 80 },
    {
      key: "title",
      title: "Banner",
      dataIndex: "title",
      render: (_, r) => (
        <div className="min-w-0">
          <div className="font-medium">{String(r.title)}</div>
          {r.subtitle ? <div className="text-sm text-muted">{String(r.subtitle)}</div> : null}
        </div>
      ),
    },
    { key: "linkPath", title: "Liên kết", dataIndex: "linkPath", kind: "mono" },
    {
      key: "status",
      title: "Trạng thái",
      dataIndex: "status",
      render: (v) => {
        const st = STATUS[v as BannerStatus] ?? { text: String(v) };
        return <Tag color={st.color}>{st.text}</Tag>;
      },
    },
    { key: "startsAt", title: "Bắt đầu", dataIndex: "startsAt", render: (v) => (v ? formatDateTime(v as string) : "—") },
    { key: "endsAt", title: "Kết thúc", dataIndex: "endsAt", render: (v) => (v ? formatDateTime(v as string) : "—") },
    actionsColumn(
      (r) => {
        const b = r as unknown as Banner;
        return [
          { key: "edit", label: "Sửa", icon: <Pencil size={16} />, hidden: !canUpdate, onClick: () => form.openModal(b) },
          {
            key: "delete",
            label: "Xóa",
            icon: <Trash2 size={16} />,
            danger: true,
            hidden: !canDelete,
            confirm: { title: "Xóa banner này?", description: "Banner sẽ biến mất khỏi trang chủ cửa hàng sau tối đa khoảng 90 giây.", okText: "Xóa" },
            onClick: () => remove(b),
          },
        ];
      },
      2,
    ),
  ];

  return (
    <SalesGate
      title="Banner cửa hàng"
      description={`Banner trang chủ cửa hàng online (tối đa ${LIMIT}). Thay đổi hiện ra chậm tối đa khoảng 90 giây.`}
      permission={PERMISSIONS.BANNER_LIST}
      actions={
        can(s, PERMISSIONS.BANNER_CREATE) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => form.openModal()}>
            Thêm banner
          </Button>
        )
      }
    >
      <QueryBoundary query={q}>
        {(items) => (
          <DataTable
            columns={columns}
            rows={items as unknown as Record<string, unknown>[]}
            rowKey="id"
            mobileTitleKey="title"
            pagination={{ mode: "client", pageSize: 20 }}
            empty={{ title: "Chưa có banner nào." }}
          />
        )}
      </QueryBoundary>
      <FormModal<FormValues> {...form.modalProps} successMessage={form.target ? "Đã cập nhật banner." : "Đã thêm banner."}>
        <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: "Nhập tiêu đề" }, { max: 100, message: "Tối đa 100 ký tự" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="subtitle" label="Phụ đề" rules={[{ max: 200, message: "Tối đa 200 ký tự" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="linkPath"
          label="Đường dẫn liên kết"
          extra="Tương đối với trang cửa hàng, bắt đầu bằng một dấu /, ví dụ /books?sort=newest. Không dùng URL đầy đủ."
          rules={[
            { max: 200, message: "Tối đa 200 ký tự" },
            { validator: (_, v) => (!v || LINK_RE.test(String(v).trim()) ? Promise.resolve() : Promise.reject(new Error("Đường dẫn không hợp lệ (phải bắt đầu bằng / và không chứa URL đầy đủ)"))) },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item name="sortOrder" label="Thứ tự hiển thị" extra="0 đến 999, nhỏ hiện trước.">
            <InputNumber className="w-full" min={0} max={999} precision={0} />
          </Form.Item>
          <Form.Item name="active" label="Bật banner" valuePropName="checked">
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>
        </div>
        <Form.Item name="range" label="Thời gian hiển thị" extra="Để trống thì hiển thị không giới hạn thời gian.">
          <DatePicker.RangePicker className="w-full" showTime format="DD/MM/YYYY HH:mm" allowEmpty={[true, true]} />
        </Form.Item>
      </FormModal>
    </SalesGate>
  );
}

function useApiRemove() {
  // RowActions hiện lỗi nếu ném; ở đây gọi API, tải lại danh sách và báo thành công.
  const invalidate = useInvalidateApi();
  const { message } = App.useApp();
  return async (b: Banner) => {
    await apiFetch(`/api/sales/banners/${encodeURIComponent(b.id)}`, { method: "DELETE" });
    await invalidate("/api/sales/banners");
    message.success("Đã xóa banner.");
  };
}
