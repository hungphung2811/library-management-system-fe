import { usePageSize } from "@/ui";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { PERMISSIONS, apiFetch, can, hasModule, useApi, useApiMutation, useSession } from "@/api";
import {
  Button,
  DataTable,
  EXCEL_IMPORTS,
  ExcelImportButton,
  Form,
  FormModal,
  Input,
  InputNumber,
  NoPermission,
  PageHeader,
  Pencil,
  Play,
  PlusOutlined,
  Power,
  QueryBoundary,
  SearchBar,
  Select,
  Tag,
  UserAvatar,
  actionsColumn,
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
  // Tác giả (vắng trong JSON = chưa nhập)
  birthYear?: number | null;
  deathYear?: number | null;
  nationality?: string | null;
  photoUrl?: string | null;
  // Nhà xuất bản
  country?: string | null;
  foundedYear?: number | null;
  address?: string | null;
  // Tác giả và nhà xuất bản
  website?: string | null;
  // Vị trí kệ (null khi chưa nhập)
  floor?: string | null;
  zone?: string | null;
  capacity?: number | null;
};
type Page = { items: Row[]; total: number; page: number; size: number };
type Option = { id: string; name?: string; parentId?: string | null };
type FormValues = {
  label: string;
  description?: string;
  parentId?: string;
  birthYear?: number | null;
  deathYear?: number | null;
  nationality?: string;
  photoUrl?: string;
  website?: string;
  country?: string;
  foundedYear?: number | null;
  address?: string;
  floor?: string;
  zone?: string;
  capacity?: number | null;
};

const THIS_YEAR = new Date().getFullYear();
const URL_RULE = { pattern: /^https?:\/\/\S+$/i, message: "Phải là địa chỉ http:// hoặc https://" };
/** PUT thay toàn bộ phần bổ sung: chuỗi rỗng/vắng gửi null để xóa. */
const str = (v?: string | null) => (v && v.trim() ? v.trim() : null);
const num = (v?: number | null) => (v == null ? null : v);

/** Các field bổ sung theo loại danh mục (tên trùng khóa JSON của BE để lỗi 400 "field: msg" gắn đúng ô). */
function extraPayload(kind: ReferenceKind, v: FormValues): Record<string, unknown> {
  switch (kind) {
    case "authors":
      return {
        birthYear: num(v.birthYear),
        deathYear: num(v.deathYear),
        nationality: str(v.nationality),
        photoUrl: str(v.photoUrl),
        website: str(v.website),
      };
    case "publishers":
      return { country: str(v.country), foundedYear: num(v.foundedYear), website: str(v.website), address: str(v.address) };
    case "shelf-locations":
      return { floor: str(v.floor), zone: str(v.zone), capacity: num(v.capacity) };
    default:
      return {};
  }
}

function extraInitial(kind: ReferenceKind, r: Row): Partial<FormValues> {
  switch (kind) {
    case "authors":
      return {
        birthYear: r.birthYear ?? undefined,
        deathYear: r.deathYear ?? undefined,
        nationality: r.nationality ?? undefined,
        photoUrl: r.photoUrl ?? undefined,
        website: r.website ?? undefined,
      };
    case "publishers":
      return { country: r.country ?? undefined, foundedYear: r.foundedYear ?? undefined, website: r.website ?? undefined, address: r.address ?? undefined };
    case "shelf-locations":
      return { floor: r.floor ?? undefined, zone: r.zone ?? undefined, capacity: r.capacity ?? undefined };
    default:
      return {};
  }
}

