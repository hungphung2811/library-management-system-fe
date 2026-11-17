import { useMemo } from "react";
import { apiFetch, useApiMutation } from "@/api";
import { Form, FormModal, Input, InputNumber, Select, Switch } from "@/ui";
import {
  MAX_MENU_DEPTH,
  descendantIds,
  flattenTree,
  subtreeHeight,
  type AdminMenuItem,
  type MenuModule,
  type MenuTreeNode,
} from "../_lib/menu";

type Values = {
  code?: string;
  label: string;
  path?: string;
  icon?: string;
  sortOrder: number;
  enabled: boolean;
  permissionKey?: string;
  module?: MenuModule;
  parentId?: string;
};

export type MenuFormTarget = { mode: "create"; parentId?: string | null } | { mode: "edit"; node: MenuTreeNode };

const MODULES = [
  { value: "LENDING", label: "Mượn trả (LENDING)" },
  { value: "SALES", label: "Bán hàng (SALES)" },
];

const blank = (v?: string) => {
  const t = v?.trim();
  return t ? t : undefined;
};

/**
 * Tạo/sửa/di chuyển một mục menu. `code` chỉ nhập khi tạo. PUT thay thế toàn bộ nên luôn gửi đủ trường và `version`
 * đã đọc (lệch thì BE trả MENU_VERSION_CONFLICT, trang tải lại). Cha hợp lệ: không phải chính nó/hậu duệ và không làm cây sâu quá 3 cấp.
 */
export function MenuFormModal({
  target,
  tree,
  onClose,
  onReload,
}: {
  target: MenuFormTarget | null;
  tree: MenuTreeNode[];
  onClose: () => void;
  onReload: () => void;
}) {
  const editing = target?.mode === "edit" ? target.node : null;
  const create = useApiMutation(
    (body: Record<string, unknown>) => apiFetch<AdminMenuItem>("/api/admin/menus", { method: "POST", json: body }),
    { invalidate: ["/api/admin/menus", "/api/menus"] },
  );
  const update = useApiMutation(
    (v: { id: string; body: Record<string, unknown> }) =>
      apiFetch<AdminMenuItem>(`/api/admin/menus/${encodeURIComponent(v.id)}`, { method: "PUT", json: v.body }),
    { invalidate: ["/api/admin/menus", "/api/menus"] },
  );

  const parentOptions = useMemo(() => {
    const banned = editing ? descendantIds(editing) : new Set<string>();
    const height = editing ? subtreeHeight(editing) : 1;
    return flattenTree(tree)
      .filter((n) => !banned.has(n.id) && n.depth + height <= MAX_MENU_DEPTH)
      .map((n) => ({ value: n.id, label: `${"— ".repeat(n.depth - 1)}${n.label} (${n.code})` }));
  }, [tree, editing]);

  const initial: Partial<Values> = editing
    ? {
        code: editing.code,
        label: editing.label,
        path: editing.path ?? "",
        icon: editing.icon ?? "",
        sortOrder: editing.sortOrder,
        enabled: editing.enabled,
        permissionKey: editing.permissionKey ?? "",
        module: editing.module ?? undefined,
        parentId: editing.parentId ?? undefined,
      }
    : { sortOrder: 0, enabled: true, parentId: target?.mode === "create" ? (target.parentId ?? undefined) : undefined };

  return (
    <FormModal<Values>
      open={target !== null}
      title={editing ? `Sửa mục menu «${editing.label}»` : "Thêm mục menu"}
      okText={editing ? "Lưu" : "Tạo"}
      successMessage={editing ? "Đã cập nhật mục menu." : "Đã tạo mục menu."}
      onCancel={onClose}
      initialValues={initial}
      onSubmit={async (v) => {
        const shared = {
          label: v.label.trim(),
          path: blank(v.path),
          icon: blank(v.icon),
          sortOrder: v.sortOrder ?? 0,
          enabled: v.enabled !== false,
          permissionKey: blank(v.permissionKey),
          module: v.module ?? undefined,
          parentId: v.parentId ?? undefined,
        };
        try {
          if (editing) await update.mutateAsync({ id: editing.id, body: { ...shared, version: editing.version } });
          else await create.mutateAsync({ ...shared, code: (v.code ?? "").trim() });
        } catch (e) {
          // Phiên bản lệch: dữ liệu trên màn hình đã cũ, tải lại để lần sửa sau dùng version mới.
          const code = (e as { code?: string }).code;
          if (code === "MENU_VERSION_CONFLICT" || code === "MENU_CONFLICT") onReload();
          throw e;
        }
      }}
    >
      <Form.Item
        name="code"
        label="Mã"
        extra={editing ? "Mã không đổi được sau khi tạo." : "Duy nhất trong đơn vị, không đổi được sau khi tạo."}
        rules={editing ? [] : [{ required: true, whitespace: true, message: "Nhập mã" }, { max: 100, message: "Tối đa 100 ký tự" }]}
      >
        <Input autoComplete="off" disabled={editing !== null} />
      </Form.Item>
      <Form.Item
        name="label"
        label="Nhãn hiển thị"
        rules={[{ required: true, whitespace: true, message: "Nhập nhãn" }, { max: 200, message: "Tối đa 200 ký tự" }]}
      >
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="path"
        label="Đường dẫn"
        extra="Route nội bộ bắt đầu bằng «/», ví dụ /catalog. Để trống nếu đây là nhóm (không điều hướng)."
        rules={[
          { max: 500, message: "Tối đa 500 ký tự" },
          { pattern: /^(\/(?!\/).*)?$/, message: "Phải bắt đầu bằng «/» (route nội bộ) hoặc để trống" },
        ]}
      >
        <Input autoComplete="off" placeholder="/admin/users" />
      </Form.Item>
      <Form.Item name="parentId" label="Mục cha" extra={`Tối đa ${MAX_MENU_DEPTH} cấp. Bỏ trống là mục gốc.`}>
        <Select allowClear showSearch={{ optionFilterProp: "label" }} options={parentOptions} placeholder="Mục gốc" />
      </Form.Item>
      <Form.Item
        name="icon"
        label="Biểu tượng"
        rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}
        extra="Tên biểu tượng, ví dụ book, swap, shield. Tên lạ dùng biểu tượng mặc định."
      >
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="sortOrder" label="Thứ tự" rules={[{ required: true, message: "Nhập thứ tự" }]}>
        <InputNumber className="w-full" precision={0} />
      </Form.Item>
      <Form.Item
        name="permissionKey"
        label="Khóa quyền"
        rules={[{ max: 255, message: "Tối đa 255 ký tự" }]}
        extra="Tùy chọn, dạng Controller/method. Chỉ người có khóa này (hoặc quản trị viên) thấy mục."
      >
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="module"
        label="Module"
        extra="Để trống là mục lõi (luôn hiện). Chọn module thì chỉ hiện khi đơn vị đã bật module đó."
      >
        <Select allowClear options={MODULES} placeholder="Mục lõi" />
      </Form.Item>
      <Form.Item name="enabled" label="Đang bật" valuePropName="checked">
        <Switch />
      </Form.Item>
    </FormModal>
  );
}
