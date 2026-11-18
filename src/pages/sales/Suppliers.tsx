import { usePageSize } from "@/ui";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useInvalidateApi, useSession } from "@/api";
import { App, Button, DataTable, Form, FormModal, Input, Pencil, PlusOutlined, QueryBoundary, SearchBar, Switch, Tag, actionsColumn, describeError, type DataColumn, useFormModal } from "@/ui";
import { SalesGate } from "./_components/SalesGate";
import { pageParams, type Page, type Supplier } from "./_lib/sales";

type FormValues = { name: string; phone?: string; email?: string; address?: string; note?: string; active?: boolean };

const body = (v: FormValues) => ({
  name: v.name.trim(),
  phone: v.phone?.trim() || null,
  email: v.email?.trim() || null,
  address: v.address?.trim() || null,
  note: v.note?.trim() || null,
});

export default function SuppliersPage() {
  const s = useSession();
  const { message } = App.useApp();
  const invalidate = useInvalidateApi();
  const [sp] = useSearchParams();
  const SIZE = usePageSize();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const kw = (sp.get("q") ?? "").trim();
  const allowed = can(s, PERMISSIONS.SUPPLIER_SEARCH);
  const q = useApi<Page<Supplier>>(allowed ? `/api/sales/suppliers?${pageParams(sp, SIZE, { keyword: kw })}` : null);
  const form = useFormModal<FormValues, unknown, Supplier>({
    title: (sup) => (sup ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"),
    okText: (sup) => (sup ? "Lưu" : "Tạo"),
    invalidate: ["/api/sales/suppliers"],
    initialValues: (sup) => (sup ? { name: sup.name, phone: sup.phone ?? "", email: sup.email ?? "", address: sup.address ?? "", note: sup.note ?? "" } : {}),
    request: (v, sup) =>
      sup
        ? apiFetch(`/api/sales/suppliers/${encodeURIComponent(sup.id)}`, { method: "PUT", json: { ...body(v), active: sup.active } })
        : apiFetch("/api/sales/suppliers", { method: "POST", json: body(v) }),
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const canUpdate = can(s, PERMISSIONS.SUPPLIER_UPDATE);

  const toggle = async (sup: Supplier, active: boolean) => {
    setBusyId(sup.id);
    try {
      await apiFetch(`/api/sales/suppliers/${encodeURIComponent(sup.id)}`, { method: "PUT", json: { ...body(sup as unknown as FormValues), active } });
      await invalidate("/api/sales/suppliers");
      message.success(active ? "Đã bật nhà cung cấp." : "Đã tắt nhà cung cấp.");
    } catch (e) {
      message.error(describeError(toErrorInfo(e)).text);
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataColumn[] = [
    { key: "name", title: "Nhà cung cấp", dataIndex: "name" },
    { key: "phone", title: "Điện thoại", dataIndex: "phone" },
    { key: "email", title: "Email", dataIndex: "email" },
    { key: "address", title: "Địa chỉ", dataIndex: "address" },
    {
      key: "active",
      title: "Trạng thái",
      dataIndex: "active",
      render: (v, r) =>
        canUpdate ? (
          <Switch
            checked={v as boolean}
            loading={busyId === r.id}
            checkedChildren="Bật"
            unCheckedChildren="Tắt"
            aria-label={`Bật/tắt nhà cung cấp ${String(r.name)}`}
            onChange={(c) => void toggle(r as unknown as Supplier, c)}
          />
        ) : v ? (
          <Tag color="green">Đang hoạt động</Tag>
        ) : (
          <Tag>Đã tắt</Tag>
        ),
    },
    actionsColumn(
      (r) => [{ key: "edit", label: "Sửa", icon: <Pencil size={16} />, hidden: !canUpdate, onClick: () => form.openModal(r as unknown as Supplier) }],
      1,
    ),
  ];

  return (
    <SalesGate
      title="Nhà cung cấp"
      description="Nơi nhập sách về kho bán."
      permission={PERMISSIONS.SUPPLIER_SEARCH}
      actions={
        can(s, PERMISSIONS.SUPPLIER_CREATE) ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => form.openModal()}>
            Thêm nhà cung cấp
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <SearchBar placeholder="Tìm theo tên nhà cung cấp" />
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              mobileTitleKey="name"
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: kw ? `Không tìm thấy nhà cung cấp cho «${kw}».` : "Chưa có nhà cung cấp nào." }}
            />
          )}
        </QueryBoundary>
      </div>
      <FormModal<FormValues> {...form.modalProps} successMessage={form.target ? "Đã cập nhật nhà cung cấp." : "Đã thêm nhà cung cấp."}>
      <Form.Item name="name" label="Tên nhà cung cấp" rules={[{ required: true, whitespace: true, message: "Nhập tên nhà cung cấp" }, { max: 200 }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="phone" label="Điện thoại" rules={[{ max: 30, message: "Tối đa 30 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Email không hợp lệ" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="address" label="Địa chỉ">
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="note" label="Ghi chú">
        <Input.TextArea rows={2} maxLength={1000} />
      </Form.Item>
      </FormModal>
    </SalesGate>
  );
}
