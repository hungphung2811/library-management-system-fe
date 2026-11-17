import type { ReactNode } from "react";
import { can, hasModule, useSession } from "@/api";
import { NoPermission, PageHeader } from "@/ui";

/**
 * Cổng của trang Bán hàng: đơn vị phải bật module SALES và người dùng có ít nhất một trong các khóa.
 * Chỉ để ẩn/hiện UI; BE (403 MODULE_NOT_ENABLED/FORBIDDEN) mới là nơi quyết định.
 */
export function SalesGate({
  title,
  description,
  permission,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  permission: string | string[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const s = useSession();
  const keys = Array.isArray(permission) ? permission : [permission];
  const ok = hasModule(s, "SALES") && keys.some((k) => can(s, k));
  return (
    <>
      <div className="print:hidden">
        <PageHeader title={title} description={description} actions={ok ? actions : undefined} />
      </div>
      {ok ? children : <NoPermission feature={title} />}
    </>
  );
}
