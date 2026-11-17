import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import { App, Button, ConfirmAction, DataTable, LinkButton, PageHeader, QueryBoundary, describeError } from "@/ui";
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
      <div className="max-w-[1200px]">
        <QueryBoundary query={pages} errorMessages={PLATFORM_ERRORS}>
          {(items) => {
            const rows = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.slug.localeCompare(b.slug));
            return (
              <DataTable
                rowKey="id"
                rows={rows}
                mobileTitleKey="title"
                columns={[
                  { key: "title", title: "Tiêu đề", dataIndex: "title", kind: "link", href: "/platform/cms-pages/{id}" },
                  { key: "slug", title: "Slug", dataIndex: "slug", kind: "mono" },
                  { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "cms" },
                  { key: "sortOrder", title: "Thứ tự", dataIndex: "sortOrder", align: "right" },
                  { key: "updatedAt", title: "Cập nhật", dataIndex: "updatedAt", kind: "datetime" },
                  {
                    key: "actions",
                    title: "Thao tác",
                    dataIndex: "id",
                    render: (_v, row) => {
                      const p = row as unknown as CmsPageSummary;
                      return (
                        <div className="flex flex-wrap items-center gap-1">
                          <ConfirmAction
                            title="Xuất bản trang này?"
                            description="Khách sẽ thấy bản làm việc hiện tại."
                            okText="Xuất bản"
                            onConfirm={() => run(() => publish.mutateAsync(p), "Đã xuất bản.")}
                          >
                            <Button size="small" disabled={p.status === "PUBLISHED"}>
                              Xuất bản
                            </Button>
                          </ConfirmAction>
                          {p.status !== "DRAFT" && (
                            <ConfirmAction
                              title="Gỡ xuất bản?"
                              description="Khách không còn thấy trang; bản làm việc được giữ."
                              okText="Gỡ"
                              danger
                              onConfirm={() => run(() => unpublish.mutateAsync(p), "Đã gỡ xuất bản.")}
                            >
                              <Button size="small">Gỡ</Button>
                            </ConfirmAction>
                          )}
                          <ConfirmAction
                            title="Xóa trang này?"
                            description="Không hoàn tác được."
                            okText="Xóa"
                            danger
                            onConfirm={() => run(() => remove.mutateAsync(p), "Đã xóa trang.")}
                          >
                            <Button size="small" danger>
                              Xóa
                            </Button>
                          </ConfirmAction>
                          <LinkButton size="small" to={`/platform/cms-pages/${encodeURIComponent(p.id)}`}>
                            Sửa
                          </LinkButton>
                        </div>
                      );
                    },
                  },
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
