import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { NoPermission, PageHeader, QueryBoundary } from "@/ui";
import { CompensationPolicyForm } from "./_components/CompensationPolicyForm";
import { DamageLevelsCard } from "./_components/DamageLevelsCard";
import type { CompensationPolicy } from "./_lib/compensation";

export default function CompensationPage() {
  const s = useSession();
  const canPolicy = can(s, PERMISSIONS.COMPENSATION_POLICY_GET);
  const canLevels = can(s, PERMISSIONS.DAMAGE_LEVEL_LIST);
  const q = useApi<CompensationPolicy>(canPolicy ? "/api/circulation/compensation-policy" : null);
  return (
    <>
      <PageHeader title="Đền bù và mức hư hại" description="Tỷ lệ đền khi mất sách, sàn/trần, hạn tìm lại sách và các mức hư hại dùng khi nhận trả sách hỏng." />
      {!canPolicy && !canLevels ? (
        <NoPermission feature="Chính sách đền bù" />
      ) : (
        <div className="flex flex-col gap-5">
          {canPolicy && (
            <QueryBoundary query={q}>
              {(data) => <CompensationPolicyForm key={data.version} data={data} canUpdate={can(s, PERMISSIONS.COMPENSATION_POLICY_UPDATE)} onReload={() => void q.refetch()} />}
            </QueryBoundary>
          )}
          {canLevels && <DamageLevelsCard />}
        </div>
      )}
    </>
  );
}
