import { useMemo, useState } from "react";
import { apiFetch, useApiMutation, type ErrorInfo } from "@/api";
import { Alert, App, Button, ConfirmAction, DeleteOutlined, ErrorPanel, Input, Select, Skeleton, Tag, Text, Tooltip } from "@/ui";
import { isAdminRole, type RoleView, type UserAccessView } from "../_lib/types";

/** Tab "Vai trò và quyền": chip vai trò (gỡ), thêm vai trò, quyền hiệu lực (chỉ đọc). */
export function AccessTab({
  userId,
  sessionAdmin,
  canView,
  loading,
  data,
  error,
  roles,
  canAssign,
  canRevoke,
}: {
  userId: string;
  sessionAdmin: boolean;
  canView: boolean;
  loading: boolean;
  data: UserAccessView | null;
  error: ErrorInfo | null;
  roles: RoleView[] | null;
  canAssign: boolean;
  canRevoke: boolean;
}) {
  const { message } = App.useApp();
  const [pick, setPick] = useState<string | undefined>();
  const [filter, setFilter] = useState("");
  const enc = encodeURIComponent(userId);

  const assignRole = useApiMutation(
    (roleId: string) => apiFetch(`/api/access/users/${enc}/roles`, { method: "POST", json: { roleId } }),
    { invalidate: ["/api/access"] },
  );
  const revokeRole = useApiMutation(
    (roleId: string) => apiFetch(`/api/access/users/${enc}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" }),
    { invalidate: ["/api/access"] },
  );

  const byName = useMemo(() => new Map((roles ?? []).map((r) => [r.name, r])), [roles]);
  const grouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of data?.permissions ?? []) {
      if (filter && !k.toLowerCase().includes(filter.toLowerCase())) continue;
      const g = k.split("/")[0];
      m.set(g, [...(m.get(g) ?? []), k]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, filter]);

  if (!canView) return <Alert type="info" showIcon title="Bạn không có quyền xem vai trò của người dùng này." />;
  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (error) return <ErrorPanel error={error} />;
  if (!data) return null;

  const current = new Set(data.roles);
  const assignable = (roles ?? []).filter((r) => !current.has(r.name) && (sessionAdmin || !isAdminRole(r)));

  const assign = async () => {
    if (!pick) return;
    try {
      await assignRole.mutateAsync(pick);
      message.success("Đã thêm vai trò.");
      setPick(undefined);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const revoke = async (r: RoleView) => {
    await revokeRole.mutateAsync(r.id);
    message.success(`Đã gỡ vai trò «${r.name}».`);
  };

  return (
    <div className="flex flex-col gap-5">
      <Alert type="info" showIcon title="Thay đổi vai trò có hiệu lực khi người dùng đăng nhập lại." />

      <section aria-label="Vai trò hiện có" className="flex flex-col gap-3">
        <div className="font-medium">Vai trò hiện có</div>
        {data.roles.length === 0 ? (
          <Text type="secondary">Người dùng này chưa có vai trò nào.</Text>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {data.roles.map((name) => {
              const r = byName.get(name);
              const locked = !!r && isAdminRole(r) && !sessionAdmin;
              return (
                <li key={name} className="flex items-center gap-1 rounded-control border border-line px-2 py-1">
                  <Tag className="m-0" color={r && isAdminRole(r) ? "gold" : "default"}>
                    {name}
                  </Tag>
                  {locked ? (
                    <Tooltip title="Chỉ quản trị viên được thay đổi vai trò này.">
                      <Text type="secondary" className="text-xs">
                        Đã khóa
                      </Text>
                    </Tooltip>
                  ) : (
                    canRevoke &&
                    r && (
                      <ConfirmAction
                        danger
                        title={`Gỡ vai trò «${name}»?`}
                        okText="Gỡ vai trò"
                        onConfirm={() => revoke(r)}
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Gỡ vai trò «${name}»`} />
                      </ConfirmAction>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canAssign && roles && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Chọn vai trò để thêm"
              className="min-w-56"
              placeholder="Chọn vai trò"
              value={pick}
              onChange={setPick}
              options={assignable.map((r) => ({ value: r.id, label: r.name }))}
              notFoundContent="Không còn vai trò nào để thêm"
            />
            <Button type="primary" disabled={!pick} loading={assignRole.isPending} onClick={assign}>
              Thêm vai trò
            </Button>
          </div>
        )}
        {canAssign && !roles && (
          <Text type="secondary">Cần quyền xem danh sách vai trò để thêm vai trò cho người dùng.</Text>
        )}
      </section>

      <section aria-label="Quyền hiệu lực" className="flex flex-col gap-3">
        <div className="font-medium">Quyền hiệu lực</div>
        {data.admin ? (
          <Text>Quản trị viên: toàn quyền</Text>
        ) : data.permissions.length === 0 ? (
          <Text type="secondary">Chưa có quyền nào.</Text>
        ) : (
          <>
            <Input
              allowClear
              aria-label="Lọc quyền"
              placeholder="Lọc quyền"
              className="max-w-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {grouped.map(([group, keys]) => (
              <div key={group}>
                <Text type="secondary" className="text-xs">
                  {group}
                </Text>
                <div className="mt-1 flex flex-wrap gap-1">
                  {keys.map((k) => (
                    <Tag key={k} className="font-mono">
                      {k}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && <Text type="secondary">Không có quyền nào khớp.</Text>}
          </>
        )}
      </section>
    </div>
  );
}
