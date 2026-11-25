import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useSession } from "@/api";
import { App, Button, Card, DataTable, Form, FormModal, Input, InputNumber, Pencil, Plus, QueryBoundary, Switch, Tag, Trash2, actionsColumn, describeError, useFormModal, type DataColumn } from "@/ui";
import { COMPENSATION_ERRORS, pct, type DamageLevel, type DamageLevels } from "../_lib/compensation";

type Values = { code: string; label: string; percent: number; sortOrder: number; active: boolean };

const URL = "/api/circulation/damage-levels";

/** Bảng mức hư hại (tối đa 10 mức/đơn vị): thêm, sửa, tắt/bật, xóa mức chưa từng dùng. */
export function DamageLevelsCard() {
  const s = useSession();
  const { message } = App.useApp();
  const canCreate = can(s, PERMISSIONS.DAMAGE_LEVEL_CREATE);
  const canUpdate = can(s, PERMISSIONS.DAMAGE_LEVEL_UPDATE);
  const canDelete = can(s, PERMISSIONS.DAMAGE_LEVEL_DELETE);
  const q = useApi<DamageLevels>(can(s, PERMISSIONS.DAMAGE_LEVEL_LIST) ? URL : null);

  const form = useFormModal<Values, unknown, DamageLevel | "new">({
    title: (t) => (t && t !== "new" ? `Sửa mức hư hại ${t.code}` : "Thêm mức hư hại"),
    okText: (t) => (t && t !== "new" ? "Lưu" : "Thêm"),
    successMessage: "Đã lưu mức hư hại.",
    invalidate: [URL],
    initialValues: (t) =>
      t && t !== "new"
        ? { code: t.code, label: t.label, percent: Math.round(Number(t.rate) * 10000) / 100, sortOrder: t.sortOrder, active: t.active }
        : { sortOrder: 0, active: true },
    request: async (v, t) => {
      const body = { code: v.code, label: v.label.trim(), rate: Math.round(v.percent * 100) / 10000, sortOrder: v.sortOrder ?? 0, active: v.active };
      if (t && t !== "new") {
        await apiFetch(`${URL}/${encodeURIComponent(t.code)}`, { method: "PUT", json: { ...body, version: t.version } });
      } else {
        await apiFetch(URL, { method: "POST", json: body });
      }
    },
  });
  const editing = form.target && form.target !== "new" ? form.target : undefined;

  return (
    <Card
      title="Mức hư hại"
      extra={
        canCreate && (
          <Button type="primary" icon={<Plus size={16} />} onClick={() => form.openModal("new")} disabled={q.data ? q.data.items.length >= q.data.maxLevels : false}>
            Thêm mức hư hại
          </Button>
        )
      }
    >
      <QueryBoundary query={q}>
        {(data) => {
          const columns: DataColumn[] = [
            { key: "code", title: "Mã", dataIndex: "code", kind: "mono" },
            { key: "label", title: "Tên mức", dataIndex: "label" },
            { key: "rate", title: "Tỷ lệ đền", dataIndex: "rate", align: "right", render: (v) => pct(Number(v)) },
            { key: "sortOrder", title: "Thứ tự", dataIndex: "sortOrder", align: "right" },
            { key: "active", title: "Trạng thái", dataIndex: "active", render: (v) => <Tag color={v ? "success" : "default"}>{v ? "Đang dùng" : "Đã tắt"}</Tag> },
            actionsColumn(
              (r) => {
                const row = r as unknown as DamageLevel;
                return [
                  { key: "edit", label: "Sửa", icon: <Pencil size={16} />, hidden: !canUpdate, onClick: () => form.openModal(row) },
                  {
                    key: "delete",
                    label: "Xóa",
                    icon: <Trash2 size={16} />,
                    danger: true,
                    hidden: !canDelete || !data.custom,
                    confirm: { title: `Xóa mức ${row.code}?`, description: "Chỉ xóa được mức chưa từng dùng; mức đã dùng hãy tắt.", okText: "Xóa" },
                    onClick: async () => {
                      try {
                        await apiFetch(`${URL}/${encodeURIComponent(row.code)}`, { method: "DELETE" });
                        message.success("Đã xóa mức hư hại.");
                        await q.refetch();
                      } catch (e) {
                        message.error(describeError(toErrorInfo(e), COMPENSATION_ERRORS).text);
                      }
                    },
                  },
                ];
              },
              2,
            ),
          ];
          return (
            <div className="flex flex-col gap-3">
              {!data.custom && (
                <p className="m-0 text-sm text-muted">Đơn vị chưa cấu hình riêng nên đang hiện hai mức mặc định. Thêm hoặc sửa một mức sẽ lưu danh sách riêng của đơn vị.</p>
              )}
              <DataTable
                embedded
                rowKey="code"
                rows={data.items as unknown as Record<string, unknown>[]}
                columns={columns}
                mobileTitleKey="label"
                empty={{ title: "Chưa có mức hư hại nào." }}
              />
              <p className="m-0 text-sm text-muted">
                Tối đa {data.maxLevels} mức. Mức đã tắt không chọn được cho khoản mới nhưng vẫn hiển thị ở khoản cũ.
              </p>
            </div>
          );
        }}
      </QueryBoundary>
      <FormModal<Values> {...form.modalProps}>
        <Form.Item name="code" label="Mã" rules={[{ required: true, message: "Nhập mã" }, { pattern: /^[A-Z0-9_]{2,30}$/, message: "2 đến 30 ký tự A-Z, 0-9 hoặc _" }]}>
          <Input maxLength={30} autoComplete="off" disabled={!!editing} />
        </Form.Item>
        <Form.Item name="label" label="Tên mức" rules={[{ required: true, whitespace: true, message: "Nhập tên mức" }]}>
          <Input maxLength={100} autoComplete="off" />
        </Form.Item>
        <Form.Item name="percent" label="Tỷ lệ đền (%)" rules={[{ required: true, message: "Nhập tỷ lệ" }]} extra="0 đến 500%, tính trên giá gốc.">
          <InputNumber className="w-full" min={0} max={500} precision={2} />
        </Form.Item>
        <Form.Item name="sortOrder" label="Thứ tự hiển thị">
          <InputNumber className="w-full" precision={0} />
        </Form.Item>
        <Form.Item name="active" label="Đang dùng" valuePropName="checked">
          <Switch />
        </Form.Item>
      </FormModal>
    </Card>
  );
}
