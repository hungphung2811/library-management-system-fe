import { usePageSize } from "@/ui";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, useApi, useSession } from "@/api";
import {
  Button,
  Checkbox,
  DataTable,
  Drawer,
  EXCEL_IMPORTS,
  ExcelImportButton,
  Form,
  FormModal,
  Input,
  InputNumber,
  BookOpenText,
  ClipboardCheck,
  Pencil,
  SlidersHorizontal,
  PlusOutlined,
  QueryBoundary,
  RemoteSelect,
  Tag,
  actionsColumn,
  formatDate,
  formatMoney,
  Eye,
  type DataColumn,
  type Opt,
  useFormModal,
} from "@/ui";
import { MoneyInput } from "./_components/MoneyInput";
import { StockDetailFields, detailsBody, type StockDetailValues } from "./_components/StockDetailFields";
import { StockDetailsModal } from "./_components/StockDetailsModal";
import { SalesGate } from "./_components/SalesGate";
import { LEDGER_TYPES, bookLabel, label, pageParams, searchBooks, type LedgerEntry, type Page, type StockItem } from "./_lib/sales";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asRows = <T,>(items: T[]) => items as unknown as Record<string, unknown>[];

function RegisterButton() {
  const s = useSession();
  const canSearch = can(s, PERMISSIONS.BOOK_SEARCH);
  const canDetails = can(s, PERMISSIONS.STOCK_DETAILS_VIEW);
  type RegisterValues = StockDetailValues & { title?: Opt; titleId?: string; sellingPrice?: number | null; lowStockThreshold?: number | null };
  const form = useFormModal<RegisterValues>({
    title: "Đăng ký đầu sách để bán",
    okText: "Đăng ký",
    successMessage: "Đã đăng ký mặt hàng.",
    invalidate: ["/api/sales/stock-items"],
    request: (v) =>
      apiFetch("/api/sales/stock-items", {
        method: "POST",
        json: {
          titleId: v.title?.value ?? v.titleId?.trim(),
          sellingPrice: v.sellingPrice ?? null,
          lowStockThreshold: v.lowStockThreshold ?? null,
          ...detailsBody(v, canDetails),
        },
      }),
  });
  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => form.openModal()}>
        Đăng ký mặt hàng
      </Button>
      <FormModal<RegisterValues> {...form.modalProps}>
        {canSearch ? (
          <Form.Item name="title" label="Đầu sách" rules={[{ required: true, message: "Chọn đầu sách" }]}>
            <RemoteSelect
              placeholder="Gõ tên sách, tác giả hoặc ISBN"
              fetcher={async (q) => (await searchBooks(q)).slice(0, 30).map((b) => ({ value: b.id, label: bookLabel(b) }))}
            />
          </Form.Item>
        ) : (
          <Form.Item
            name="titleId"
            label="Mã đầu sách (UUID)"
            rules={[{ required: true, pattern: UUID_RE, message: "Nhập mã đầu sách hợp lệ" }]}
            extra="Bạn chưa có quyền tra cứu sách nên cần nhập mã đầu sách."
          >
            <Input autoComplete="off" />
          </Form.Item>
        )}
        <Form.Item name="sellingPrice" label="Giá bán" extra="Để trống thì dùng giá bìa.">
          <MoneyInput />
        </Form.Item>
        <Form.Item name="lowStockThreshold" label="Ngưỡng sắp hết hàng" extra="Để trống thì dùng ngưỡng chung trong cấu hình.">
          <InputNumber className="w-full" min={0} max={100000} precision={0} />
        </Form.Item>
        <StockDetailFields showSensitive={canDetails} />
      </FormModal>
    </>
  );
}

