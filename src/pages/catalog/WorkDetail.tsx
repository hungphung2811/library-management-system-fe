import { Link, useParams } from "react-router";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import {
  Breadcrumb,
  Button,
  Card,
  DataTable,
  ErrorPanel,
  KeyValueList,
  NoPermission,
  PageHeader,
  PageSkeleton,
  Split,
  Tag,
  actionsColumn,
  useDetailModal,
} from "@/ui";
import { WorkFormModal, useWorkForm } from "./_components/WorkFormModal";
import { WorkMergeModal } from "./_components/WorkMergeModal";
import { formatLabel, languageLabel } from "./_components/PublicationFields";
import { WORK_KIND_LABELS, type WorkDetail, type WorkEdition } from "./_lib/works";
import { useState } from "react";

/** Chi tiết tác phẩm kèm danh sách ấn bản (GET /api/works/{id}); mở dạng modal từ danh sách. */
export default function WorkDetailPage() {
  const { id = "" } = useParams();
  const s = useSession();
  const modal = useDetailModal();
  const allowed = can(s, PERMISSIONS.WORK_VIEW);
  const query = useApi<WorkDetail>(allowed ? `/api/works/${encodeURIComponent(id)}` : null);
  const form = useWorkForm();
  const [merging, setMerging] = useState(false);
  const split = useApiMutation(
    (e: WorkEdition) =>
      apiFetch(`/api/books/${encodeURIComponent(e.titleId)}/work`, { method: "PUT", json: { newWork: { title: e.name, kind: "SINGLE" } } }),
    { invalidate: ["/api/works", "/api/books"] },
  );

  if (!allowed) return <NoPermission feature="Xem chi tiết tác phẩm" />;
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError) return <ErrorPanel error={toErrorInfo(query.error)} onRetry={() => void query.refetch()} />;

  const w = query.data;
  const canUpdate = can(s, PERMISSIONS.WORK_UPDATE);
  const canMerge = can(s, PERMISSIONS.WORK_MERGE);
  const canChange = can(s, PERMISSIONS.BOOK_CHANGE_WORK);
  const summary = { id: w.id, title: w.title, kind: w.kind, editionCount: w.editions.length, availableCopies: 0 };

  return (
    <div className="flex flex-col gap-5">
      {!modal && <Breadcrumb items={[{ title: <Link to="/catalog/works">Tác phẩm</Link> }, { title: w.title }]} />}
      <PageHeader
        title={w.title}
        description={w.originalTitle ? `Tên gốc: ${w.originalTitle}` : undefined}
        actions={
          <>
            {canUpdate && <Button onClick={() => form.openModal({ ...summary, ...w })}>Sửa tác phẩm</Button>}
            {canMerge && <Button onClick={() => setMerging(true)}>Gộp tác phẩm khác vào đây</Button>}
          </>
        }
      />
      <Card title="Thông tin">
        <KeyValueList
          columns={2}
          items={[
            { label: "Loại", value: <Tag>{WORK_KIND_LABELS[w.kind] ?? w.kind}</Tag> },
            { label: "Tác giả", value: w.authors?.length ? w.authors.map((a) => a.name).join(", ") : w.author },
            { label: "Ngôn ngữ gốc", value: languageLabel(w.originalLanguage) },
            { label: "Thể loại", value: w.categoryName },
            { label: "Bộ sách", value: w.seriesName ? `${w.seriesName}${w.seriesLabel ? ` · ${w.seriesLabel}` : w.seriesNumber ? ` · tập ${w.seriesNumber}` : ""}` : null },
            { label: "Mô tả", value: w.description },
          ]}
        />
      </Card>
      <Card title={`Ấn bản (${w.editions.length})`}>
        <DataTable
          rowKey="titleId"
          mobileTitleKey="name"
          rows={w.editions as unknown as Record<string, unknown>[]}
          empty={{ title: "Tác phẩm chưa có ấn bản nào." }}
          columns={[
            { key: "name", title: "Tên ấn bản", dataIndex: "name", kind: "link", href: "/catalog/books/{titleId}" },
            { key: "isbn", title: "ISBN", dataIndex: "isbn", kind: "mono" },
            { key: "language", title: "Ngôn ngữ", dataIndex: "language", render: (v) => languageLabel(v as string) ?? "—" },
            { key: "format", title: "Hình thức", dataIndex: "format", render: (v) => formatLabel(v as string) ?? "—" },
            { key: "translator", title: "Dịch giả", dataIndex: "translator", render: (v) => (v ? String(v) : "—") },
            {
              key: "part",
              title: "Phần",
              dataIndex: "partNumber",
              render: (v, r) => ((r as unknown as WorkEdition).partLabel || (v != null ? `Phần ${String(v)}` : "—")),
            },
            { key: "availableCopies", title: "Bản sẵn có", dataIndex: "availableCopies", align: "right" },
            ...(canChange && w.editions.length > 1
              ? [
                  actionsColumn((r) => {
                    const e = r as unknown as WorkEdition;
                    return [
                      {
                        key: "split",
                        label: `Tách ${e.name} thành tác phẩm mới`,
                        icon: <Split size={16} />,
                        confirm: { title: `Tách «${e.name}» thành tác phẩm riêng?`, description: "Ấn bản sẽ rời khỏi tác phẩm này.", okText: "Tách" },
                        onClick: async () => {
                          await split.mutateAsync(e);
                        },
                      },
                    ];
                  }, 1),
                ]
              : []),
          ]}
        />
      </Card>
      <WorkFormModal form={form} />
      <WorkMergeModal target={merging ? w : null} onClose={() => setMerging(false)} />
    </div>
  );
}
