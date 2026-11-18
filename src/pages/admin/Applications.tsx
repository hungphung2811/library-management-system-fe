import { useNavigate } from "react-router";
import { PERMISSIONS, apiFetch, can, useApi, useApiMutation, useSession } from "@/api";
import { Alert, Button, DataTable, Eye, NoPermission, PageHeader, PageSkeleton, Pencil, PlusOutlined, Tag, Trash2, actionsColumn } from "@/ui";
import { ErrorBlock } from "./_components/ErrorBlock";
import { ApplicationFormModal, useApplicationForm } from "./_components/applications/ApplicationFormModal";
import { APP_STATUS_LABELS, KIND_LABELS, type ApplicationSummary } from "./_lib/applications";

/** Developer Portal của tenant admin: danh sách Application (website công khai, tích hợp backend). GET /api/applications. */
export default function Applications() {
  const s = useSession();
  if (s.platformAdmin) return <NoPermission feature="Developer Portal (platform admin xem Application của từng đơn vị qua API nền tảng, không thao tác ở màn này)" />;
  if (!can(s, PERMISSIONS.APPLICATION_LIST)) return <NoPermission feature="Developer Portal" />;
  return <Body />;
}

function Body() {
  const s = useSession();
  const navigate = useNavigate();
  const q = useApi<ApplicationSummary[]>("/api/applications");
  const form = useApplicationForm({ onCreated: (app) => void navigate(`/admin/applications/${encodeURIComponent(app.id)}`) });
  const remove = useApiMutation((id: string) => apiFetch<void>(`/api/applications/${encodeURIComponent(id)}`, { method: "DELETE" }), {
    invalidate: ["/api/applications"],
  });
  const canUpdate = can(s, PERMISSIONS.APPLICATION_UPDATE);
  const canDelete = can(s, PERMISSIONS.APPLICATION_DELETE);
  const canView = can(s, PERMISSIONS.APPLICATION_VIEW);

  return (
    <>
      <PageHeader
        title="Developer Portal"
        description="Ứng dụng của đơn vị gọi API: website công khai (site key, domain) hoặc backend tích hợp (scope, credential)."
        actions={
          can(s, PERMISSIONS.APPLICATION_CREATE) ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => form.openModal()}>
              Tạo ứng dụng
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4">
        <Alert
          type="info"
          showIcon
          title="Secret của credential chỉ hiện một lần lúc tạo, hãy lưu ở nơi bí mật phía backend. Không nhúng vào website."
        />
        {q.isPending ? (
          <PageSkeleton />
        ) : q.isError ? (
          <ErrorBlock query={q} />
        ) : (
          <DataTable
            rowKey="id"
            mobileTitleKey="name"
            rows={q.data.map((a) => ({ ...a }))}
            columns={[
              canView
                ? { key: "name", title: "Tên ứng dụng", dataIndex: "name", kind: "link", href: "/admin/applications/{id}" }
                : { key: "name", title: "Tên ứng dụng", dataIndex: "name" },
              { key: "kind", title: "Loại", dataIndex: "kind", render: (v) => KIND_LABELS[v as keyof typeof KIND_LABELS] ?? String(v) },
              {
                key: "status",
                title: "Trạng thái",
                dataIndex: "status",
                render: (v) => {
                  const m = APP_STATUS_LABELS[v as keyof typeof APP_STATUS_LABELS];
                  return <Tag dot color={m?.color ?? "default"}>{m?.label ?? String(v)}</Tag>;
                },
              },
              {
                key: "scopes",
                title: "Scope",
                dataIndex: "scopes",
                render: (v, row) =>
                  row.kind === "INTEGRATION" ? (
                    (v as string[]).length ? (
                      <span className="flex flex-wrap gap-1">
                        {(v as string[]).map((x) => (
                          <Tag key={x}>
                            <span className="font-mono">{x}</span>
                          </Tag>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted">Chưa cấp scope</span>
                    )
                  ) : (
                    "—"
                  ),
              },
              {
                key: "credentials",
                title: "Credential dùng được",
                dataIndex: "usableCredentials",
                align: "right",
                render: (v, row) => (row.kind === "INTEGRATION" ? String(v ?? 0) : "—"),
              },
              { key: "createdAt", title: "Tạo lúc", dataIndex: "createdAt", kind: "datetime" },
              actionsColumn(
                (row) => {
                  const a = row as unknown as ApplicationSummary;
                  return [
                    { key: "view", label: `Xem ứng dụng ${a.name}`, icon: <Eye size={16} />, to: `/admin/applications/${encodeURIComponent(a.id)}`, hidden: !canView },
                    {
                      key: "edit",
                      label: `Sửa ứng dụng ${a.name}`,
                      icon: <Pencil size={16} />,
                      hidden: !canUpdate || a.status !== "ACTIVE",
                      onClick: () => form.openModal({ id: a.id, name: a.name, rateLimitPerMinute: a.rateLimitPerMinute }),
                    },
                    {
                      key: "delete",
                      label: `Thu hồi ứng dụng ${a.name}`,
                      icon: <Trash2 size={16} />,
                      danger: true,
                      hidden: !canDelete,
                      confirm: {
                        title: "Thu hồi ứng dụng này?",
                        description: "Mọi credential bị thu hồi và domain bị xóa. Hệ thống đang dùng ứng dụng sẽ không gọi được API nữa. Không hoàn tác được.",
                        okText: "Thu hồi",
                      },
                      onClick: async () => {
                        await remove.mutateAsync(a.id);
                      },
                    },
                  ];
                },
                3,
              ),
            ]}
            empty={{ title: "Đơn vị chưa có ứng dụng nào.", hint: can(s, PERMISSIONS.APPLICATION_CREATE) ? "Bấm “Tạo ứng dụng” để bắt đầu." : undefined }}
          />
        )}
      </div>
      <ApplicationFormModal form={form} editing={!!form.target} />
    </>
  );
}
