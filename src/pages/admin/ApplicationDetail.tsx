import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Copy,
  ConfirmAction,
  ErrorPanel,
  KeyValueList,
  NoPermission,
  PageHeader,
  PageSkeleton,
  Pencil,
  RefreshCw,
  Result,
  Tabs,
  Tag,
  Trash2,
  useDetailModal,
} from "@/ui";
import { ApplicationFormModal, useApplicationForm } from "./_components/applications/ApplicationFormModal";
import { CredentialsPanel } from "./_components/applications/CredentialsPanel";
import { DomainsPanel } from "./_components/applications/DomainsPanel";
import { HistoryPanel } from "./_components/applications/HistoryPanel";
import { ScopesPanel } from "./_components/applications/ScopesPanel";
import { APP_STATUS_LABELS, KIND_LABELS, type ApplicationDetail as AppDetail } from "./_lib/applications";

type TabKey = "info" | "scopes" | "credentials" | "domains" | "history";

export default function ApplicationDetailPage() {
  const s = useSession();
  if (s.platformAdmin && !s.tenantId) return <NoPermission feature="Chi tiết ứng dụng (hãy chọn đơn vị làm việc)" />;
  if (!can(s, PERMISSIONS.APPLICATION_VIEW)) return <NoPermission feature="Chi tiết ứng dụng" />;
  return <Body />;
}

function Body() {
  const { id = "" } = useParams();
  const s = useSession();
  const modal = useDetailModal();
  const inModal = !!modal;
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [sp, setSp] = useSearchParams();
  const q = useApi<AppDetail>(`/api/applications/${encodeURIComponent(id)}`);
  const form = useApplicationForm({});
  const base = `/api/applications/${encodeURIComponent(id)}` as const;
  const remove = useApiMutation(() => apiFetch<void>(base, { method: "DELETE" }), { invalidate: ["/api/applications"] });
  const rotateKey = useApiMutation(() => apiFetch<AppDetail>(`${base}/site-key/rotation`, { method: "POST" }), { invalidate: ["/api/applications"] });

  if (q.isPending) return <PageSkeleton variant="form" />;
  if (q.isError) {
    const info = toErrorInfo(q.error);
    return info.status === 404 ? (
      <Result
        status="404"
        title="Không tìm thấy ứng dụng"
        extra={
          inModal ? (
            <Button onClick={modal.close}>Đóng</Button>
          ) : (
            <Link to="/admin/applications">
              <Button>Về danh sách ứng dụng</Button>
            </Link>
          )
        }
      />
    ) : (
      <ErrorPanel error={info} onRetry={() => void q.refetch()} />
    );
  }

  const a = q.data;
  const isIntegration = a.kind === "INTEGRATION";
  const active = a.status === "ACTIVE";
  const st = APP_STATUS_LABELS[a.status];
  const t = sp.get("tab");
  const allowed: TabKey[] = isIntegration ? ["info", "scopes", "credentials", "history"] : ["info", "domains", "history"];
  const tab: TabKey = allowed.includes(t as TabKey) ? (t as TabKey) : "info";

  const copySiteKey = async () => {
    try {
      await navigator.clipboard.writeText(a.siteKey ?? "");
      message.success("Đã sao chép site key");
    } catch {
      message.error("Không sao chép được. Hãy chọn và sao chép thủ công.");
    }
  };

  const info = (
    <div className="flex flex-col gap-4">
      {!active && (
        <Alert type="warning" showIcon data-testid="app-suspended" title="Ứng dụng đang tạm ngưng bởi nhà cung cấp dịch vụ. Hãy liên hệ để được kích hoạt lại." />
      )}
      <KeyValueList
        columns={2}
        items={[
          { label: "Loại", value: KIND_LABELS[a.kind] },
          { label: "Giới hạn tốc độ", value: a.rateLimitPerMinute ? `${a.rateLimitPerMinute.toLocaleString("vi-VN")} yêu cầu/phút` : "Mặc định" },
          ...(isIntegration ? [{ label: "client_id", value: a.clientId, mono: true }] : []),
          ...(!isIntegration
            ? [
                {
                  label: "Site key (công khai)",
                  value: a.siteKey ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <code className="font-mono break-all" data-testid="site-key">
                        {a.siteKey}
                      </code>
                      <Button size="small" icon={<Copy size={14} />} aria-label="Sao chép site key" onClick={() => void copySiteKey()}>
                        Sao chép
                      </Button>
                      {can(s, PERMISSIONS.APPLICATION_ROTATE_SITE_KEY) && active && (
                        <ConfirmAction
                          title="Đổi site key?"
                          description="Site key cũ hết hiệu lực ngay, không chồng lấp. Website đang dùng phải cập nhật site key mới."
                          okText="Đổi site key"
                          danger
                          onConfirm={async () => {
                            await rotateKey.mutateAsync();
                            message.success("Đã đổi site key");
                          }}
                        >
                          <Button size="small" icon={<RefreshCw size={14} />} loading={rotateKey.isPending}>
                            Đổi site key
                          </Button>
                        </ConfirmAction>
                      )}
                    </span>
                  ) : null,
                },
              ]
            : []),
          { label: "Tạo lúc", value: new Date(a.createdAt).toLocaleString("vi-VN") },
          { label: "Cập nhật", value: new Date(a.updatedAt).toLocaleString("vi-VN") },
        ]}
      />
    </div>
  );

  const items = [
    { key: "info", label: "Tổng quan", children: info },
    ...(isIntegration
      ? [
          { key: "scopes", label: "Scope", children: <ScopesPanel app={a} /> },
          { key: "credentials", label: "Credential", children: <CredentialsPanel app={a} /> },
        ]
      : [{ key: "domains", label: "Domain", children: <DomainsPanel app={a} /> }]),
    { key: "history", label: "Lịch sử", children: <HistoryPanel appId={a.id} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      {!inModal && (
        <Breadcrumb
          items={[{ title: <Link to="/admin">Quản trị</Link> }, { title: <Link to="/admin/applications">Developer Portal</Link> }, { title: a.name }]}
        />
      )}
      <PageHeader
        title={a.name}
        description={KIND_LABELS[a.kind]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tag dot color={st.color}>
              {st.label}
            </Tag>
            {can(s, PERMISSIONS.APPLICATION_UPDATE) && active && (
              <Button icon={<Pencil size={16} />} onClick={() => form.openModal({ id: a.id, name: a.name, rateLimitPerMinute: a.rateLimitPerMinute })}>
                Sửa
              </Button>
            )}
            {can(s, PERMISSIONS.APPLICATION_DELETE) && (
              <ConfirmAction
                title="Thu hồi ứng dụng này?"
                description="Mọi credential bị thu hồi và domain bị xóa. Hệ thống đang dùng ứng dụng sẽ không gọi được API nữa. Không hoàn tác được."
                okText="Thu hồi"
                danger
                onConfirm={async () => {
                  await remove.mutateAsync();
                  message.success("Đã thu hồi ứng dụng");
                  if (inModal) modal.close();
                  else void navigate("/admin/applications", { replace: true });
                }}
              >
                <Button danger icon={<Trash2 size={16} />}>
                  Thu hồi ứng dụng
                </Button>
              </ConfirmAction>
            )}
          </div>
        }
      />
      <Card>
        <Tabs activeKey={tab} onChange={(k) => setSp({ tab: k }, { replace: true })} items={items} />
      </Card>
      <ApplicationFormModal form={form} editing />
    </div>
  );
}