function ExtraFields({ kind }: { kind: ReferenceKind }) {
  if (kind === "authors") {
    return (
      <>
        <Form.Item name="birthYear" label="Năm sinh" rules={[{ type: "number", min: 1, max: THIS_YEAR, message: `Từ 1 đến ${THIS_YEAR}` }]}>
          <InputNumber className="w-full" min={1} max={THIS_YEAR} precision={0} />
        </Form.Item>
        <Form.Item
          name="deathYear"
          label="Năm mất"
          dependencies={["birthYear"]}
          rules={[
            { type: "number", max: THIS_YEAR, message: `Tối đa ${THIS_YEAR}` },
            ({ getFieldValue }) => ({
              validator: (_, value?: number | null) => {
                const born = getFieldValue("birthYear") as number | null | undefined;
                if (value != null && born != null && value < born) return Promise.reject(new Error("Năm mất không được nhỏ hơn năm sinh"));
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber className="w-full" min={1} max={THIS_YEAR} precision={0} />
        </Form.Item>
        <Form.Item name="nationality" label="Quốc tịch" rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}>
          <Input autoComplete="off" maxLength={100} />
        </Form.Item>
        <Form.Item name="photoUrl" label="Ảnh (URL)" rules={[{ max: 500, message: "Tối đa 500 ký tự" }, URL_RULE]}>
          <Input autoComplete="off" placeholder="https://..." />
        </Form.Item>
        <Form.Item name="website" label="Website" rules={[{ max: 500, message: "Tối đa 500 ký tự" }, URL_RULE]}>
          <Input autoComplete="off" placeholder="https://..." />
        </Form.Item>
      </>
    );
  }
  if (kind === "publishers") {
    return (
      <>
        <Form.Item name="country" label="Quốc gia" rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}>
          <Input autoComplete="off" maxLength={100} />
        </Form.Item>
        <Form.Item name="foundedYear" label="Năm thành lập" rules={[{ type: "number", min: 1400, max: THIS_YEAR, message: `Từ 1400 đến ${THIS_YEAR}` }]}>
          <InputNumber className="w-full" min={1400} max={THIS_YEAR} precision={0} />
        </Form.Item>
        <Form.Item name="website" label="Website" rules={[{ max: 500, message: "Tối đa 500 ký tự" }, URL_RULE]}>
          <Input autoComplete="off" placeholder="https://..." />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </>
    );
  }
  if (kind === "shelf-locations") {
    return (
      <>
        <Form.Item name="floor" label="Tầng" rules={[{ max: 20, message: "Tối đa 20 ký tự" }]}>
          <Input autoComplete="off" maxLength={20} placeholder="Tầng 2" />
        </Form.Item>
        <Form.Item name="zone" label="Khu vực" rules={[{ max: 50, message: "Tối đa 50 ký tự" }]}>
          <Input autoComplete="off" maxLength={50} placeholder="Khu Văn học" />
        </Form.Item>
        <Form.Item
          name="capacity"
          label="Sức chứa (số bản sao)"
          extra="Chỉ để hiển thị, hệ thống chưa chặn gán vượt sức chứa."
          rules={[{ type: "number", min: 1, max: 100000, message: "Từ 1 đến 100.000" }]}
        >
          <InputNumber className="w-full" min={1} max={100000} precision={0} />
        </Form.Item>
      </>
    );
  }
  return null;
}

const siteLink = (v: unknown) =>
  v ? (
    <a href={String(v)} target="_blank" rel="noopener noreferrer">
      {String(v).replace(/^https?:\/\//i, "").replace(/\/$/, "")}
    </a>
  ) : (
    "—"
  );


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
        ...extraPayload(kind, v),
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
          ? { label: String(row[cfg.field] ?? ""), description: row.description ?? "", parentId: row.parentId ?? undefined, ...extraInitial(kind, row) }
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
      <ExtraFields kind={kind} />
    </FormModal>
  );
}

/** Trang quản lý một danh mục chuẩn của catalog (phân trang phía server, lọc từ khóa và trạng thái trên URL). */
export function ReferenceCatalog({ kind }: { kind: ReferenceKind }) {
  const cfg = CONFIG[kind];
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const SIZE = usePageSize();
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
    kind === "authors"
      ? {
          key: cfg.field,
          title: "Tên",
          dataIndex: cfg.field,
          render: (v, r) => (
            <span className="flex items-center gap-2">
              <UserAvatar name={String(v ?? "")} src={(r as unknown as Row).photoUrl} size={28} />
              {String(v ?? "")}
            </span>
          ),
        }
      : { key: cfg.field, title: cfg.field === "code" ? "Mã" : "Tên", dataIndex: cfg.field },
    ...(kind === "categories" ? [{ key: "parentName", title: "Thể loại cha", dataIndex: "parentName" }] : []),
    ...(kind === "authors"
      ? [
          {
            key: "years",
            title: "Năm sinh - mất",
            dataIndex: "birthYear",
            render: (_: unknown, r: Record<string, unknown>) => {
              const a = r as unknown as Row;
              if (a.birthYear == null && a.deathYear == null) return "—";
              return `${a.birthYear ?? "?"} - ${a.deathYear ?? ""}`.trim();
            },
          },
          { key: "nationality", title: "Quốc tịch", dataIndex: "nationality", render: (v: unknown) => (v ? String(v) : "—") },
          { key: "website", title: "Website", dataIndex: "website", render: siteLink },
        ]
      : []),
    ...(kind === "publishers"
      ? [
          { key: "country", title: "Quốc gia", dataIndex: "country", render: (v: unknown) => (v ? String(v) : "—") },
          { key: "foundedYear", title: "Năm thành lập", dataIndex: "foundedYear", render: (v: unknown) => (v == null ? "—" : String(v)) },
          { key: "website", title: "Website", dataIndex: "website", render: siteLink },
          { key: "address", title: "Địa chỉ", dataIndex: "address", render: (v: unknown) => (v ? String(v) : "—") },
        ]
      : []),
    ...(kind === "shelf-locations"
      ? [
          { key: "floor", title: "Tầng", dataIndex: "floor", render: (v: unknown) => (v ? String(v) : "—") },
          { key: "zone", title: "Khu vực", dataIndex: "zone", render: (v: unknown) => (v ? String(v) : "—") },
          { key: "capacity", title: "Sức chứa", dataIndex: "capacity", align: "right" as const, render: (v: unknown) => (v == null ? "—" : String(v)) },
        ]
      : []),
    { key: "description", title: "Mô tả", dataIndex: "description" },
    {
      key: "active",
      title: "Trạng thái",
      dataIndex: "active",
      render: (v) => (v ? <Tag color="green">Đang dùng</Tag> : <Tag>Ngừng dùng</Tag>),
    },
    ...(canUpdate || canStatus
      ? [
          actionsColumn((r) => {
            const row = r as unknown as Row;
            const label = String(row[cfg.field] ?? "");
            const verb = row.active ? "Ngừng dùng" : "Dùng lại";
            return [
              {
                key: "edit",
                label: `Sửa ${label}`,
                icon: <Pencil size={16} />,
                hidden: !canUpdate,
                onClick: () => setEditing(row),
              },
              {
                key: "status",
                label: `${verb} ${label}`,
                icon: row.active ? <Power size={16} /> : <Play size={16} />,
                danger: row.active,
                hidden: !canStatus,
                confirm: {
                  title: row.active ? `Ngừng dùng «${label}»?` : `Dùng lại «${label}»?`,
                  description: row.active ? "Mục này sẽ không còn xuất hiện trong ô chọn; giá trị đã gán vẫn giữ nguyên." : undefined,
                  okText: verb,
                },
                onClick: async () => {
                  await setStatus.mutateAsync({ id: row.id, active: !row.active });
                },
              },
            ];
          }, 2),
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
          <>
            <ExcelImportButton cfg={EXCEL_IMPORTS[kind]} />
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
                Thêm {cfg.noun}
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-4">
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
