import { useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import {
  Button,
  DataTable,
  Eye,
  GitMerge,
  NoPermission,
  PageHeader,
  Pencil,
  PlusOutlined,
  QueryBoundary,
  SearchBar,
  Tag,
  actionsColumn,
  usePageSize,
  type DataColumn,
} from "@/ui";
import { WorkFormModal, useWorkForm } from "./_components/WorkFormModal";
import { WorkMergeModal } from "./_components/WorkMergeModal";
import { WORK_KIND_LABELS, type WorkPage, type WorkSummary } from "./_lib/works";

/** Quản lý tác phẩm (works): một tác phẩm gom nhiều ấn bản (ngôn ngữ, bản dịch, định dạng). GET /api/works. */
export default function Works() {
  const s = useSession();
  const [sp] = useSearchParams();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const SIZE = usePageSize();
  const kw = (sp.get("q") ?? "").trim();
  const allowed = can(s, PERMISSIONS.WORK_SEARCH);
  const canCreate = can(s, PERMISSIONS.WORK_CREATE);
  const canUpdate = can(s, PERMISSIONS.WORK_UPDATE);
  const canMerge = can(s, PERMISSIONS.WORK_MERGE);
  const canView = can(s, PERMISSIONS.WORK_VIEW);
  const form = useWorkForm();
  const [merging, setMerging] = useState<WorkSummary | null>(null);

  const qs = new URLSearchParams({ page: String(page - 1), size: String(SIZE) });
  if (kw) qs.set("keyword", kw);
  const query = useApi<WorkPage>(allowed ? `/api/works?${qs}` : null);

  const header = (
    <PageHeader
      title="Tác phẩm"
      description="Mỗi tác phẩm gom các ấn bản của cùng một nội dung (bản dịch, định dạng, ngôn ngữ khác nhau)."
      actions={
        canCreate && allowed ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => form.openModal()}>
            Thêm tác phẩm
          </Button>
        ) : undefined
      }
    />
  );
  if (!allowed) {
    return (
      <>
        {header}
        <NoPermission feature="Quản lý tác phẩm" />
      </>
    );
  }

  const columns: DataColumn[] = [
    canView
      ? { key: "title", title: "Tên tác phẩm", dataIndex: "title", kind: "link", href: "/catalog/works/{id}" }
      : { key: "title", title: "Tên tác phẩm", dataIndex: "title" },
    { key: "originalTitle", title: "Tên gốc", dataIndex: "originalTitle", render: (v) => (v ? String(v) : "—") },
    { key: "author", title: "Tác giả", dataIndex: "author", render: (v) => (v ? String(v) : "—") },
    {
      key: "series",
      title: "Bộ sách",
      dataIndex: "seriesName",
      render: (v, r) => {
        const w = r as unknown as WorkSummary;
        return v ? `${String(v)}${w.seriesNumber ? ` (tập ${w.seriesNumber})` : ""}` : "—";
      },
    },
    { key: "kind", title: "Loại", dataIndex: "kind", render: (v) => <Tag>{WORK_KIND_LABELS[v as keyof typeof WORK_KIND_LABELS] ?? String(v)}</Tag> },
    { key: "editionCount", title: "Số ấn bản", dataIndex: "editionCount", align: "right" },
    { key: "availableCopies", title: "Bản sẵn có", dataIndex: "availableCopies", align: "right" },
    actionsColumn((r) => {
      const w = r as unknown as WorkSummary;
      return [
        { key: "view", label: `Xem ${w.title}`, icon: <Eye size={16} />, to: `/catalog/works/${encodeURIComponent(w.id)}`, hidden: !canView },
        { key: "edit", label: `Sửa ${w.title}`, icon: <Pencil size={16} />, hidden: !canUpdate, onClick: () => form.openModal(w) },
        { key: "merge", label: `Gộp vào ${w.title}`, icon: <GitMerge size={16} />, hidden: !canMerge, onClick: () => setMerging(w) },
      ];
    }),
  ];

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        <SearchBar placeholder="Tìm theo tên tác phẩm" />
        <QueryBoundary query={query}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              mobileTitleKey="title"
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: kw ? "Không có tác phẩm phù hợp." : "Chưa có tác phẩm nào." }}
            />
          )}
        </QueryBoundary>
      </div>
      <WorkFormModal form={form} />
      <WorkMergeModal target={merging} onClose={() => setMerging(null)} />
    </>
  );
}
