import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import { App, DataTable, PageHeader, Pencil, QueryBoundary, Send, Trash2, Undo2, actionsColumn, describeError } from "@/ui";
import { CreateCmsPageButton } from "./_components/CreateCmsPageButton";
import { PlatformGate } from "./_components/PlatformGate";
import { PLATFORM_ERRORS } from "./_lib/format";
import type { CmsPage, CmsPageSummary } from "./_lib/types";

/** Danh sách trang CMS (không phân trang). Chỉ platform admin. */
export default function CmsPagesPage() {
  return (
    <PlatformGate>
      <CmsPagesList />
    </PlatformGate>
  );
}

function CmsPagesList() {
  const { message } = App.useApp();
  const pages = useApi<CmsPageSummary[]>("/api/cms/pages");
  const base = (p: CmsPageSummary) => `/api/cms/pages/${encodeURIComponent(p.id)}` as const;

  const publish = useApiMutation(
    (p: CmsPageSummary) => apiFetch<CmsPage>(`${base(p)}/publication`, { method: "POST", json: { version: p.version } }),
    { invalidate: ["/api/cms/pages"] },
  );
  const unpublish = useApiMutation((p: CmsPageSummary) => apiFetch<CmsPage>(`${base(p)}/publication`, { method: "DELETE" }), {
    invalidate: ["/api/cms/pages"],
  });
  const remove = useApiMutation((p: CmsPageSummary) => apiFetch<void>(base(p), { method: "DELETE" }), {
    invalidate: ["/api/cms/pages"],
  });

  /** Thất bại thì hiện câu theo mã lỗi; lệch phiên bản hoặc trang đã mất thì tải lại danh sách để thấy bản mới. */
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      void message.success(ok);
    } catch (e) {
      const info = toErrorInfo(e);
      void message.error(describeError(info, PLATFORM_ERRORS).text);
      if (info.code === "CMS_VERSION_CONFLICT" || info.code === "CMS_PAGE_NOT_FOUND") void pages.refetch();
    }
  };

  return (
    <>
      <PageHeader
        title="Trang website"
        description="Nội dung website giới thiệu dịch vụ. Khách chỉ thấy bản đã xuất bản."
        actions={<CreateCmsPageButton />}
      />
      <div className="">
        <QueryBoundary query={pages} errorMessages={PLATFORM_ERRORS}>
          {(items) => {
            const rows = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.slug.localeCompare(b.slug));
            return (
              <DataTable
                rowKey="id"
                rows={rows}
                mobileTitleKey="title"
                columns={[
{ key: "id", title: "ID", dataIndex: "id", kind: "id", width: 120 },
                  { key: "title", title: "Tiêu đề", dataIndex: "title", kind: "link", href: "/platform/cms-pages/{id}" },
                  { key: "slug", title: "Slug", dataIndex: "slug", kind: "mono" },
                  { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "cms" },
                  { key: "sortOrder", title: "Thứ tự", dataIndex: "sortOrder", align: "right" },
                  { key: "updatedAt", title: "Cập nhật", dataIndex: "updatedAt", kind: "datetime" },
                  actionsColumn(
                    (row) => {
                      const p = row as unknown as CmsPageSummary;
                      return [
                        {
                          key: "publish",
                          label: "Xuất bản",
                          icon: <Send size={16} />,
                          disabled: p.status === "PUBLISHED",
                          confirm: { title: "Xuất bản trang này?", description: "Khách sẽ thấy bản làm việc hiện tại.", okText: "Xuất bản" },
                          onClick: () => run(() => publish.mutateAsync(p), "Đã xuất bản."),
                        },
                        {
                          key: "unpublish",
                          label: "Gỡ",
                          icon: <Undo2 size={16} />,
                          hidden: p.status === "DRAFT",
                          danger: true,
                          confirm: { title: "Gỡ xuất bản?", description: "Khách không còn thấy trang; bản làm việc được giữ.", okText: "Gỡ" },
                          onClick: () => run(() => unpublish.mutateAsync(p), "Đã gỡ xuất bản."),
                        },
                        {
                          key: "delete",
                          label: "Xóa",
                          icon: <Trash2 size={16} />,
                          danger: true,
                          confirm: { title: "Xóa trang này?", description: "Không hoàn tác được.", okText: "Xóa" },
                          onClick: () => run(() => remove.mutateAsync(p), "Đã xóa trang."),
                        },
                        { key: "edit", label: "Sửa", icon: <Pencil size={16} />, to: `/platform/cms-pages/${encodeURIComponent(p.id)}` },
                      ];
                    },
                    4,
                  ),
                ]}
                empty={{ title: "Chưa có trang nào.", hint: "Bấm «Thêm trang» để tạo bản nháp đầu tiên." }}
              />
            );
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
