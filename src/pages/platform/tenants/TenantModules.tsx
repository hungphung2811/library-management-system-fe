import { useState } from "react";
import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import { Alert, App, DataTable, ErrorPanel, describeError, PageSkeleton, Switch } from "@/ui";
import { MODULE_LABELS, TENANT_ERRORS, moduleLabel, withTenantErrors } from "../_lib/tenant-format";
import type { TenantModule } from "../_lib/tenant-types";

/** Công tắc module của đơn vị (ADR-0009): PUT bật, DELETE tắt; 409 TENANT_MODULE_REQUIRED khi tắt module cuối. */
export function TenantModules({ tenantId, hasActiveContract = false }: { tenantId: string; hasActiveContract?: boolean }) {
  const enc = encodeURIComponent(tenantId);
  const { message } = App.useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useApi<TenantModule[]>(`/api/platform/tenants/${enc}/modules`);
  const toggle = useApiMutation(
    ({ module, enable }: { module: string; enable: boolean }) =>
      withTenantErrors(() =>
        apiFetch<TenantModule>(`/api/platform/tenants/${enc}/modules/${encodeURIComponent(module)}`, {
          method: enable ? "PUT" : "DELETE",
        }),
      ),
    { invalidate: ["/api/platform/tenants"] },
  );

  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} messages={TENANT_ERRORS} />;

  const enabledCount = q.data.filter((m) => m.enabled).length;
  const onChange = async (module: string, enable: boolean) => {
    setError(null);
    setBusy(module);
    try {
      await toggle.mutateAsync({ module, enable });
      message.success(`Đã ${enable ? "bật" : "tắt"} module ${moduleLabel(module)}`);
    } catch (e) {
      setError(describeError(toErrorInfo(e), TENANT_ERRORS).text);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Alert
        type="info"
        showIcon
        title="Bật module có hiệu lực ở lần đăng nhập, làm mới hoặc đổi đơn vị kế tiếp của người dùng; tắt module vẫn dùng được tới khi token hết hạn (tối đa 15 phút)."
      />
      {hasActiveContract && (
        <Alert
          type="warning"
          showIcon
          data-testid="manual-module-note"
          title="Bật hoặc tắt module bằng tay là ngoại lệ ngoài hợp đồng."
          description="Đơn vị đang có hợp đồng hiệu lực: module bật tay không thuộc hợp đồng sẽ không bị thu hồi khi hợp đồng hết hạn; module tắt tay sẽ được bật lại khi hợp đồng mới áp dụng. Nên đổi module qua hợp đồng."
        />
      )}
      {error && <Alert type="error" showIcon title={error} closable={{ onClose: () => setError(null) }} />}
      <DataTable
        rowKey="module"
        mobileTitleKey="label"
        rows={q.data.map((m) => ({ ...m, label: MODULE_LABELS[m.module] ?? m.module }))}
        columns={[
          { key: "label", title: "Module", dataIndex: "label" },
          { key: "module", title: "Mã", dataIndex: "module", kind: "mono" },
          {
            key: "enabled",
            title: "Bật",
            dataIndex: "enabled",
            render: (v, row) => (
              <Switch
                aria-label={`Module ${row.label as string}`}
                checked={v === true}
                loading={busy === row.module}
                disabled={busy !== null || (v === true && enabledCount <= 1)}
                onChange={(c) => void onChange(row.module as string, c)}
              />
            ),
          },
          { key: "updatedAt", title: "Cập nhật", dataIndex: "updatedAt", kind: "datetime" },
        ]}
        empty={{ title: "Chưa có module nào." }}
      />
      {enabledCount <= 1 && <p className="m-0 text-sm text-muted">Đơn vị phải còn ít nhất một module nên không tắt được module cuối. Muốn dừng đơn vị hãy dùng Tạm ngưng.</p>}
    </div>
  );
}
