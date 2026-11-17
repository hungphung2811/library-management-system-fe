import { Navigate } from "react-router";
import { PERMISSIONS, can, hasModule, useSession } from "@/api";
import { NoPermission } from "@/ui";

/** /sales: chuyển tới mục đầu tiên người dùng được phép dùng; không có mục nào thì báo thiếu quyền. */
export default function SalesHome() {
  const s = useSession();
  if (!hasModule(s, "SALES")) return <NoPermission feature="Bán hàng" />;
  const targets: [string, string[]][] = [
    ["/sales/pos", [PERMISSIONS.POS_ORDER_CREATE, PERMISSIONS.POS_ORDER_CREATE_DISCOUNTED]],
    ["/sales/orders", [PERMISSIONS.SALES_ORDER_SEARCH]],
    ["/sales/refunds", [PERMISSIONS.REFUND_SEARCH]],
    ["/sales/audit", [PERMISSIONS.SALES_AUDIT_SEARCH]],
    ["/sales/stock", [PERMISSIONS.STOCK_SEARCH]],
    ["/sales/receipts", [PERMISSIONS.RECEIPT_SEARCH]],
    ["/sales/suppliers", [PERMISSIONS.SUPPLIER_SEARCH]],
    ["/sales/settings", [PERMISSIONS.SALES_SETTINGS_VIEW]],
  ];
  const hit = targets.find(([, keys]) => keys.some((k) => can(s, k)));
  return hit ? <Navigate to={hit[0]} replace /> : <NoPermission feature="Bán hàng" />;
}
