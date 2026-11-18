import { useEffect, useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, Checkbox, describeError } from "@/ui";
import { SCOPES, type ApplicationDetail } from "../../_lib/applications";

/** Chọn scope của Application INTEGRATION (thay toàn bộ). Chỉ ba scope đọc chọn được; scope ghi và customers:* bị khóa, chú thích "chưa mở". */
export function ScopesPanel({ app }: { app: ApplicationDetail }) {
  const s = useSession();
  const { message } = App.useApp();
  const [picked, setPicked] = useState<string[]>(app.scopes);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setPicked(app.scopes), [app.scopes]);
  const save = useApiMutation(
    (scopes: string[]) => apiFetch<ApplicationDetail>(`/api/applications/${encodeURIComponent(app.id)}/scopes`, { method: "PUT", json: { scopes } }),
    { invalidate: ["/api/applications"] },
  );
  const editable = can(s, PERMISSIONS.APPLICATION_REPLACE_SCOPES) && app.status === "ACTIVE";
  const dirty = [...picked].sort().join() !== [...app.scopes].sort().join();

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync(picked);
      message.success("Đã cập nhật scope");
    } catch (e) {
      setError(describeError(toErrorInfo(e)).text);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="scopes-panel">
      <Alert type="info" showIcon title="Backend chỉ đọc được dữ liệu thuộc scope đã cấp. Hiện chỉ cấp được các scope đọc; scope ghi và khách hàng chưa mở." />
      {error && <Alert type="error" showIcon data-testid="scopes-error" title={error} closable={{ onClose: () => setError(null) }} />}
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={!editable}>
        <legend className="mb-1 text-sm font-medium">Scope được cấp</legend>
        {SCOPES.map((sc) => (
          <div key={sc.key} className="flex flex-wrap items-center gap-2">
            <Checkbox
              checked={picked.includes(sc.key)}
              disabled={!editable || !sc.grantable}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, sc.key] : p.filter((x) => x !== sc.key)))}
              aria-label={`Scope ${sc.key}`}
            >
              <span className="font-mono">{sc.key}</span> <span className="text-muted">{sc.label}</span>
            </Checkbox>
            {!sc.grantable && <span className="text-sm text-muted">chưa mở</span>}
          </div>
        ))}
      </fieldset>
      {editable ? (
        <div>
          <Button type="primary" loading={save.isPending} disabled={!dirty} onClick={() => void submit()}>
            Lưu scope
          </Button>
        </div>
      ) : (
        <span className="text-sm text-muted">{app.status !== "ACTIVE" ? "Ứng dụng đang tạm ngưng nên không đổi được scope." : "Bạn không có quyền đổi scope."}</span>
      )}
    </div>
  );
}
