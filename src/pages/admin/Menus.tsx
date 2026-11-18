import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  ConfirmAction,
  DeleteOutlined,
  EditOutlined,
  Empty,
  ErrorPanel,
  NoPermission,
  PageHeader,
  PageSkeleton,
  PlusOutlined,
  Tag,
  Text,
  Tooltip,
  describeError,
} from "@/ui";
import { MenuFormModal, type MenuFormTarget } from "./_components/MenuFormModal";
import { MAX_MENU_DEPTH, buildMenuTree, flattenTree, type AdminMenuList } from "./_lib/menu";

/** Quản trị menu của đơn vị (tenant admin): danh sách phẳng từ BE dựng thành cây theo parentId + sortOrder. */
export default function MenusPage() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.MENU_LIST);
  const { message } = App.useApp();
  const q = useApi<AdminMenuList>(allowed ? "/api/admin/menus" : null);
  const [target, setTarget] = useState<MenuFormTarget | null>(null);

  const tree = useMemo(() => buildMenuTree(q.data?.items ?? []), [q.data]);
  const rows = useMemo(() => flattenTree(tree), [tree]);

  const init = useApiMutation(() => apiFetch("/api/admin/menus/defaults", { method: "POST" }), {
    invalidate: ["/api/admin/menus", "/api/menus"],
  });
  const remove = useApiMutation((id: string) => apiFetch(`/api/admin/menus/${encodeURIComponent(id)}`, { method: "DELETE" }), {
    invalidate: ["/api/admin/menus", "/api/menus"],
  });

  if (!allowed) return <NoPermission feature="Quản trị menu" />;
  if (q.isPending) return <PageSkeleton />;
  // Token không có đơn vị (platform admin) bị BE từ chối bằng 403 TENANT_REQUIRED.
  if (q.isError) return <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} />;

  const canCreate = can(s, PERMISSIONS.MENU_CREATE);
  const canUpdate = can(s, PERMISSIONS.MENU_UPDATE);
  const canDelete = can(s, PERMISSIONS.MENU_DELETE);
  const canInit = can(s, PERMISSIONS.MENU_INIT_DEFAULTS);

  const initDefaults = async () => {
    try {
      await init.mutateAsync();
      message.success("Đã khởi tạo menu từ bộ mặc định.");
    } catch (e) {
      const info = toErrorInfo(e);
      message.error(describeError(info).text);
      if (info.code === "MENU_ALREADY_INITIALIZED" || info.code === "MENU_CONFLICT") void q.refetch();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb items={[{ title: <Link to="/admin">Quản trị</Link> }, { title: "Menu" }]} />
      <PageHeader
        title="Menu"
        description="Cấu hình menu điều hướng của đơn vị: nhãn, đường dẫn, thứ tự, quyền và module. Tối đa 3 cấp."
        actions={
          canCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setTarget({ mode: "create" })}>
              Thêm mục
            </Button>
          ) : undefined
        }
      />
      {q.data.usingDefaults && (
        <Alert
          type="info"
          showIcon
          title="Đơn vị đang dùng menu mặc định của hệ thống."
          description="Khởi tạo từ mặc định để sao chép bộ menu này thành dữ liệu của đơn vị rồi mới chỉnh sửa được."
          action={
            canInit ? (
              <Button type="primary" loading={init.isPending} onClick={() => void initDefaults()}>
                Khởi tạo từ mặc định
              </Button>
            ) : undefined
          }
        />
      )}
      <Card>
        {rows.length === 0 ? (
          <Empty description={q.data.usingDefaults ? "Chưa có menu riêng." : "Chưa có mục menu nào."} />
        ) : (
          <ul className="m-0 list-none p-0">
            {rows.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-center gap-2 border-b border-line-soft py-2 last:border-b-0"
                style={{ paddingLeft: (n.depth - 1) * 24 }}
              >
                <div className="min-w-0 flex-1">
                  <span className={n.enabled ? "font-medium" : "font-medium text-faint line-through"}>{n.label}</span>{" "}
                  <Text type="secondary" code>
                    {n.code}
                  </Text>{" "}
                  {n.path ? <Text type="secondary">{n.path}</Text> : <Tag>Nhóm</Tag>}
                  {n.module && <Tag>{n.module}</Tag>}
                  {!n.enabled && <Tag>Đã tắt</Tag>}
                  {n.permissionKey && <Text type="secondary"> · quyền {n.permissionKey}</Text>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {canCreate && (
                    <Tooltip title={n.depth >= MAX_MENU_DEPTH ? "Đã đạt độ sâu tối đa" : "Thêm mục con"}>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        aria-label={`Thêm mục con cho ${n.label}`}
                        disabled={n.depth >= MAX_MENU_DEPTH}
                        onClick={() => setTarget({ mode: "create", parentId: n.id })}
                      />
                    </Tooltip>
                  )}
                  {canUpdate && (
                    <Button size="small" icon={<EditOutlined />} aria-label={`Sửa ${n.label}`} onClick={() => setTarget({ mode: "edit", node: n })} />
                  )}
                  {canDelete && (
                    <ConfirmAction
                      danger
                      title={`Xóa mục «${n.label}»?`}
                      description={n.children.length ? "Mục còn mục con nên chưa xóa được; hãy xóa hoặc chuyển các mục con trước." : undefined}
                      okText="Xóa"
                      onConfirm={async () => {
                        await remove.mutateAsync(n.id);
                        message.success("Đã xóa mục menu.");
                      }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Xóa ${n.label}`} />
                    </ConfirmAction>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <MenuFormModal target={target} tree={tree} onClose={() => setTarget(null)} onReload={() => void q.refetch()} />
    </div>
  );
}