function LedgerDrawer({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const q = useApi<Page<LedgerEntry>>(item ? `/api/sales/stock-items/${encodeURIComponent(item.titleId)}/ledger?page=0&size=100` : null);
  const columns: DataColumn[] = [
    { key: "t", title: "Thời điểm", dataIndex: "occurredAt", kind: "datetime" },
    { key: "type", title: "Loại", dataIndex: "type", render: (v) => label(LEDGER_TYPES, v as string) },
    {
      key: "d",
      title: "Thay đổi tồn",
      dataIndex: "deltaOnHand",
      align: "right",
      render: (v, r) => {
        const on = Number(v);
        const rs = Number(r.deltaReserved);
        return (
          <span>
            {on > 0 ? `+${on}` : on}
            {rs !== 0 ? ` (giữ ${rs > 0 ? "+" : ""}${rs})` : ""}
          </span>
        );
      },
    },
    { key: "reason", title: "Lý do", dataIndex: "reason" },
  ];
  return (
    <Drawer open={!!item} onClose={onClose} size="large" title={`Sổ cái tồn kho: ${item?.titleName ?? ""}`}>
      {item && (
        <QueryBoundary query={q}>
          {(p) => (
            <>
              <p className="mt-0 text-sm text-muted">100 biến động gần nhất, mới nhất trước.</p>
              <DataTable
                columns={columns}
                rows={asRows(p.items)}
                rowKey="id"
                pagination={{ mode: "client", pageSize: 10 }}
                empty={{ title: "Chưa có biến động nào." }}
              />
            </>
          )}
        </QueryBoundary>
      )}
    </Drawer>
  );
}

export default function StockPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const SIZE = usePageSize();
  const low = sp.get("low") === "1";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const allowed = can(s, PERMISSIONS.STOCK_SEARCH);
  const q = useApi<Page<StockItem>>(allowed ? `/api/sales/stock-items?${pageParams(sp, SIZE, { lowStockOnly: low ? "true" : undefined })}` : null);
  const priceForm = useFormModal<{ sellingPrice?: number | null }, unknown, StockItem>({
    title: (it) => `Sửa giá bán: ${it?.titleName ?? ""}`,
    successMessage: "Đã cập nhật giá bán.",
    initialValues: (it) => ({ sellingPrice: it?.sellingPrice ?? null }),
    invalidate: ["/api/sales/stock-items"],
    request: (v, it) =>
      apiFetch(`/api/sales/stock-items/${encodeURIComponent(it!.titleId)}/price`, {
        method: "PUT",
        json: { sellingPrice: v.sellingPrice ?? null },
      }),
  });
  const adjustForm = useFormModal<{ delta?: number; counted?: number; reason: string }, unknown, { item: StockItem; mode: "adjust" | "stocktake" }>({
    title: (t) => `${t?.mode === "stocktake" ? "Kiểm kho" : "Điều chỉnh tồn kho"}: ${t?.item.titleName ?? ""}`,
    okText: (t) => (t?.mode === "stocktake" ? "Ghi kết quả kiểm kho" : "Điều chỉnh"),
    invalidate: ["/api/sales/stock-items"],
    request: (v, t) => {
      const titleId = t!.item.titleId;
      return t!.mode === "adjust"
        ? apiFetch("/api/sales/stock-adjustments", { method: "POST", json: { titleId, delta: v.delta, reason: v.reason.trim() } })
        : apiFetch("/api/sales/stocktakes", { method: "POST", json: { titleId, countedOnHand: v.counted, reason: v.reason.trim() } });
    },
  });
  const adjustMode = adjustForm.target?.mode ?? "adjust";
  const [ledger, setLedger] = useState<StockItem | null>(null);
  const [details, setDetails] = useState<StockItem | null>(null);
  const canPrice = can(s, PERMISSIONS.STOCK_UPDATE_PRICE);
  const canAdjust = can(s, PERMISSIONS.STOCK_ADJUST);
  const canTake = can(s, PERMISSIONS.STOCK_STOCKTAKE);
  const canLedger = can(s, PERMISSIONS.STOCK_LEDGER);

  const columns: DataColumn[] = [
    { key: "name", title: "Mặt hàng", dataIndex: "titleName", render: (v, r) => (v as string) || <span className="font-mono">{String(r.titleId).slice(0, 8)}</span> },
    { key: "onHand", title: "Tồn", dataIndex: "onHand", align: "right" },
    { key: "reserved", title: "Đang giữ", dataIndex: "reserved", align: "right" },
    {
      key: "available",
      title: "Khả dụng",
      dataIndex: "available",
      align: "right",
      render: (v, r) => (
        <span>
          {String(v)} {r.lowStock ? <Tag color="orange">Sắp hết</Tag> : null}
          {r.reorderQuantity != null && Number(r.onHand) <= Number(r.reorderQuantity) ? (
            <span data-testid="reorder-flag"><Tag color="red">Cần đặt lại</Tag></span>
          ) : null}
        </span>
      ),
    },
    { key: "sku", title: "SKU", dataIndex: "sku", kind: "mono", render: (v) => (v as string) || "—" },
    { key: "supplier", title: "Nhà cung cấp", dataIndex: "supplier", render: (v) => (v as string) || "—" },
    { key: "bin", title: "Vị trí kho", dataIndex: "binLocation", render: (v) => (v as string) || "—" },
    {
      key: "restocked",
      title: "Nhập gần nhất",
      dataIndex: "lastRestockedAt",
      render: (v) => (v ? formatDate(v as string) : "—"),
    },
    {
      key: "price",
      title: "Giá bán",
      dataIndex: "effectivePrice",
      align: "right",
      render: (v, r) =>
        v == null ? (
          "—"
        ) : (
          <span>
            {formatMoney(v as number)}
            {r.sellingPrice == null ? <span className="text-muted"> (giá bìa)</span> : null}
          </span>
        ),
    },
    actionsColumn(
      (r) => {
        const it = r as unknown as StockItem;
        return [
          { key: "details", label: "Chi tiết", icon: <Eye size={16} />, onClick: () => setDetails(it) },
          { key: "price", label: "Sửa giá", icon: <Pencil size={16} />, hidden: !canPrice, onClick: () => priceForm.openModal(it) },
          { key: "adjust", label: "Điều chỉnh", icon: <SlidersHorizontal size={16} />, hidden: !canAdjust, onClick: () => adjustForm.openModal({ item: it, mode: "adjust" }) },
          { key: "take", label: "Kiểm kho", icon: <ClipboardCheck size={16} />, hidden: !canTake, onClick: () => adjustForm.openModal({ item: it, mode: "stocktake" }) },
          { key: "ledger", label: "Sổ cái", icon: <BookOpenText size={16} />, hidden: !canLedger, onClick: () => setLedger(it) },
        ];
      },
      5,
    ),
  ];

  return (
    <SalesGate
      title="Tồn kho"
      description="Mặt hàng đang bán, số tồn và biến động."
      permission={PERMISSIONS.STOCK_SEARCH}
      actions={
        <>
          <ExcelImportButton cfg={EXCEL_IMPORTS["stock-items"]} />
          {can(s, PERMISSIONS.STOCK_REGISTER) && <RegisterButton />}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Checkbox
          checked={low}
          onChange={(e) => {
            const n = new URLSearchParams(sp);
            if (e.target.checked) n.set("low", "1");
            else n.delete("low");
            n.delete("page");
            setSp(n, { replace: true });
          }}
        >
          Chỉ hiện hàng sắp hết
        </Checkbox>
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={asRows(p.items)}
              rowKey="titleId"
              mobileTitleKey="name"
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: low ? "Không có mặt hàng nào sắp hết." : "Chưa có mặt hàng nào.", hint: low ? undefined : "Đăng ký đầu sách để bắt đầu bán." }}
            />
          )}
        </QueryBoundary>
      </div>
      <FormModal<{ sellingPrice?: number | null }> {...priceForm.modalProps}>
        <Form.Item name="sellingPrice" label="Giá bán" extra="Để trống để quay về giá bìa.">
          <MoneyInput />
        </Form.Item>
      </FormModal>
      <FormModal<{ delta?: number; counted?: number; reason: string }>
        {...adjustForm.modalProps}
        successMessage={adjustMode === "adjust" ? "Đã điều chỉnh tồn kho." : "Đã ghi kết quả kiểm kho."}
      >
      <p className="mt-0 text-sm text-muted">
        Hiện có {adjustForm.target?.item.onHand ?? 0} (đang giữ {adjustForm.target?.item.reserved ?? 0}, khả dụng {adjustForm.target?.item.available ?? 0}).
      </p>
      {adjustMode === "adjust" ? (
        <Form.Item
          name="delta"
          label="Số lượng thay đổi (âm để giảm)"
          rules={[
            { required: true, message: "Nhập số lượng thay đổi" },
            { validator: async (_, v) => (v === 0 ? Promise.reject(new Error("Số lượng thay đổi phải khác 0")) : undefined) },
          ]}
        >
          <InputNumber className="w-full" precision={0} />
        </Form.Item>
      ) : (
        <Form.Item
          name="counted"
          label="Số lượng đếm được"
          rules={[
            { required: true, message: "Nhập số lượng đếm được" },
            {
              validator: async (_, v) =>
                typeof v === "number" && adjustForm.target && v < adjustForm.target.item.reserved
                  ? Promise.reject(new Error(`Không thể nhỏ hơn số đang giữ (${adjustForm.target?.item.reserved})`))
                  : undefined,
            },
          ]}
        >
          <InputNumber className="w-full" min={0} precision={0} />
        </Form.Item>
      )}
      <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: "Nhập lý do" }]}>
        <Input.TextArea rows={2} maxLength={500} showCount />
      </Form.Item>
      </FormModal>
      <StockDetailsModal item={details} onClose={() => setDetails(null)} />
      <LedgerDrawer item={ledger} onClose={() => setLedger(null)} />
    </SalesGate>
  );
}
