import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { Card, NoPermission, PageHeader, PageSkeleton } from "@/ui";
import { DepartmentsView } from "./_components/DepartmentsView";
import { ErrorBlock } from "./_components/ErrorBlock";
import { keepPreviousData } from "./_lib/params";
import type { DepartmentNode } from "./_lib/types";

export default function DepartmentsPage() {
  const s = useSession();
  const [sp] = useSearchParams();
  const includeInactive = sp.get("inactive") === "1";
  const allowed = can(s, PERMISSIONS.DEPT_TREE);
  const tree = useApi<DepartmentNode[]>(allowed ? `/api/departments/tree?includeInactive=${includeInactive}` : null, {
    placeholderData: keepPreviousData,
  });

  if (!allowed) return <NoPermission feature="Phòng ban" />;
  if (tree.isPending) return <PageSkeleton />;

  return (
    <>
      <PageHeader title="Phòng ban" description="Cây phòng ban của đơn vị." />
      <div className="flex max-w-[1200px] flex-col gap-4">
        {tree.isError ? (
          <ErrorBlock query={tree} />
        ) : (
          <Card>
            <DepartmentsView
              nodes={tree.data}
              includeInactive={includeInactive}
              canCreate={can(s, PERMISSIONS.DEPT_CREATE)}
              canUpdate={can(s, PERMISSIONS.DEPT_UPDATE)}
              canStatus={can(s, PERMISSIONS.DEPT_STATUS)}
            />
          </Card>
        )}
      </div>
    </>
  );
}
