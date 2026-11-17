import { useMemo, useState } from "react";
import { apiFetch, useApi, useApiMutation } from "@/api";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Form,
  FormModal,
  Input,
  PlusOutlined,
  QueryBoundary,
  STATUS_LABELS,
  Segmented,
  Text,
} from "@/ui";
import type { CopyView } from "./types";
import { CopyStatusActions } from "./CopyStatusActions";

type Filter = "ALL" | keyof typeof STATUS_LABELS.copy;
const ORDER = ["AVAILABLE", "LOANED", "RESERVED", "DAMAGED", "LOST"] as const;

export function CopiesPanel({
  titleId,
  titleName,
  canAdd,
  canChange,
  openAdd,
}: {
  titleId: string;
  titleName: string;
  canAdd: boolean;
  canChange: boolean;
  /** Mở sẵn hộp thoại thêm bản sao (từ "Lưu và thêm bản sao"). */
  openAdd?: boolean;
}) {
  const query = useApi<CopyView[]>(`/api/book-copies?titleId=${encodeURIComponent(titleId)}`);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [adding, setAdding] = useState(!!openAdd && canAdd);
  const add = useApiMutation(
    (barcode: string) => apiFetch("/api/book-copies", { method: "POST", json: { titleId, barcode } }),
    // Làm mới danh sách bản sao và "số bản sẵn có" ở thẻ thông tin.
    { invalidate: ["/api/book-copies", "/api/books"] },
  );

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
      <QueryBoundary query={query}>
        {(data) => (
          <CopiesTable copies={Array.isArray(data) ? data : []} filter={filter} onFilter={setFilter} canChange={canChange} />
        )}
      </QueryBoundary>

      <FormModal<{ barcode: string }>
        open={adding}
        title={`Thêm bản sao cho «${titleName}»`}
        okText="Lưu"
        onCancel={() => setAdding(false)}
        successMessage="Đã thêm bản sao."
        onSubmit={async ({ barcode }) => {
          await add.mutateAsync(barcode.trim());
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

function CopiesTable({
  copies,
  filter,
  onFilter,
  canChange,
}: {
  copies: CopyView[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  canChange: boolean;
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of copies) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [copies]);
  const rows = filter === "ALL" ? copies : copies.filter((x) => x.status === filter);

  return (
    <div className="flex flex-col gap-4">
      {copies.length > 0 && (
        <Segmented<Filter>
          className="max-w-full overflow-x-auto"
          value={filter}
          onChange={onFilter}
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
                    <CopyStatusActions copy={row as unknown as CopyView} />
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
