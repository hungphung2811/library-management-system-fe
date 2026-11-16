import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { Card, ErrorPanel, NoPermission, PageHeader } from "@mfe/ui";
import { load, qp } from "../data";
import type { DepartmentNode } from "../types";
import { DepartmentsView } from "./DepartmentsView";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireSession("/admin/departments");
  const includeInactive = qp((await searchParams).inactive) === "1";

  if (!can(s, PERMISSIONS.DEPT_TREE)) {
    return (
      <>
        <NoPermission feature="Phòng ban" />
      </>
    );
  }

  const tree = await load<DepartmentNode[]>(`/api/departments/tree?includeInactive=${includeInactive}`);

  return (
    <>
      <PageHeader title="Phòng ban" description="Cây phòng ban của đơn vị." />
      <div className="flex max-w-[1200px] flex-col gap-4">
        {tree.error ? (
          <ErrorPanel error={tree.error} retryHref="/admin/departments" />
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
