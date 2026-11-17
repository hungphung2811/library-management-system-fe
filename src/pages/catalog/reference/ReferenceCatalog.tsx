import { useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, hasModule, useApi, useApiMutation, useSession } from "@/api";
import {
  Button,
  ConfirmAction,
  DataTable,
  Form,
  FormModal,
  Input,
  NoPermission,
  PageHeader,
  PlusOutlined,
  QueryBoundary,
  SearchBar,
  Select,
  Space,
  Tag,
  type DataColumn,
} from "@/ui";

export type ReferenceKind = "authors" | "publishers" | "categories" | "shelf-locations";

type Row = {
  id: string;
  name?: string;
  code?: string;
  description?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  active: boolean;
};
type Page = { items: Row[]; total: number; page: number; size: number };
type Option = { id: string; name?: string; parentId?: string | null };
type FormValues = { label: string; description?: string; parentId?: string };

const SIZE = 20;

const CONFIG = {
  authors: {
    path: "/api/authors",
    title: "Tác giả",
    noun: "tác giả",
    field: "name",
    fieldLabel: "Tên tác giả",
    max: 255,
    keys: {
      search: PERMISSIONS.AUTHOR_SEARCH,
      create: PERMISSIONS.AUTHOR_CREATE,
      update: PERMISSIONS.AUTHOR_UPDATE,
      status: PERMISSIONS.AUTHOR_SET_STATUS,
    },
  },
  publishers: {
    path: "/api/publishers",
    title: "Nhà xuất bản",
    noun: "nhà xuất bản",
    field: "name",
    fieldLabel: "Tên nhà xuất bản",
    max: 255,
    keys: {
      search: PERMISSIONS.PUBLISHER_SEARCH,
      create: PERMISSIONS.PUBLISHER_CREATE,
      update: PERMISSIONS.PUBLISHER_UPDATE,
      status: PERMISSIONS.PUBLISHER_SET_STATUS,
    },
  },
  categories: {
    path: "/api/categories",
    title: "Thể loại",
    noun: "thể loại",
    field: "name",
    fieldLabel: "Tên thể loại",
    max: 255,
    keys: {
      search: PERMISSIONS.CATEGORY_SEARCH,
      create: PERMISSIONS.CATEGORY_CREATE,
      update: PERMISSIONS.CATEGORY_UPDATE,
      status: PERMISSIONS.CATEGORY_SET_STATUS,
    },
  },
  "shelf-locations": {
    path: "/api/shelf-locations",
    title: "Vị trí kệ",
    noun: "vị trí kệ",
    field: "code",
    fieldLabel: "Mã vị trí kệ",
    max: 64,
    keys: {
      search: PERMISSIONS.SHELF_LOCATION_SEARCH,
      create: PERMISSIONS.SHELF_LOCATION_CREATE,
      update: PERMISSIONS.SHELF_LOCATION_UPDATE,
      status: PERMISSIONS.SHELF_LOCATION_SET_STATUS,
    },
  },
} as const;

type Config = (typeof CONFIG)[ReferenceKind];

function ReferenceForm({
  cfg,
  kind,
  editing,
  onClose,
  canPickParent,
}: {
  cfg: Config;
  kind: ReferenceKind;
  editing: Row | "new" | null;
  onClose: () => void;
  canPickParent: boolean;
}) {
  const row = editing && editing !== "new" ? editing : null;
  const isCategory = kind === "categories";
  // Chỉ nạp gợi ý cha khi hộp thoại mở và người dùng có quyền options; thiếu quyền thì ô cha bị khóa.
  const options = useApi<Option[]>(isCategory && canPickParent && editing ? "/api/categories/options" : null);
  // Thể loại tối đa 2 cấp: chỉ cho chọn thể loại gốc làm cha, và không chọn chính nó.
  const parents = (options.data ?? []).filter((o) => !o.parentId && o.id !== row?.id);
  if (row?.parentId && !parents.some((o) => o.id === row.parentId)) {
    parents.push({ id: row.parentId, name: row.parentName ?? row.parentId });
  }
  const save = useApiMutation(
    (v: FormValues) => {
      const json: Record<string, unknown> = {
        [cfg.field]: v.label.trim(),
        description: v.description?.trim() || null,
        ...(isCategory ? { parentId: v.parentId ?? null } : {}),
      };
      return row
        ? apiFetch(`${cfg.path}/${encodeURIComponent(row.id)}`, { method: "PUT", json })
        : apiFetch(cfg.path, { method: "POST", json });
    },
    { invalidate: [cfg.path] },
  );

  return (
    <FormModal<FormValues>
      open={!!editing}
      title={row ? `Sửa ${cfg.noun}` : `Thêm ${cfg.noun}`}
      okText={row ? "Lưu" : "Tạo"}
      successMessage={row ? `Đã cập nhật ${cfg.noun}.` : `Đã thêm ${cfg.noun}.`}
      onCancel={onClose}
      initialValues={
        row
          ? { label: String(row[cfg.field] ?? ""), description: row.description ?? "", parentId: row.parentId ?? undefined }
          : {}
      }
      onSubmit={async (v) => {
        await save.mutateAsync(v);
      }}
    >
      <Form.Item
        name="label"
        label={cfg.fieldLabel}
        rules={[
          { required: true, whitespace: true, message: `Nhập ${cfg.fieldLabel.toLowerCase()}` },
          { max: cfg.max, message: `Tối đa ${cfg.max} ký tự` },
        ]}
      >
        <Input autoComplete="off" />
      </Form.Item>
      {isCategory && (
        <Form.Item
          name="parentId"
          label="Thể loại cha"
          extra={
            canPickParent
              ? "Tùy chọn. Thể loại chỉ có tối đa 2 cấp nên chỉ chọn được thể loại gốc."
              : "Bạn không có quyền xem danh sách thể loại để chọn cha."
          }
        >
          <Select
            allowClear
            showSearch={{ optionFilterProp: "label" }}
            disabled={!canPickParent}
            loading={options.isPending && canPickParent}
            placeholder="Không có (thể loại gốc)"
            options={parents.map((o) => ({ value: o.id, label: o.name }))}
          />
        </Form.Item>
      )}
      <Form.Item name="description" label="Mô tả" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
        <Input.TextArea rows={3} maxLength={500} />
      </Form.Item>
    </FormModal>
  );
}

