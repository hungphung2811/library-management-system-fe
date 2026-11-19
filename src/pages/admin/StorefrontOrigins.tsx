import { Link } from "react-router";
import { PERMISSIONS, can, hasModule, toErrorInfo, useApi, useSession } from "@/api";
import { Alert, DataTable, ErrorPanel, NoPermission, PageHeader, PageSkeleton, Tag } from "@/ui";
import { ORIGIN_NOTE, type TenantStorefrontOriginList } from "../platform/_lib/storefront-origin";

/** Website (origin) của đơn vị mình, chỉ đọc: GET /api/storefront-origins. Thêm/sửa do nhà cung cấp dịch vụ (platform admin) làm. */
export default function StorefrontOrigins() {
  const s = useSession();
  if (s.platformAdmin && !s.tenantId) return <NoPermission feature="Website của đơn vị (hãy chọn đơn vị làm việc, hoặc quản lý ở Nền tảng SaaS, mục Đơn vị, tab Origin website)" />;
  if (!can(s, PERMISSIONS.STOREFRONT_ORIGIN_LIST)) return <NoPermission feature="Website của đơn vị" />;
  return <Body />;
}

function Body() {
  const s = useSession();
  const q = useApi<TenantStorefrontOriginList>("/api/storefront-origins");
  return (
    <>
      <PageHeader title="Website" description="Các website (origin) được phép gọi API công khai của đơn vị bạn. Trang chỉ để xem." />
      <div className="flex max-w-[900px] flex-col gap-4">
        {!hasModule(s, "SALES") && (
          <Alert type="warning" showIcon data-testid="no-sales" title="Đơn vị chưa bật module Bán hàng nên website chưa hoạt động dù đã khai báo." />
        )}
        <Alert type="info" showIcon data-testid="origin-note" title={ORIGIN_NOTE} />
        {q.isPending ? (
          <PageSkeleton />
        ) : q.isError ? (
          <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <DataTable
            rowKey="origin"
            mobileTitleKey="origin"
            rows={q.data.origins}
            columns={[
              { key: "origin", title: "Website (origin)", dataIndex: "origin", kind: "mono" },
              {
                key: "enabled",
                title: "Trạng thái",
                dataIndex: "enabled",
                render: (v) => <Tag color={v === true ? "success" : "default"}>{v === true ? "Đang bật" : "Đang tắt"}</Tag>,
              },
            ]}
            empty={{ title: "Chưa có website nào được khai báo." }}
          />
        )}
        {s.platformAdmin && s.tenantId ? (
          <p className="m-0 text-sm">
            <Link to={`/platform/tenants/${encodeURIComponent(s.tenantId)}?tab=origins`}>Thêm, bật, tắt hoặc xóa website của đơn vị này</Link>
          </p>
        ) : (
          <p className="m-0 text-sm text-muted">Muốn thêm, bật, tắt hoặc xóa domain, hãy liên hệ nhà cung cấp dịch vụ.</p>
        )}
      </div>
    </>
  );
}
