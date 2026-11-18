import { Link, useParams, useSearchParams } from "react-router";
import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  ConfirmAction,
  EditOutlined,
  ErrorPanel,
  Form,
  FormModal,
  Input,
  KeyValueList,
  PageHeader,
  PageSkeleton,
  Result,
  Select,
  Tabs,
  Tag,
  useDetailModal,
  useFormModal,
} from "@/ui";
import { PlatformGate } from "../_components/PlatformGate";
import { SUSPENSION_CAUSE, SUSPENSION_HINT } from "../_lib/contract-format";
import type { TenantContractList } from "../_lib/contract-types";
import { TENANT_ERRORS, TENANT_STATUS, moduleLabel, withTenantErrors } from "../_lib/tenant-format";
import type { Organization, TenantDetail, TenantSummary, TenantUserPage } from "../_lib/tenant-types";
import { TenantAdmins } from "./TenantAdmins";
import { TenantContracts } from "./TenantContracts";
import { TenantMembers } from "./TenantMembers";
import { TenantModules } from "./TenantModules";
import { TenantStorefrontOrigins } from "./TenantStorefrontOrigins";

type TabKey = "modules" | "contracts" | "origins" | "admins" | "members";

export default function TenantDetailPage() {
  return (
    <PlatformGate>
      <Detail />
    </PlatformGate>
  );
}

