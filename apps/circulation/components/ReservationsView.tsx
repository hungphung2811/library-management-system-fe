"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { bffFetch } from "@mfe/api/client";
import {
  App,
  Button,
  ConfirmAction,
  DataTable,
  Form,
  FormModal,
  Input,
  PlusOutlined,
  Tabs,
  Text,
  formatDate,
} from "@mfe/ui";
import { UUID_RE, shortId, type ReservationView } from "../lib/circulation";
import { RemoteSelect, type Opt } from "./RemoteSelect";

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
  const router = useRouter();
  const { message } = App.useApp();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const active = rows.filter((r) => ACTIVE.has(r.status));
  const history = rows.filter((r) => !ACTIVE.has(r.status));

  const cancel = async (r: ReservationRow) => {
    setCancelling(r.id);
    try {
      await bffFetch(`/api/reservations/${encodeURIComponent(r.id)}`, { method: "DELETE" });
      message.success(`Đã hủy đặt trước «${r.titleName}».`);
      router.refresh();
    } finally {
      setCancelling(null);
    }
  };

  const expire = async () => {
    const r = await bffFetch<{ expired?: number }>("/api/reservations/expirations", { method: "POST" });
    message.info(`Đã hủy ${r?.expired ?? 0} đặt trước quá hạn nhận.`);
    router.refresh();
  };

  const searchBooks = async (q: string): Promise<Opt[]> => {
    const r = await bffFetch<{ id: string; name: string; author?: string }[]>(
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
        <a
          href={`/catalog/books/${encodeURIComponent(String(row.titleId))}`}
          className="font-medium text-brand-600 no-underline hover:underline"
        >
          {String(v)}
        </a>
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
            <span className="inline-block rounded-md border border-green-600 px-2 py-1">
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

  const actionColumn = {
    key: "action",
    title: "Thao tác",
    dataIndex: "id",
    render: (_: unknown, row: Record<string, unknown>) =>
      ACTIVE.has(String(row.status)) ? (
        <ConfirmAction
          danger
          title={`Hủy đặt trước «${String(row.titleName)}»?`}
          okText="Hủy đặt trước"
          onConfirm={() => cancel(row as unknown as ReservationRow)}
        >
          <Button
            size="small"
            danger
            loading={cancelling === row.id}
            aria-label={`Hủy đặt trước «${String(row.titleName)}»`}
          >
            Hủy
          </Button>
        </ConfirmAction>
      ) : null,
  };

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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
              Đặt trước sách
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-[1200px]">
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
                  empty={{
                    title: "Bạn chưa đặt trước sách nào.",
                    hint: "Tìm sách ở trang Sách rồi chọn Đặt trước.",
                    action: { label: "Tìm sách", href: "/catalog" },
                  }}
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
                  empty={{ title: "Chưa có lịch sử đặt trước." }}
                />
              ),
            },
          ]}
        />
      </div>

      <FormModal<{ titleId: Opt | string }>
        open={creating}
        title="Đặt trước sách"
        okText="Đặt trước"
        onCancel={() => setCreating(false)}
        onSubmit={async (v) => {
          const titleId = typeof v.titleId === "string" ? v.titleId.trim() : v.titleId.value;
          const r = await bffFetch<ReservationView>("/api/reservations", { method: "POST", json: { titleId } });
          message.success(
            r?.queuePosition ? `Đã đặt trước. Bạn đứng thứ ${r.queuePosition} trong hàng đợi.` : "Đã đặt trước.",
          );
          router.refresh();
        }}
      >
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
