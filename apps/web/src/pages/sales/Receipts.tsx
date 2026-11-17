import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, useApi, useInvalidateApi, useSession } from "@/api";
import { useTitleNames } from "@/pages/circulation/_lib/hooks";
import {
  Alert,
  Button,
  ConfirmAction,
  DataTable,
  DeleteOutlined,
  Drawer,
  Form,
  FormModal,
  InputNumber,
  PlusOutlined,
  QueryBoundary,
  RemoteSelect,
  Select,
  Tag,
  formatDateTime,
  formatMoney,
  type DataColumn,
  type Opt,
} from "@/ui";
import { MoneyInput } from "./_components/MoneyInput";
import { SalesGate } from "./_components/SalesGate";
import {
  RECEIPT_STATUS,
  bookLabel,
  label,
  newRequestId,
  pageParams,
  searchBooks,
  type GoodsReceipt,
  type Page,
  type Supplier,
} from "./_lib/sales";

const SIZE = 20;
const asRows = <T,>(items: T[]) => items as unknown as Record<string, unknown>[];
const STATUS_COLOR: Record<string, string> = { DRAFT: "gold", CONFIRMED: "green", CANCELLED: "default" };

function useSupplierNames(enabled: boolean) {
  const q = useApi<Page<Supplier>>(enabled ? "/api/sales/suppliers?page=0&size=100" : null);
  const items = q.data?.items ?? [];
  const names = useMemo(() => Object.fromEntries(items.map((x) => [x.id, x.name])), [items]);
  return { suppliers: items, names };
}

type CreateValues = { supplierId?: string; lines: { title?: Opt; quantity?: number; unitCost?: number | null }[] };

function CreateReceipt({ suppliers, canPickSupplier, onClose, open }: { suppliers: Supplier[]; canPickSupplier: boolean; onClose: () => void; open: boolean }) {
  const invalidate = useInvalidateApi();
  // clientRequestId cố định trong một lần mở hộp thoại: bấm Tạo lại sau lỗi mạng không tạo phiếu thứ hai.
  const reqId = useRef(newRequestId());
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) reqId.current = newRequestId();
  wasOpen.current = open;
  return (
    <FormModal<CreateValues>
      open={open}
      title="Tạo phiếu nhập (nháp)"
      okText="Tạo phiếu nháp"
      successMessage="Đã tạo phiếu nhập nháp. Xác nhận phiếu để cộng tồn kho."
      onCancel={onClose}
      initialValues={{ lines: [{}] }}
      onSubmit={async (v) => {
        await apiFetch("/api/sales/goods-receipts", {
          method: "POST",
          json: {
            supplierId: v.supplierId,
            lines: v.lines.map((l) => ({ titleId: l.title?.value, quantity: l.quantity, unitCost: l.unitCost ?? 0 })),
            clientRequestId: reqId.current,
          },
        });
        await invalidate("/api/sales/goods-receipts");
      }}
    >
      <Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true, message: "Chọn nhà cung cấp" }]}>
        <Select
          showSearch={{ optionFilterProp: "label" }}
          placeholder={canPickSupplier ? "Chọn nhà cung cấp" : "Bạn chưa có quyền xem danh sách nhà cung cấp"}
          disabled={!canPickSupplier}
          options={suppliers.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name }))}
        />
      </Form.Item>
      <Form.List name="lines">
        {(fields, { add, remove }) => (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-ink">Dòng nhập</div>
            {fields.map((f) => (
              <div key={f.key} className="grid grid-cols-1 gap-2 rounded-card border border-line p-2 sm:grid-cols-[1fr_90px_140px_auto]">
                <Form.Item name={[f.name, "title"]} label="Đầu sách" className="mb-0!" rules={[{ required: true, message: "Chọn đầu sách" }]}>
                  <RemoteSelect
                    placeholder="Gõ tên sách hoặc ISBN"
                    fetcher={async (q) => (await searchBooks(q)).slice(0, 30).map((b) => ({ value: b.id, label: bookLabel(b) }))}
                  />
                </Form.Item>
                <Form.Item name={[f.name, "quantity"]} label="Số lượng" className="mb-0!" rules={[{ required: true, message: "Nhập số lượng" }]}>
                  <InputNumber className="w-full" min={1} max={100000} precision={0} />
                </Form.Item>
                <Form.Item name={[f.name, "unitCost"]} label="Giá nhập" className="mb-0!" rules={[{ required: true, message: "Nhập giá nhập" }]}>
                  <MoneyInput />
                </Form.Item>
                <Form.Item label=" " className="mb-0!">
                  <Button aria-label="Xóa dòng" icon={<DeleteOutlined />} disabled={fields.length <= 1} onClick={() => remove(f.name)} />
                </Form.Item>
              </div>
            ))}
            <Button icon={<PlusOutlined />} onClick={() => add({})} disabled={fields.length >= 200}>
              Thêm dòng
            </Button>
          </div>
        )}
      </Form.List>
    </FormModal>
  );
}

