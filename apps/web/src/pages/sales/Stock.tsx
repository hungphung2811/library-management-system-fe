import { useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, useApi, useInvalidateApi, useSession } from "@/api";
import {
  Button,
  Checkbox,
  DataTable,
  Drawer,
  Form,
  FormModal,
  Input,
  InputNumber,
  PlusOutlined,
  QueryBoundary,
  RemoteSelect,
  Tag,
  formatMoney,
  type DataColumn,
  type Opt,
} from "@/ui";
import { MoneyInput } from "./_components/MoneyInput";
import { SalesGate } from "./_components/SalesGate";
import { LEDGER_TYPES, bookLabel, label, pageParams, searchBooks, type LedgerEntry, type Page, type StockItem } from "./_lib/sales";

const SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asRows = <T,>(items: T[]) => items as unknown as Record<string, unknown>[];

function RegisterButton() {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const [open, setOpen] = useState(false);
  const canSearch = can(s, PERMISSIONS.BOOK_SEARCH);
  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        Đăng ký mặt hàng
      </Button>
      <FormModal<{ title?: Opt; titleId?: string; sellingPrice?: number | null; lowStockThreshold?: number | null }>
        open={open}
        title="Đăng ký đầu sách để bán"
        okText="Đăng ký"
        successMessage="Đã đăng ký mặt hàng."
        onCancel={() => setOpen(false)}
        onSubmit={async (v) => {
          await apiFetch("/api/sales/stock-items", {
            method: "POST",
            json: {
              titleId: v.title?.value ?? v.titleId?.trim(),
              sellingPrice: v.sellingPrice ?? null,
              lowStockThreshold: v.lowStockThreshold ?? null,
            },
          });
          await invalidate("/api/sales/stock-items");
        }}
      >
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
      </FormModal>
    </>
  );
}

function PriceModal({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const invalidate = useInvalidateApi();
  return (
    <FormModal<{ sellingPrice?: number | null }>
      open={!!item}
      title={`Sửa giá bán: ${item?.titleName ?? ""}`}
      successMessage="Đã cập nhật giá bán."
      onCancel={onClose}
      initialValues={{ sellingPrice: item?.sellingPrice ?? null }}
      onSubmit={async (v) => {
        await apiFetch(`/api/sales/stock-items/${encodeURIComponent(item!.titleId)}/price`, {
          method: "PUT",
          json: { sellingPrice: v.sellingPrice ?? null },
        });
        await invalidate("/api/sales/stock-items");
      }}
    >
      <Form.Item name="sellingPrice" label="Giá bán" extra="Để trống để quay về giá bìa.">
        <MoneyInput />
      </Form.Item>
    </FormModal>
  );
}

function AdjustModal({ item, mode, onClose }: { item: StockItem | null; mode: "adjust" | "stocktake"; onClose: () => void }) {
  const invalidate = useInvalidateApi();
  const adjust = mode === "adjust";
  return (
    <FormModal<{ delta?: number; counted?: number; reason: string }>
      open={!!item}
      title={`${adjust ? "Điều chỉnh tồn kho" : "Kiểm kho"}: ${item?.titleName ?? ""}`}
      okText={adjust ? "Điều chỉnh" : "Ghi kết quả kiểm kho"}
      successMessage={adjust ? "Đã điều chỉnh tồn kho." : "Đã ghi kết quả kiểm kho."}
      onCancel={onClose}
      onSubmit={async (v) => {
        const titleId = item!.titleId;
        if (adjust) {
          await apiFetch("/api/sales/stock-adjustments", { method: "POST", json: { titleId, delta: v.delta, reason: v.reason.trim() } });
        } else {
          await apiFetch("/api/sales/stocktakes", { method: "POST", json: { titleId, countedOnHand: v.counted, reason: v.reason.trim() } });
        }
        await invalidate("/api/sales/stock-items");
      }}
    >
      <p className="mt-0 text-sm text-muted">
        Hiện có {item?.onHand ?? 0} (đang giữ {item?.reserved ?? 0}, khả dụng {item?.available ?? 0}).
      </p>
      {adjust ? (
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
                typeof v === "number" && item && v < item.reserved
                  ? Promise.reject(new Error(`Không thể nhỏ hơn số đang giữ (${item.reserved})`))
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
  const low = sp.get("low") === "1";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const allowed = can(s, PERMISSIONS.STOCK_SEARCH);
  const q = useApi<Page<StockItem>>(allowed ? `/api/sales/stock-items?${pageParams(sp, SIZE, { lowStockOnly: low ? "true" : undefined })}` : null);
  const [price, setPrice] = useState<StockItem | null>(null);
  const [adj, setAdj] = useState<{ item: StockItem; mode: "adjust" | "stocktake" } | null>(null);
  const [ledger, setLedger] = useState<StockItem | null>(null);
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
        </span>
      ),
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
    {
      key: "act",
      title: "",
      dataIndex: "titleId",
      render: (_, r) => {
        const it = r as unknown as StockItem;
        return (
          <div className="flex flex-wrap gap-1">
            {canPrice && (
              <Button size="small" onClick={() => setPrice(it)}>
                Sửa giá
              </Button>
            )}
            {canAdjust && (
              <Button size="small" onClick={() => setAdj({ item: it, mode: "adjust" })}>
                Điều chỉnh
              </Button>
            )}
            {canTake && (
              <Button size="small" onClick={() => setAdj({ item: it, mode: "stocktake" })}>
                Kiểm kho
              </Button>
            )}
            {canLedger && (
              <Button size="small" onClick={() => setLedger(it)}>
                Sổ cái
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <SalesGate
      title="Tồn kho"
      description="Mặt hàng đang bán, số tồn và biến động."
      permission={PERMISSIONS.STOCK_SEARCH}
      actions={can(s, PERMISSIONS.STOCK_REGISTER) ? <RegisterButton /> : undefined}
    >
      <div className="flex max-w-[1200px] flex-col gap-4">
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
      <PriceModal item={price} onClose={() => setPrice(null)} />
      <AdjustModal item={adj?.item ?? null} mode={adj?.mode ?? "adjust"} onClose={() => setAdj(null)} />
      <LedgerDrawer item={ledger} onClose={() => setLedger(null)} />
    </SalesGate>
  );
}
