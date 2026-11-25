import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useSession } from "@/api";
import { NoPermission, PageHeader, Tabs } from "@/ui";
import { AdjustmentRequests } from "./_components/AdjustmentRequests";
import { RefundRequests } from "./_components/RefundRequests";

export default function FineRequestsPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const canAdjust = can(s, PERMISSIONS.FINE_ADJUSTMENT_LIST);
  const canRefund = can(s, PERMISSIONS.FINE_REFUND_LIST);
  const items = [
    ...(canAdjust ? [{ key: "adjustments", label: "Miễn / giảm phạt", children: <AdjustmentRequests /> }] : []),
    ...(canRefund ? [{ key: "refunds", label: "Hoàn khoản sách tìm lại", children: <RefundRequests /> }] : []),
  ];
  const wanted = sp.get("tab");
  const active = items.some((i) => i.key === wanted) ? (wanted as string) : items[0]?.key;
  return (
    <>
      <PageHeader title="Yêu cầu miễn giảm, hoàn phạt" description="Duyệt hoặc từ chối đề nghị miễn/giảm khoản phạt chưa thu và hoàn khoản khi tìm lại sách đã báo mất." />
      {items.length === 0 ? (
        <NoPermission feature="Yêu cầu miễn giảm, hoàn phạt" />
      ) : (
        <Tabs
          activeKey={active}
          items={items}
          destroyOnHidden
          onChange={(k) => {
            // Mỗi tab có bộ lọc và trang riêng nên đổi tab thì bỏ status/page.
            const n = new URLSearchParams();
            n.set("tab", k);
            setSp(n, { replace: true });
          }}
        />
      )}
    </>
  );
}