function ReceiptDrawer({ id, row, supplierName, onClose }: { id: string | null; row: GoodsReceipt | null; supplierName: string; onClose: () => void }) {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const canView = can(s, PERMISSIONS.RECEIPT_VIEW);
  const q = useApi<GoodsReceipt>(id && canView ? `/api/sales/goods-receipts/${encodeURIComponent(id)}` : null);
  const r = q.data ?? row;
  const names = useTitleNames(r?.lines.map((l) => l.titleId) ?? [], can(s, PERMISSIONS.BOOK_VIEW));
  const act = async (verb: "confirmation" | "cancellation") => {
    await apiFetch(`/api/sales/goods-receipts/${encodeURIComponent(id!)}/${verb}`, { method: "POST" });
    await invalidate("/api/sales/goods-receipts", "/api/sales/stock-items");
    if (verb === "cancellation") onClose();
  };
  const columns: DataColumn[] = [
    { key: "t", title: "Đầu sách", dataIndex: "titleId", render: (v, l) => (l.titleName as string) || names.data?.[v as string] || String(v).slice(0, 8) },
    { key: "q", title: "Số lượng", dataIndex: "quantity", align: "right" },
    { key: "c", title: "Giá nhập", dataIndex: "unitCost", kind: "money", align: "right" },
    { key: "lc", title: "Thành tiền", dataIndex: "lineCost", kind: "money", align: "right" },
  ];
  return (
    <Drawer open={!!id} onClose={onClose} size="large" title={r ? `Phiếu nhập ${r.receiptNo}` : "Phiếu nhập"}>
      {r && (
        <div className="flex flex-col gap-4" data-testid="receipt-detail">
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Trạng thái</dt>
            <dd className="m-0">
              <Tag color={STATUS_COLOR[r.status]}>{label(RECEIPT_STATUS, r.status)}</Tag>
            </dd>
            <dt className="text-muted">Nhà cung cấp</dt>
            <dd className="m-0">{r.supplierName || supplierName}</dd>
            <dt className="text-muted">Tạo lúc</dt>
            <dd className="m-0">{formatDateTime(r.createdAt)}</dd>
            {r.confirmedAt && (
              <>
                <dt className="text-muted">Xác nhận lúc</dt>
                <dd className="m-0">{formatDateTime(r.confirmedAt)}</dd>
              </>
            )}
            <dt className="text-muted">Tổng giá nhập</dt>
            <dd className="m-0 font-semibold">{formatMoney(r.totalCost)}</dd>
          </dl>
          <DataTable columns={columns} rows={asRows(r.lines)} rowKey="titleId" empty={{ title: "Phiếu không có dòng nào." }} />
          {r.status === "DRAFT" && (
            <div className="flex flex-wrap gap-2">
              {can(s, PERMISSIONS.RECEIPT_CONFIRM) && (
                <ConfirmAction
                  title="Xác nhận phiếu nhập?"
                  description="Tồn kho sẽ được cộng ngay và không hoàn tác được."
                  okText="Xác nhận nhập kho"
                  onConfirm={() => act("confirmation")}
                >
                  <Button type="primary">Xác nhận nhập kho</Button>
                </ConfirmAction>
              )}
              {can(s, PERMISSIONS.RECEIPT_CANCEL) && (
                <ConfirmAction title="Hủy phiếu nháp này?" okText="Hủy phiếu" danger onConfirm={() => act("cancellation")}>
                  <Button danger>Hủy phiếu</Button>
                </ConfirmAction>
              )}
            </div>
          )}
          {r.status === "CONFIRMED" && <Alert type="success" showIcon title="Phiếu đã xác nhận, tồn kho đã được cộng." />}
        </div>
      )}
    </Drawer>
  );
}