/** Trang quản lý một danh mục chuẩn của catalog (phân trang phía server, lọc từ khóa và trạng thái trên URL). */
export function ReferenceCatalog({ kind }: { kind: ReferenceKind }) {
  const cfg = CONFIG[kind];
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const kw = (sp.get("q") ?? "").trim();
  const activeParam = sp.get("active") === "true" || sp.get("active") === "false" ? sp.get("active")! : "";
  const moduleOk = kind !== "shelf-locations" || hasModule(s, "LENDING");
  const allowed = moduleOk && can(s, cfg.keys.search);
  const canCreate = can(s, cfg.keys.create);
  const canUpdate = can(s, cfg.keys.update);
  const canStatus = can(s, cfg.keys.status);
  const canPickParent = can(s, PERMISSIONS.CATEGORY_OPTIONS);
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  const qs = new URLSearchParams({ page: String(page - 1), size: String(SIZE) });
  if (kw) qs.set("keyword", kw);
  if (activeParam) qs.set("active", activeParam);
  const query = useApi<Page>(allowed ? (`${cfg.path}?${qs}` as `/api/${string}`) : null);

  const setStatus = useApiMutation(
    (v: { id: string; active: boolean }) =>
      apiFetch(`${cfg.path}/${encodeURIComponent(v.id)}/status`, { method: "PUT", json: { active: v.active } }),
    { invalidate: [cfg.path] },
  );

  const description = `Danh mục ${cfg.noun} dùng chung cho sách${kind === "shelf-locations" ? " và bản sao" : ""}.`;
  if (!allowed) {
    return (
      <>
        <PageHeader title={cfg.title} description={description} />
        <NoPermission feature={`Quản lý ${cfg.noun}`} />
      </>
    );
  }

  const columns: DataColumn[] = [
    { key: cfg.field, title: cfg.field === "code" ? "Mã" : "Tên", dataIndex: cfg.field },
    ...(kind === "categories" ? [{ key: "parentName", title: "Thể loại cha", dataIndex: "parentName" }] : []),
    { key: "description", title: "Mô tả", dataIndex: "description" },
    {
      key: "active",
      title: "Trạng thái",
      dataIndex: "active",
      render: (v) => (v ? <Tag color="green">Đang dùng</Tag> : <Tag>Ngừng dùng</Tag>),
    },
    ...(canUpdate || canStatus
      ? [
          {
            key: "act",
            title: "",
            dataIndex: "id",
            render: (_: unknown, r: Record<string, unknown>) => {
              const row = r as unknown as Row;
              const label = String(row[cfg.field] ?? "");
              return (
                <Space>
                  {canUpdate && (
                    <Button size="small" onClick={() => setEditing(row)} aria-label={`Sửa ${label}`}>
                      Sửa
                    </Button>
                  )}
                  {canStatus && (
                    <ConfirmAction
                      title={row.active ? `Ngừng dùng «${label}»?` : `Dùng lại «${label}»?`}
                      description={row.active ? "Mục này sẽ không còn xuất hiện trong ô chọn; giá trị đã gán vẫn giữ nguyên." : undefined}
                      okText={row.active ? "Ngừng dùng" : "Dùng lại"}
                      danger={row.active}
                      onConfirm={async () => {
                        await setStatus.mutateAsync({ id: row.id, active: !row.active });
                      }}
                    >
                      <Button size="small" danger={row.active} aria-label={`${row.active ? "Ngừng dùng" : "Dùng lại"} ${label}`}>
                        {row.active ? "Ngừng dùng" : "Dùng lại"}
                      </Button>
                    </ConfirmAction>
                  )}
                </Space>
              );
            },
          },
        ]
      : []),
  ];

  const setActive = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set("active", v);
    else q.delete("active");
    q.delete("page");
    setSp(q, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={cfg.title}
        description={description}
        actions={
          canCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
              Thêm {cfg.noun}
            </Button>
          ) : undefined
        }
      />
      <div className="flex max-w-[1200px] flex-col gap-4">
        <SearchBar
          placeholder={cfg.field === "code" ? "Tìm theo mã vị trí kệ" : `Tìm theo tên ${cfg.noun}`}
          extra={
            <Select
              aria-label="Lọc theo trạng thái"
              className="w-40"
              value={activeParam}
              onChange={setActive}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "true", label: "Đang dùng" },
                { value: "false", label: "Ngừng dùng" },
              ]}
            />
          }
        />
        <QueryBoundary query={query}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              mobileTitleKey={cfg.field}
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: kw || activeParam ? `Không có ${cfg.noun} phù hợp bộ lọc.` : `Chưa có ${cfg.noun} nào.` }}
            />
          )}
        </QueryBoundary>
      </div>
      <ReferenceForm cfg={cfg} kind={kind} editing={editing} onClose={() => setEditing(null)} canPickParent={canPickParent} />
    </>
  );
}
