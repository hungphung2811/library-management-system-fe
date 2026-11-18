import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, DataTable, ErrorPanel, Input, PageSkeleton, Trash2, actionsColumn } from "@/ui";
import { ORIGIN_ERRORS, ORIGIN_NOTE, checkOriginInput, describeOriginError, type StorefrontOrigin } from "../../../platform/_lib/storefront-origin";
import type { ApplicationDetail, ApplicationDomainList } from "../../_lib/applications";

/** Domain allowlist (origin CORS) của Application PUBLIC_SITE: thêm, xóa. Dùng lại luật origin của ADR-0013. */
export function DomainsPanel({ app }: { app: ApplicationDetail }) {
  const s = useSession();
  const { message } = App.useApp();
  const base = `/api/applications/${encodeURIComponent(app.id)}/domains` as const;
  const canList = can(s, PERMISSIONS.APPLICATION_LIST_DOMAINS);
  const canAdd = can(s, PERMISSIONS.APPLICATION_ADD_DOMAIN) && app.status === "ACTIVE";
  const canRemove = can(s, PERMISSIONS.APPLICATION_REMOVE_DOMAIN);
  const [value, setValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useApi<ApplicationDomainList>(canList ? base : null);
  const opts = { invalidate: [base] };
  const add = useApiMutation((origin: string) => apiFetch<StorefrontOrigin>(base, { method: "POST", json: { origin } }), opts);
  const remove = useApiMutation((id: string) => apiFetch<void>(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }), opts);

  if (!canList) return <Alert type="warning" showIcon title="Bạn chưa có quyền xem domain của ứng dụng." />;
  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} messages={ORIGIN_ERRORS} />;

  const { maxOriginsPerTenant, domains } = q.data;
  const fail = (e: unknown) => setError(describeOriginError(e)?.text ?? toErrorInfo(e).message ?? "Thao tác không thành công. Vui lòng thử lại.");

  const submit = async () => {
    setError(null);
    const bad = checkOriginInput(value);
    setInputError(bad);
    if (bad) return;
    try {
      await add.mutateAsync(value.trim());
      setValue("");
      message.success("Đã thêm domain");
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="domains-panel">
      <Alert type="info" showIcon data-testid="domain-note" title={ORIGIN_NOTE} description="Production chỉ nhận https (http chỉ cho localhost). Mỗi origin chỉ thuộc một đơn vị." />
      {error && <Alert type="error" showIcon data-testid="domain-error" title={error} closable={{ onClose: () => setError(null) }} />}
      {canAdd && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Địa chỉ domain (origin)"
              className="max-w-md"
              placeholder="https://tenant.example.com"
              value={value}
              status={inputError ? "error" : undefined}
              autoComplete="off"
              onChange={(e) => {
                setValue(e.target.value);
                setInputError(null);
              }}
              onPressEnter={() => void submit()}
            />
            <Button type="primary" loading={add.isPending} onClick={() => void submit()}>
              Thêm domain
            </Button>
            <span className="text-sm text-muted" data-testid="domain-usage">
              Tối đa {maxOriginsPerTenant} origin cho cả đơn vị
            </span>
          </div>
          {inputError && (
            <span className="text-sm text-red-600" role="alert" data-testid="domain-input-error">
              {inputError}
            </span>
          )}
        </div>
      )}
      <DataTable
        rowKey="id"
        mobileTitleKey="origin"
        rows={domains.map((d) => ({ ...d }))}
        columns={[
          { key: "origin", title: "Domain (origin)", dataIndex: "origin", kind: "mono" },
          { key: "createdAt", title: "Thêm lúc", dataIndex: "createdAt", kind: "datetime" },
          actionsColumn(
            (row) => [
              {
                key: "delete",
                label: `Xóa domain ${row.origin as string}`,
                icon: <Trash2 size={16} />,
                danger: true,
                hidden: !canRemove,
                confirm: { title: "Xóa domain này?", description: "Website này sẽ không gọi được API công khai sau khoảng 60 giây.", okText: "Xóa" },
                onClick: async () => {
                  setError(null);
                  try {
                    await remove.mutateAsync(row.id as string);
                    message.success("Đã xóa domain");
                  } catch (e) {
                    fail(e);
                  }
                },
              },
            ],
            1,
          ),
        ]}
        empty={{ title: "Ứng dụng chưa khai báo domain nào." }}
      />
    </div>
  );
}