function Detail() {
  const { id = "" } = useParams();
  const enc = encodeURIComponent(id);
  const { message } = App.useApp();
  const modal = useDetailModal();
  const inModal = !!modal;
  const [sp, setSp] = useSearchParams();
  const t = sp.get("tab");
  const tab: TabKey = t === "admins" || t === "members" || t === "contracts" || t === "origins" ? t : "modules";

  const tenant = useApi<TenantDetail>(`/api/platform/tenants/${enc}`);
  const orgs = useApi<Organization[]>("/api/platform/organizations");
  // Người dùng của đơn vị (platform admin lọc theo tenantId, ADR-0008): dùng để hiện tên quản trị viên và danh sách thành viên.
  const users = useApi<TenantUserPage>(`/api/users?tenantId=${enc}&size=100`);
  // Dùng chung khóa với tab Hợp đồng: cảnh báo "chưa có hợp đồng" và nhắc module bật tay ở tab Module.
  const contracts = useApi<TenantContractList>(`/api/platform/tenants/${enc}/contracts`);

  const refresh = ["/api/platform/tenants", "/api/users"];
  const setStatus = useApiMutation(
    (to: "suspend" | "activate") =>
      withTenantErrors(() => apiFetch<TenantSummary>(`/api/platform/tenants/${enc}/${to}`, { method: "POST" })),
    { invalidate: refresh },
  );
  const edit = useFormModal<{ name: string; organizationId?: string }, TenantSummary, TenantDetail>({
    title: "Sửa thông tin đơn vị",
    successMessage: "Đã lưu thông tin đơn vị",
    invalidate: refresh,
    initialValues: (t) => (t ? { name: t.name, organizationId: t.organizationId ?? undefined } : undefined),
    request: (v) =>
      withTenantErrors(() =>
        apiFetch<TenantSummary>(`/api/platform/tenants/${enc}`, {
          method: "PUT",
          json: { name: v.name.trim(), organizationId: v.organizationId || null },
        }),
      ),
  });

  if (tenant.isPending) return <PageSkeleton variant="form" />;
  if (tenant.isError) {
    const info = toErrorInfo(tenant.error);
    return info.status === 404 || info.code === "TENANT_NOT_FOUND" || info.status === 400 ? (
      <Result
        status="404"
        title="Không tìm thấy đơn vị"
        extra={
          modal ? (
            <Button onClick={modal.close}>Đóng</Button>
          ) : (
            <Link to="/platform/tenants">
              <Button>Về danh sách đơn vị</Button>
            </Link>
          )
        }
      />
    ) : (
      <ErrorPanel error={info} onRetry={() => void tenant.refetch()} messages={TENANT_ERRORS} />
    );
  }

  const d = tenant.data;
  const org = (orgs.data ?? []).find((o) => o.id === d.organizationId);
  const st = TENANT_STATUS[d.status];
  const suspended = d.status === "SUSPENDED";
  const userName = new Map((users.data?.items ?? []).map((u) => [u.id, u]));

  return (
    <div className="flex flex-col gap-4">
      {!inModal && (
        <Breadcrumb
          items={[
            { title: <Link to="/platform/tenants">Đơn vị</Link> },
            { title: d.name },
          ]}
        />
      )}
      <PageHeader
        title={d.name}
        description={
          <span className="inline-flex items-center gap-2">
            <span className="font-mono">{d.code}</span>
            <Tag color={st?.color}>{st?.label ?? d.status}</Tag>
          </span>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <Button icon={<EditOutlined />} onClick={() => edit.openModal(d)}>
              Sửa thông tin
            </Button>
            {suspended ? (
              <ConfirmAction
                title="Kích hoạt lại đơn vị này?"
                description="Người dùng của đơn vị đăng nhập và thao tác được trở lại."
                okText="Kích hoạt"
                onConfirm={async () => {
                  await setStatus.mutateAsync("activate");
                  message.success("Đã kích hoạt đơn vị");
                }}
              >
                <Button type="primary">Kích hoạt</Button>
              </ConfirmAction>
            ) : (
              <ConfirmAction
                title="Tạm ngưng đơn vị này?"
                description="Người dùng của đơn vị sẽ không dùng được hệ thống cho tới khi kích hoạt lại."
                okText="Tạm ngưng"
                danger
                onConfirm={async () => {
                  await setStatus.mutateAsync("suspend");
                  message.success("Đã tạm ngưng đơn vị");
                }}
              >
                <Button danger>Tạm ngưng</Button>
              </ConfirmAction>
            )}
          </span>
        }
      />
      {suspended && (
        <Alert
          type="warning"
          showIcon
          data-testid="suspension-cause"
          title={SUSPENSION_CAUSE[d.suspensionCause ?? "MANUAL"] ?? `Tạm ngưng (${d.suspensionCause})`}
          description={SUSPENSION_HINT[d.suspensionCause ?? "MANUAL"] ?? SUSPENSION_HINT.MANUAL}
        />
      )}
      {contracts.data && contracts.data.contracts.length === 0 && (
        <Alert
          type="warning"
          showIcon
          title="Đơn vị chưa có hợp đồng nào"
          description="Module chạy theo cấu hình tay, không có thời hạn và không hết hạn tự động."
          action={
            <Button size="small" onClick={() => setSp({ tab: "contracts" }, { replace: true })}>
              Mở tab Hợp đồng
            </Button>
          }
        />
      )}
      <Card>
        <KeyValueList
          columns={2}
          items={[
            { label: "Mã đơn vị", value: d.code, mono: true },
            { label: "Tên đơn vị", value: d.name },
            { label: "Tổ chức", value: org?.name ?? (d.organizationId ? d.organizationId : null) },
            {
              label: "Trạng thái",
              value: (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Tag color={st?.color}>{st?.label ?? d.status}</Tag>
                  {suspended && <span className="text-muted">{SUSPENSION_CAUSE[d.suspensionCause ?? "MANUAL"] ?? d.suspensionCause}</span>}
                </span>
              ),
            },
            { label: "Số thành viên", value: String(d.memberCount) },
            {
              label: "Module đang bật",
              value: d.modules?.length ? (
                <span className="inline-flex flex-wrap gap-1">
                  {d.modules.map((m) => (
                    <Tag key={m}>{moduleLabel(m)}</Tag>
                  ))}
                </span>
              ) : null,
            },
            { label: "Mã nội bộ (id)", value: d.id, mono: true },
          ]}
        />
      </Card>
      <Tabs
        activeKey={tab}
        onChange={(k) => setSp({ tab: k }, { replace: true })}
        items={[
          {
            key: "modules",
            label: "Module",
            children: (
              <TenantModules
                tenantId={d.id}
                hasActiveContract={(contracts.data?.contracts ?? []).some((c) => c.status === "ACTIVE")}
              />
            ),
          },
          { key: "contracts", label: "Hợp đồng", children: <TenantContracts tenantId={d.id} /> },
          { key: "origins", label: "Origin website", children: <TenantStorefrontOrigins tenantId={d.id} /> },
          {
            key: "admins",
            label: `Quản trị viên (${d.adminUserIds.length})`,
            children: <TenantAdmins tenantId={d.id} adminIds={d.adminUserIds} users={userName} />,
          },
          {
            key: "members",
            label: `Thành viên (${d.memberCount})`,
            children: <TenantMembers tenantId={d.id} users={users} />,
          },
        ]}
      />
      <FormModal<{ name: string; organizationId?: string }> {...edit.modalProps}>
        <Form.Item label="Mã đơn vị" extra="Không đổi được sau khi tạo.">
          <Input value={d.code} disabled className="font-mono" />
        </Form.Item>
        <Form.Item
          name="name"
          label="Tên đơn vị"
          rules={[{ required: true, whitespace: true, message: "Nhập tên đơn vị" }, { max: 255, message: "Tối đa 255 ký tự" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="organizationId" label="Tổ chức">
          <Select
            allowClear
            showSearch={{ optionFilterProp: "label" }}
            placeholder="Không thuộc tổ chức nào"
            options={(orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
          />
        </Form.Item>
      </FormModal>
    </div>
  );
}
