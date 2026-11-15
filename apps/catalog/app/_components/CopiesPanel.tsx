"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch, type ErrorInfo } from "@mfe/api/client";
import {
  Alert,
  Button,
  Card,
  DataTable,
  ErrorPanel,
  Form,
  FormModal,
  Input,
  PlusOutlined,
  STATUS_LABELS,
  Segmented,
  Text,
} from "@mfe/ui";
import type { CopyView } from "../types";
import { CopyStatusActions } from "./CopyStatusActions";

type Filter = "ALL" | keyof typeof STATUS_LABELS.copy;
const ORDER = ["AVAILABLE", "LOANED", "RESERVED", "DAMAGED", "LOST"] as const;

export function CopiesPanel({
  titleId,
  titleName,
  initial,
  error,
  canAdd,
  canChange,
  openAdd,
}: {
  titleId: string;
  titleName: string;
  initial: CopyView[] | null;
  error: ErrorInfo | null;
  canAdd: boolean;
  canChange: boolean;
  /** Mở sẵn hộp thoại thêm bản sao (từ "Lưu và thêm bản sao"). */
  openAdd?: boolean;
}) {
  const router = useRouter();
  const [copies, setCopies] = useState<CopyView[]>(initial ?? []);
  const [loadError, setLoadError] = useState<ErrorInfo | null>(error);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [adding, setAdding] = useState(!!openAdd && canAdd);

  const reload = async () => {
    try {
      setCopies(await bffFetch<CopyView[]>(`/api/book-copies?titleId=${encodeURIComponent(titleId)}`));
      setLoadError(null);
    } catch (e) {
      setLoadError({ status: (e as { status?: number }).status ?? 500 });
    }
    router.refresh(); // cập nhật "số bản sẵn có" ở thẻ thông tin
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of copies) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [copies]);

  const rows = filter === "ALL" ? copies : copies.filter((x) => x.status === filter);

  const addBtn = canAdd && (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
      Thêm bản sao
    </Button>
  );

  return (
    <Card title="Bản sao" extra={addBtn}>
      {!canAdd && !canChange && (
        <Text type="secondary" className="mb-3 block">
          Bạn chỉ có quyền xem.
        </Text>
      )}
      {loadError ? (
        <ErrorPanel error={loadError} onRetry={reload} />
      ) : (
        <div className="flex flex-col gap-4">
          {copies.length > 0 && (
            <Segmented<Filter>
              className="max-w-full overflow-x-auto"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "ALL", label: `Tất cả (${copies.length})` },
                ...ORDER.map((s) => ({ value: s, label: `${STATUS_LABELS.copy[s].label} (${counts[s] ?? 0})` })),
              ]}
            />
          )}
          <DataTable
            rowKey="id"
            rows={rows}
            empty={
              copies.length === 0
                ? { title: "Đầu sách này chưa có bản sao nào." }
                : { title: "Không có bản sao ở trạng thái này." }
            }
            columns={[
              {
                key: "barcode",
                title: "Mã vạch",
                dataIndex: "barcode",
                render: (v) => (
                  <Text copyable className="font-mono">
                    {String(v)}
                  </Text>
                ),
              },
              { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "copy" },
              ...(canChange
                ? [
                    {
                      key: "actions",
                      title: "Thao tác",
                      dataIndex: "id",
                      render: (_: unknown, row: Record<string, unknown>) => (
                        <CopyStatusActions copy={row as unknown as CopyView} onChanged={reload} />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}

      <FormModal<{ barcode: string }>
        open={adding}
        title={`Thêm bản sao cho «${titleName}»`}
        okText="Lưu"
        onCancel={() => setAdding(false)}
        successMessage="Đã thêm bản sao."
        onSubmit={async ({ barcode }) => {
          await bffFetch("/api/book-copies", { method: "POST", json: { titleId, barcode: barcode.trim() } });
          await reload();
        }}
      >
        <Alert type="info" showIcon className="mb-4" title="Quét mã vạch hoặc nhập tay rồi nhấn Enter để lưu." />
        <Form.Item
          name="barcode"
          label="Mã vạch"
          rules={[
            { required: true, whitespace: true, message: "Nhập mã vạch" },
            { max: 64, message: "Tối đa 64 ký tự" },
          ]}
        >
          <Input autoComplete="off" maxLength={64} />
        </Form.Item>
      </FormModal>
    </Card>
  );
}
