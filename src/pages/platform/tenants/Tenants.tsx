import { Link, useSearchParams } from "react-router";
import { toErrorInfo, useApi } from "@/api";
import { Button, DataTable, LinkButton, ErrorPanel, PageHeader, PageSkeleton, SearchBar, Select, Tag, Eye, actionsColumn } from "@/ui";
import { keepPreviousData, pageNo, qp } from "../../admin/_lib/params";
import { PagerWithSize } from "../_components/PagerWithSize";
import { PlatformGate } from "../_components/PlatformGate";
import { SUSPENSION_CAUSE } from "../_lib/contract-format";
import { MODULE_OPTIONS, TENANT_ERRORS, TENANT_STATUS, TENANT_STATUS_OPTIONS, moduleLabel, sizeParam } from "../_lib/tenant-format";
import type { Organization, TenantPage, TenantStatus } from "../_lib/tenant-types";
import { CreateTenantButton } from "./CreateTenantButton";

export default function TenantsPage() {
  return (
    <PlatformGate>
      <List />
    </PlatformGate>
  );
}

function List() {
  const [sp, setSp] = useSearchParams();
  const q = qp(sp, "q");
  const status = qp(sp, "status");
  const org = qp(sp, "org");
  const mod = qp(sp, "module");
  const page = pageNo(sp);
  const size = sizeParam(sp.get("size"));
  const hasFilter = !!(q || status || org || mod);

  const orgs = useApi<Organization[]>("/api/platform/organizations");
  const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
  const orgOptions = (orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const params = new URLSearchParams({ page: String(page - 1), size: String(size) });
  if (q) params.set("keyword", q);
  if (status) params.set("status", status);
  if (org) params.set("organizationId", org);
  const tenants = useApi<TenantPage>(`/api/platform/tenants?${params}`, { placeholderData: keepPreviousData });

  const set = (name: string, v?: string | null) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(name, v);
    else n.delete(name);
    n.delete("page");
    setSp(n, { replace: true });
  };

  if (tenants.isPending) return <PageSkeleton />;

  // BE chưa lọc theo module: lọc phía client trên trang hiện tại (ghi rõ trong ô đếm).
  const items = (tenants.data?.items ?? []).filter((t) => !mod || (t.modules ?? ["LENDING"]).includes(mod));
  const chips: { key: string; text: string }[] = [];
  if (q) chips.push({ key: "q", text: `Từ khóa: ${q}` });
  if (status) chips.push({ key: "status", text: `Trạng thái: ${TENANT_STATUS[status as TenantStatus]?.label ?? status}` });
  if (org) chips.push({ key: "org", text: `Tổ chức: ${orgName.get(org) ?? org}` });
  if (mod) chips.push({ key: "module", text: `Module: ${moduleLabel(mod)}` });

  return (
    <>
      <PageHeader
        title="Đơn vị (tenant)"
        description="Quản lý đơn vị thuê dịch vụ: trạng thái, quản trị viên và module được bật."
        actions={
          <>
            <LinkButton to="/platform/onboarding">Triển khai khách mới</LinkButton>
            <CreateTenantButton organizations={orgOptions} />
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <SearchBar
          placeholder="Tìm theo mã hoặc tên đơn vị"
          extra={
            <>
              <Select
                aria-label="Lọc theo trạng thái"
                className="min-w-44"
                placeholder="Trạng thái"
                allowClear
                value={status || undefined}
                options={TENANT_STATUS_OPTIONS}
                onChange={(v) => set("status", v)}
              />
              <Select
                aria-label="Lọc theo tổ chức"
                className="min-w-48"
                placeholder="Tổ chức"
                allowClear
                showSearch={{ optionFilterProp: "label" }}
                value={org || undefined}
                options={orgOptions}
                onChange={(v) => set("org", v)}
              />
              <Select
                aria-label="Lọc theo module"
                className="min-w-40"
                placeholder="Module"
                allowClear
                value={mod || undefined}
                options={MODULE_OPTIONS}
                onChange={(v) => set("module", v)}
              />
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted" aria-live="polite">
          <span data-testid="tenant-count">
            {tenants.data
              ? mod
                ? `${items.length} đơn vị có module ${moduleLabel(mod)} trong trang này (tổng ${tenants.data.total} theo các bộ lọc khác)`
                : `${tenants.data.total} đơn vị`
              : ""}
          </span>
          {hasFilter && (
            <Button
              type="link"
              size="small"
              onClick={() => setSp(new URLSearchParams(size === 20 ? [] : [["size", String(size)]]), { replace: true })}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
        {tenants.isError ? (
          <ErrorPanel error={toErrorInfo(tenants.error)} onRetry={() => void tenants.refetch()} messages={TENANT_ERRORS} />
        ) : (
          <div>
            <DataTable
              rowKey="id"
              loading={tenants.isPlaceholderData}
              mobileTitleKey="name"
              rows={items.map((t) => ({ ...t, organizationName: (t.organizationId && orgName.get(t.organizationId)) || null }))}
              columns={[
{ key: "id", title: "ID", dataIndex: "id", kind: "id", width: 120 },
                { key: "name", title: "Tên đơn vị", dataIndex: "name", kind: "link", href: "/platform/tenants/{id}" },
                { key: "code", title: "Mã", dataIndex: "code", kind: "mono" },
                { key: "organizationName", title: "Tổ chức", dataIndex: "organizationName" },
                {
                  key: "status",
                  title: "Trạng thái",
                  dataIndex: "status",
                  render: (v, row) => {
                    const m = TENANT_STATUS[v as TenantStatus];
                    const sc = (row as { suspensionCause?: string | null }).suspensionCause ?? "MANUAL";
                    const cause = v === "SUSPENDED" ? (SUSPENSION_CAUSE[sc] ?? sc) : null;
                    return (
                      <span className="inline-flex flex-col items-start gap-0.5">
                        <Tag color={m?.color}>{m?.label ?? String(v)}</Tag>
                        {cause && <span className="text-xs text-muted">{cause}</span>}
                      </span>
                    );
                  },
                },
                {
                  key: "modules",
                  title: "Module",
                  dataIndex: "modules",
                  render: (v) =>
                    Array.isArray(v) && v.length ? (
                      <span className="flex flex-wrap gap-1">
                        {(v as string[]).map((m) => (
                          <Tag key={m}>{moduleLabel(m)}</Tag>
                        ))}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                { key: "memberCount", title: "Thành viên", dataIndex: "memberCount", align: "right" },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/platform/tenants/${encodeURIComponent(String(row.id))}` }], 1),
]}
              empty={
                hasFilter
                  ? { title: "Không có đơn vị khớp bộ lọc.", action: { label: "Xóa bộ lọc", href: "/platform/tenants" } }
                  : { title: "Chưa có đơn vị nào." }
              }
            />
            <PagerWithSize page={page} size={size} total={tenants.data.total} />
          </div>
        )}
        <p className="m-0 text-sm text-muted">
          Cần quản lý tổ chức? <Link to="/platform/organizations">Mở danh sách tổ chức</Link>.
        </p>
      </div>
    </>
  );
}
