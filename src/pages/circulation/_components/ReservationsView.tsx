import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { apiFetch, useInvalidateApi } from "@/api";
import {
  App,
  Button,
  ConfirmAction,
  DataTable,
  Form,
  FilterBar,
  FormModal,
  Input,
  RemoteSelect,
  type Opt,
  PlusOutlined,
  Tabs,
  Text,
  X,
  actionsColumn,
  formatDate,
  useFilterParams,
  useFormModal,
  type FilterField,
} from "@/ui";
import { UUID_RE, shortId, type ReservationView } from "../_lib/circulation";

export type ReservationRow = {
  id: string;
  titleId: string;
  titleName: string;
  status: string;
  queuePosition: number | null;
  reservedAt: string | null;
  copyId: string | null;
  holdUntil: string | null;
};

type CreateValues = { titleId: Opt | string };

const ACTIVE = new Set(["WAITING", "READY"]);

/** Đặt trước của tôi: tab đang hiệu lực / lịch sử, tạo đặt trước, hủy, và hủy đặt trước quá hạn nhận. */
export function ReservationsView({
  header,
  rows,
  canReserve,
  canCancel,
  canExpire,
  canSearchBooks,
}: {
  header: ReactNode;
  rows: ReservationRow[];
  canReserve: boolean;
  canCancel: boolean;
  canExpire: boolean;
  canSearchBooks: boolean;
}) {
  const invalidate = useInvalidateApi();
  const { message } = App.useApp();
  const createForm = useFormModal<CreateValues, ReservationView>({
    title: "Đặt trước sách",
    okText: "Đặt trước",
    invalidate: ["/api/reservations"],
    request: (v) => {
      const titleId = typeof v.titleId === "string" ? v.titleId.trim() : v.titleId.value;
      return apiFetch<ReservationView>("/api/reservations", { method: "POST", json: { titleId } });
    },
    onSuccess: (r) => {
      message.success(r?.queuePosition ? `Đã đặt trước. Bạn đứng thứ ${r.queuePosition} trong hàng đợi.` : "Đã đặt trước.");
    },
  });
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Lọc phía client (BE chỉ trả đặt trước của tôi, không có tham số): tên sách và trạng thái (chọn nhiều), nằm trên URL.
  const schema = useMemo<FilterField[]>(
    () => [
      { type: "text", name: "q", label: "Tên sách", placeholder: "Tìm theo tên sách" },
      {
        type: "multiselect",
        name: "status",
        label: "Trạng thái",
        options: [
          { value: "WAITING", label: "Đang chờ" },
          { value: "READY", label: "Sẵn sàng nhận" },
          { value: "FULFILLED", label: "Đã nhận" },
          { value: "EXPIRED", label: "Hết hạn nhận" },
          { value: "CANCELLED", label: "Đã hủy" },
        ],
      },
    ],
    [],
  );
  const f = useFilterParams(schema);
  const kw = f.str("q").toLowerCase();
  const statuses = f.list("status");
  const shown = rows.filter(
    (r) => (!kw || r.titleName.toLowerCase().includes(kw)) && (statuses.length === 0 || statuses.includes(r.status)),
  );
  const active = shown.filter((r) => ACTIVE.has(r.status));
  const history = shown.filter((r) => !ACTIVE.has(r.status));

  const cancel = async (r: ReservationRow) => {
    setCancelling(r.id);
    try {
      await apiFetch(`/api/reservations/${encodeURIComponent(r.id)}`, { method: "DELETE" });
      message.success(`Đã hủy đặt trước «${r.titleName}».`);
      await invalidate("/api/reservations");
    } finally {
      setCancelling(null);
    }
  };

  const expire = async () => {
    const r = await apiFetch<{ expired?: number }>("/api/reservations/expirations", { method: "POST" });
    message.info(`Đã hủy ${r?.expired ?? 0} đặt trước quá hạn nhận.`);
    await invalidate("/api/reservations");
  };

  const searchBooks = async (q: string): Promise<Opt[]> => {
    const r = await apiFetch<{ id: string; name: string; author?: string }[]>(
      `/api/books?keyword=${encodeURIComponent(q)}`,
    );
    return r.slice(0, 20).map((b) => ({ value: b.id, label: b.author ? `${b.name} · ${b.author}` : b.name }));
  };

  const baseColumns = [
    {
      key: "titleName",
      title: "Tên sách",
      dataIndex: "titleName",
      render: (v: unknown, row: Record<string, unknown>) => (
        <Link
          to={`/catalog/books/${encodeURIComponent(String(row.titleId))}`}
          className="font-medium text-primary no-underline hover:underline"
        >
          {String(v)}
        </Link>
      ),
    },
    {
      key: "status",
      title: "Trạng thái",
      dataIndex: "status",
      kind: "status" as const,
      statusDomain: "reservation" as const,
    },
    {
      key: "info",
      title: "Thông tin",
      dataIndex: "status",
      render: (_: unknown, row: Record<string, unknown>) => {
        if (row.status === "WAITING") return `Thứ ${row.queuePosition ?? "?"} trong hàng đợi`;
        if (row.status === "READY")
          return (
            <span className="inline-block rounded-control border border-success-border bg-success-soft px-2 py-1">
              <span className="block font-medium">Nhận trước {formatDate(row.holdUntil as string | null)}</span>
              <span className="block text-xs text-muted">
                Đến quầy thư viện nhận sách (bản sao {shortId(String(row.copyId ?? ""))}).
              </span>
            </span>
          );
        return "—";
      },
    },
    { key: "reservedAt", title: "Ngày đặt", dataIndex: "reservedAt", kind: "date" as const },
  ];

  const actionColumn = actionsColumn((row) => [
    {
      key: "cancel",
      label: `Hủy đặt trước «${String(row.titleName)}»`,
      icon: <X size={16} />,
      danger: true,
      hidden: !ACTIVE.has(String(row.status)),
      loading: cancelling === row.id,
      confirm: { title: `Hủy đặt trước «${String(row.titleName)}»?`, okText: "Hủy đặt trước" },
      onClick: () => cancel(row as unknown as ReservationRow),
    },
  ], 1);

  const activeColumns = canCancel ? [...baseColumns, actionColumn] : baseColumns;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        <div className="flex items-center gap-2 pt-2">
          {canExpire && (
            <ConfirmAction
              title="Hủy các đặt trước quá hạn nhận?"
              description="Các đặt trước đã quá hạn nhận sách sẽ chuyển sang «Hết hạn nhận»."
              okText="Hủy quá hạn"
              onConfirm={expire}
            >
              <Button>Hủy đặt trước quá hạn</Button>
            </ConfirmAction>
          )}
          {canReserve && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => createForm.openModal()}>
              Đặt trước sách
            </Button>
          )}
        </div>
      </div>

      <div className="">
        <FilterBar filters={f} total={shown.length} unit="đặt trước" className="mb-3" />
        <Tabs
          items={[
            {
              key: "active",
              label: `Đang hiệu lực (${active.length})`,
              children: (
                <DataTable
                  rowKey="id"
                  mobileTitleKey="titleName"
                  rows={active}
                  columns={activeColumns}
                  empty={
                    f.hasFilter
                      ? { title: "Không có đặt trước nào khớp bộ lọc." }
                      : {
                          title: "Bạn chưa đặt trước sách nào.",
                          hint: "Tìm sách ở trang Sách rồi chọn Đặt trước.",
                          action: { label: "Tìm sách", href: "/catalog" },
                        }
                  }
                />
              ),
            },
            {
              key: "history",
              label: `Lịch sử (${history.length})`,
              children: (
                <DataTable
                  rowKey="id"
                  mobileTitleKey="titleName"
                  rows={history}
                  columns={baseColumns}
                  empty={{ title: f.hasFilter ? "Không có lịch sử nào khớp bộ lọc." : "Chưa có lịch sử đặt trước." }}
                />
              ),
            },
          ]}
        />
      </div>

      <FormModal<CreateValues> {...createForm.modalProps}>
        {canSearchBooks ? (
          <Form.Item name="titleId" label="Đầu sách" rules={[{ required: true, message: "Chọn đầu sách cần đặt trước" }]}>
            <RemoteSelect fetcher={searchBooks} placeholder="Gõ tên sách để tìm" />
          </Form.Item>
        ) : (
          <Form.Item
            name="titleId"
            label="Mã đầu sách (UUID)"
            extra={<Text type="secondary">Bạn không có quyền tìm sách nên cần nhập thẳng mã đầu sách.</Text>}
            rules={[
              { required: true, message: "Nhập mã đầu sách" },
              { pattern: UUID_RE, message: "Mã đầu sách phải có dạng UUID" },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
        )}
      </FormModal>
    </>
  );
}
