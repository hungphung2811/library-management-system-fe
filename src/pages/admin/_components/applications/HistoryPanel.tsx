import { PERMISSIONS, can, toErrorInfo, useApi, useSession } from "@/api";
import { Alert, DataTable, ErrorPanel, PageSkeleton } from "@/ui";
import { HISTORY_ACTION_LABELS, type ApplicationHistoryItem } from "../../_lib/applications";

/** Lịch sử thay đổi (mới nhất trước, tối đa 200 dòng): GET /api/applications/{id}/history. */
export function HistoryPanel({ appId }: { appId: string }) {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.APPLICATION_HISTORY);
  const q = useApi<ApplicationHistoryItem[]>(allowed ? `/api/applications/${encodeURIComponent(appId)}/history` : null);
  if (!allowed) return <Alert type="warning" showIcon title="Bạn chưa có quyền xem lịch sử thay đổi." />;
  if (q.isPending) return <PageSkeleton />;
  if (q.isError) return <ErrorPanel error={toErrorInfo(q.error)} onRetry={() => void q.refetch()} />;
  return (
    <DataTable
      rowKey="id"
      mobileTitleKey="action"
      rows={q.data.map((h) => ({ ...h }))}
      pagination={{ mode: "client", pageSize: 20 }}
      columns={[
        { key: "occurredAt", title: "Thời điểm", dataIndex: "occurredAt", kind: "datetime" },
        { key: "action", title: "Thao tác", dataIndex: "action", render: (v) => HISTORY_ACTION_LABELS[String(v)] ?? String(v) },
        { key: "detail", title: "Chi tiết", dataIndex: "detail" },
        { key: "credentialId", title: "Credential", dataIndex: "credentialId", kind: "id" },
        { key: "actorId", title: "Người thực hiện", dataIndex: "actorId", kind: "id" },
      ]}
      empty={{ title: "Chưa có thay đổi nào." }}
    />
  );
}
