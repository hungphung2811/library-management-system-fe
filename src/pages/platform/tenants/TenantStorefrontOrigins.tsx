import { useState } from "react";
import { Link } from "react-router";
import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import { Alert, App, Button, DataTable, ErrorPanel, Input, PageSkeleton, Switch, Tag, Trash2, actionsColumn } from "@/ui";
import {
  ORIGIN_ERRORS,
  ORIGIN_NOTE,
  checkOriginInput,
  describeOriginError,
  type StorefrontOrigin,
  type StorefrontOriginList,
} from "../_lib/storefront-origin";

/** Origin website được gọi customer-api từ trình duyệt (ADR-0013): thêm, bật/tắt, xóa. Chỉ platform admin. */
export function TenantStorefrontOrigins({ tenantId }: { tenantId: string }) {
  const enc = encodeURIComponent(tenantId);
  const base: `/api/${string}` = `/api/platform/tenants/${enc}/storefront-origins`;
  const { message } = App.useApp();
  const [value, setValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; owner?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useApi<StorefrontOriginList>(base);
  const opts = { invalidate: [base] };
  const add = useApiMutation((origin: string) => apiFetch<StorefrontOrigin>(base, { method: "POST", json: { origin } }), opts);
  const toggle = useApiMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch<StorefrontOrigin>(`${base}/${encodeURIComponent(id)}`, { method: "PUT", json: { enabled } }),
    opts,
  );
  const remove = useApiMutation((id: string) => apiFetch<void>(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }), opts);

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} messages={ORIGIN_ERRORS} />;

  const { maxOrigins, origins } = q.data;
  const full = origins.length >= maxOrigins;

  const fail = (e: unknown) => {
    const d = describeOriginError(e);
    setError(d ? { text: d.text, owner: d.ownerTenantId } : { text: toErrorInfo(e).message ?? "Thao tác không thành công. Vui lòng thử lại." });
  };

  const submit = async () => {
    setError(null);
    const bad = checkOriginInput(value);
    setInputError(bad);
    if (bad) return;
    try {
      await add.mutateAsync(value.trim());
      setValue("");
      message.success("Đã thêm origin");
    } catch (e) {
      fail(e);
    }
  };

  const onToggle = async (o: StorefrontOrigin, enabled: boolean) => {
    setError(null);
    setBusy(o.id);
    try {
      await toggle.mutateAsync({ id: o.id, enabled });
      message.success(`Đã ${enabled ? "bật" : "tắt"} origin`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="storefront-origins">
      <Alert
        type="info"
        showIcon
        data-testid="origin-note"
        title={ORIGIN_NOTE}
        description="Production chỉ nhận https (http chỉ cho localhost). Muốn đổi domain hãy xóa rồi thêm lại; mỗi origin chỉ thuộc một đơn vị."
      />
      {error && (
        <Alert
          type="error"
          showIcon
          data-testid="origin-error"
          title={error.text}
          closable={{ onClose: () => setError(null) }}
          action={error.owner ? <Link to={`/platform/tenants/${encodeURIComponent(error.owner)}?tab=origins`}>Mở đơn vị đang dùng</Link> : undefined}
        />
      )}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Địa chỉ origin"
            className="max-w-md"
            placeholder="https://tenant.example.com"
            value={value}
            status={inputError ? "error" : undefined}
            disabled={full}
            autoComplete="off"
            onChange={(e) => {
              setValue(e.target.value);
              setInputError(null);
            }}
            onPressEnter={() => void submit()}
          />
          <Button type="primary" loading={add.isPending} disabled={full} onClick={() => void submit()}>
            Thêm origin
          </Button>
          <span className="text-sm text-muted" data-testid="origin-usage">
            Đã dùng {origins.length}/{maxOrigins}
          </span>
        </div>
        {inputError ? (
          <span className="text-sm text-red-600" role="alert" data-testid="origin-input-error">
            {inputError}
          </span>
        ) : (
          <span className="text-sm text-muted">Ví dụ https://tenant.example.com: không có đường dẫn, không wildcard. Hệ thống tự chuẩn hóa chữ thường.</span>
        )}
        {full && <span className="text-sm text-muted">Đã đạt giới hạn: xóa bớt origin để thêm mới.</span>}
      </div>
      <DataTable
        rowKey="id"
        mobileTitleKey="origin"
        rows={origins}
        columns={[
{ key: "id", title: "ID", dataIndex: "id", kind: "id", width: 120 },
          { key: "origin", title: "Origin", dataIndex: "origin", kind: "mono" },
          {
            key: "enabled",
            title: "Trạng thái",
            dataIndex: "enabled",
            render: (v, row) => (
              <span className="inline-flex items-center gap-2">
                <Switch
                  aria-label={`Bật origin ${row.origin as string}`}
                  checked={v === true}
                  loading={busy === row.id}
                  disabled={busy !== null}
                  onChange={(c) => void onToggle(row as unknown as StorefrontOrigin, c)}
                />
                <Tag color={v === true ? "success" : "default"}>{v === true ? "Đang bật" : "Đang tắt"}</Tag>
              </span>
            ),
          },
          { key: "createdAt", title: "Thêm lúc", dataIndex: "createdAt", kind: "datetime" },
          { key: "updatedAt", title: "Cập nhật", dataIndex: "updatedAt", kind: "datetime" },
          actionsColumn(
            (row) => [
              {
                key: "delete",
                label: `Xóa origin ${row.origin as string}`,
                icon: <Trash2 size={16} />,
                danger: true,
                confirm: {
                  title: "Xóa origin này?",
                  description: "Website này sẽ không gọi được API công khai của đơn vị sau khoảng 60 giây.",
                  okText: "Xóa",
                },
                onClick: async () => {
                  setError(null);
                  try {
                    await remove.mutateAsync(row.id as string);
                    message.success("Đã xóa origin");
                  } catch (e) {
                    fail(e);
                  }
                },
              },
            ],
            1,
          ),
        ]}
        empty={{ title: "Đơn vị chưa khai báo origin website nào." }}
      />
    </div>
  );
}