export default function ReceiptsPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const status = sp.get("status") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const allowed = can(s, PERMISSIONS.RECEIPT_SEARCH);
  const q = useApi<Page<GoodsReceipt>>(allowed ? `/api/sales/goods-receipts?${pageParams(sp, SIZE, { status })}` : null);
  const canSup = can(s, PERMISSIONS.SUPPLIER_SEARCH);
  const { suppliers, names } = useSupplierNames(canSup);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const columns: DataColumn[] = [
    {
      key: "no",
      title: "Số phiếu",
      dataIndex: "receiptNo",
      render: (v, r) => (
        <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-mono font-medium text-primary hover:underline" onClick={() => setOpenId(String(r.id))}>
          {String(v)}
        </button>
      ),
    },
    { key: "sup", title: "Nhà cung cấp", dataIndex: "supplierId", render: (v, r) => (r.supplierName as string) || names[v as string] || String(v).slice(0, 8) },
    { key: "st", title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={STATUS_COLOR[v as string]}>{label(RECEIPT_STATUS, v as string)}</Tag> },
    { key: "total", title: "Tổng giá nhập", dataIndex: "totalCost", kind: "money", align: "right" },
    { key: "at", title: "Tạo lúc", dataIndex: "createdAt", kind: "datetime" },
  ];

  const current = q.data?.items.find((x) => x.id === openId) ?? null;
  return (
    <SalesGate
      title="Phiếu nhập kho"
      description="Nhập sách từ nhà cung cấp vào kho bán; xác nhận phiếu để cộng tồn."
      permission={PERMISSIONS.RECEIPT_SEARCH}
      actions={
        can(s, PERMISSIONS.RECEIPT_CREATE) ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Tạo phiếu nhập
          </Button>
        ) : undefined
      }
    >
      <div className="flex max-w-[1200px] flex-col gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="receipt-status" className="text-sm font-medium text-ink">
            Trạng thái
          </label>
          <Select
            id="receipt-status"
            className="w-48"
            value={status}
            onChange={(v) => {
              const n = new URLSearchParams(sp);
              if (v) n.set("status", v);
              else n.delete("status");
              n.delete("page");
              setSp(n, { replace: true });
            }}
            options={[{ value: "", label: "Tất cả" }, ...Object.entries(RECEIPT_STATUS).map(([value, l]) => ({ value, label: l }))]}
          />
        </div>
        <QueryBoundary query={q}>
          {(p) => (
              <DataTable
                columns={columns}
                rows={asRows(p.items)}
                rowKey="id"
                mobileTitleKey="no"
                pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
                empty={{ title: "Chưa có phiếu nhập nào." }}
              />
          )}
        </QueryBoundary>
      </div>
      <CreateReceipt open={creating} suppliers={suppliers} canPickSupplier={canSup} onClose={() => setCreating(false)} />
      <ReceiptDrawer id={openId} row={current} supplierName={current ? names[current.supplierId] ?? current.supplierId.slice(0, 8) : ""} onClose={() => setOpenId(null)} />
    </SalesGate>
  );
}
