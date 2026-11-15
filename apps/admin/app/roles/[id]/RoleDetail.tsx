"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiCallError, bffFetch, toErrorInfo, type ErrorInfo } from "@mfe/api/client";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Collapse,
  ConfirmAction,
  ErrorPanel,
  Form,
  FormModal,
  Input,
  Text,
  describeError,
} from "@mfe/ui";
import type { PermissionView } from "../../types";

const permPath = (roleId: string, code: string) =>
  // Mã quyền chứa "/" (AccessControlController/listRoles): BE nhận `/**`, nên mã hóa từng đoạn và giữ dấu "/".
  `/api/roles/${encodeURIComponent(roleId)}/permissions/${code.split("/").map(encodeURIComponent).join("/")}` as const;

/** Chi tiết vai trò: quyền đã gán (gỡ) và danh mục quyền (chọn nhiều rồi gán tuần tự vì BE không có API gán nhiều). */
export function RoleDetail({
  roleId,
  isAdmin,
  granted,
  catalog,
  catalogError,
  canGrant,
  canRevoke,
  canCreatePermission,
}: {
  roleId: string;
  isAdmin: boolean;
  granted: string[];
  catalog: PermissionView[] | null;
  catalogError: ErrorInfo | null;
  canGrant: boolean;
  canRevoke: boolean;
  canCreatePermission: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [grantedFilter, setGrantedFilter] = useState("");
  const [catalogFilter, setCatalogFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const descByCode = useMemo(() => new Map((catalog ?? []).map((p) => [p.code, p])), [catalog]);
  const grantedSet = useMemo(() => new Set(granted), [granted]);

  const shownGranted = granted.filter((c) => c.toLowerCase().includes(grantedFilter.toLowerCase()));

  // Danh mục chưa gán, lọc theo ô tìm, nhóm theo service rồi controller.
  const groups = useMemo(() => {
    const m = new Map<string, PermissionView[]>();
    for (const p of catalog ?? []) {
      if (grantedSet.has(p.code)) continue;
      const hay = `${p.code} ${p.description ?? ""} ${p.pathPattern ?? ""}`.toLowerCase();
      if (catalogFilter && !hay.includes(catalogFilter.toLowerCase())) continue;
      const key = `${p.service ?? "Khác"} / ${p.code.split("/")[0]}`;
      m.set(key, [...(m.get(key) ?? []), p]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog, grantedSet, catalogFilter]);

  const revoke = async (code: string) => {
    await bffFetch(permPath(roleId, code), { method: "DELETE" });
    message.success(`Đã gỡ quyền «${code}».`);
    router.refresh();
  };

  const toggle = (code: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });

  const grantSelected = async () => {
    const codes = [...selected];
    setFailures([]);
    setProgress({ done: 0, total: codes.length });
    const failed: string[] = [];
    const ok: string[] = [];
    for (const [i, code] of codes.entries()) {
      try {
        await bffFetch(`/api/roles/${encodeURIComponent(roleId)}/permissions`, {
          method: "POST",
          json: { permissionCode: code },
        });
        ok.push(code);
      } catch (e) {
        failed.push(`${code}: ${describeError(toErrorInfo(e)).text}`);
        if (e instanceof ApiCallError && e.status === 401) break;
      }
      setProgress({ done: i + 1, total: codes.length });
    }
    setProgress(null);
    setFailures(failed);
    setSelected((prev) => new Set([...prev].filter((c) => !ok.includes(c))));
    if (ok.length) message.success(`Đã gán ${ok.length} quyền.`);
    router.refresh();
  };

  if (isAdmin) {
    return <Alert type="info" showIcon title="Đây là vai trò quản trị viên: có toàn quyền, không cần gán từng quyền." />;
  }

  const allKeys = groups.map(([k]) => k);
  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-4">
      <Alert
        type="info"
        showIcon
        title="Thay đổi chỉ có hiệu lực khi người dùng đăng nhập lại."
        description="Khóa quyền chỉ xuất hiện trong danh mục sau khi chức năng tương ứng được gọi ít nhất một lần."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Quyền đã gán (${granted.length})`}>
          <Input
            allowClear
            aria-label="Lọc quyền đã gán"
            placeholder="Lọc quyền đã gán"
            className="mb-3"
            value={grantedFilter}
            onChange={(e) => setGrantedFilter(e.target.value)}
          />
          {granted.length === 0 ? (
            <Text type="secondary">Vai trò này chưa có quyền nào.</Text>
          ) : shownGranted.length === 0 ? (
            <Text type="secondary">Không có quyền nào khớp.</Text>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {shownGranted.map((code) => (
                <li key={code} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-mono text-sm break-all">{code}</div>
                    {descByCode.get(code)?.description && (
                      <div className="text-xs text-muted">{descByCode.get(code)?.description}</div>
                    )}
                  </div>
                  {canRevoke && (
                    <ConfirmAction
                      danger
                      title={`Gỡ quyền «${code}»?`}
                      description={
                        code.startsWith("AccessControlController/") ? (
                          <Text type="danger">Gỡ quyền này có thể làm bạn mất quyền quản trị.</Text>
                        ) : undefined
                      }
                      okText="Gỡ quyền"
                      onConfirm={() => revoke(code)}
                    >
                      <Button size="small" danger aria-label={`Gỡ quyền ${code}`}>
                        Gỡ
                      </Button>
                    </ConfirmAction>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {canGrant && (
          <Card
            title="Danh mục quyền"
            extra={
              canCreatePermission ? (
                <Button size="small" onClick={() => setCreating(true)}>
                  Thêm khóa quyền thủ công
                </Button>
              ) : undefined
            }
          >
            {catalogError ? (
              <ErrorPanel error={catalogError} />
            ) : !catalog ? (
              <Text type="secondary">Cần quyền xem danh mục quyền để gán quyền cho vai trò.</Text>
            ) : (
              <div className="flex flex-col gap-3">
                <Input
                  allowClear
                  aria-label="Lọc danh mục quyền"
                  placeholder="Lọc danh mục quyền"
                  value={catalogFilter}
                  onChange={(e) => setCatalogFilter(e.target.value)}
                />
                {groups.length === 0 ? (
                  <Text type="secondary">Không còn quyền nào để gán.</Text>
                ) : (
                  <Collapse
                    size="small"
                    activeKey={catalogFilter ? allKeys : openKeys}
                    onChange={(k) => setOpenKeys(Array.isArray(k) ? k : [k])}
                    items={groups.map(([key, perms]) => ({
                      key,
                      label: `${key} (${perms.length})`,
                      children: (
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                          {perms.map((p) => (
                            <li key={p.code}>
                              <Checkbox
                                checked={selected.has(p.code)}
                                disabled={busy}
                                onChange={(e) => toggle(p.code, e.target.checked)}
                              >
                                <span className="font-mono text-sm break-all">{p.code}</span>
                                {(p.httpMethod || p.pathPattern) && (
                                  <span className="block text-xs text-muted">
                                    {[p.httpMethod, p.pathPattern].filter(Boolean).join(" ")}
                                  </span>
                                )}
                              </Checkbox>
                            </li>
                          ))}
                        </ul>
                      ),
                    }))}
                  />
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="primary" disabled={selected.size === 0} loading={busy} onClick={grantSelected}>
                    {`Gán ${selected.size} quyền đã chọn`}
                  </Button>
                  {progress && (
                    <span role="status" className="text-sm text-muted">
                      Đang gán {progress.done}/{progress.total}
                    </span>
                  )}
                </div>
                {failures.length > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    title="Một số quyền chưa gán được"
                    description={
                      <ul className="m-0 pl-5">
                        {failures.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    }
                  />
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      <FormModal<{ code: string; description?: string }>
        open={creating}
        title="Thêm khóa quyền thủ công"
        okText="Thêm"
        successMessage="Đã thêm khóa quyền."
        onCancel={() => setCreating(false)}
        onSubmit={async (v) => {
          await bffFetch("/api/permissions", {
            method: "POST",
            json: { code: v.code.trim(), description: v.description?.trim() || undefined },
          });
          router.refresh();
        }}
      >
        <Form.Item
          name="code"
          label="Khóa quyền"
          extra="Dạng TênController/tênMethod, khớp với BE."
          rules={[{ required: true, whitespace: true, message: "Nhập khóa quyền" }]}
        >
          <Input autoComplete="off" className="font-mono" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input autoComplete="off" />
        </Form.Item>
      </FormModal>
    </div>
  );
}
